import assert from 'node:assert/strict';

const base = (process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json();
  assert(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

let incidentId;
let component;
let componentChanged = false;

try {
  await request('/healthz');
  await request('/readyz');
  const discovery = await request('/api/services');
  for (const name of ['gateway', 'components', 'incidents', 'status']) {
    const service = discovery.services.find((item) => item.name === name);
    assert(service?.ok, `${name} must be reachable and ready`);
    const prefix = name === 'gateway' ? '' : `/services/${name}`;
    const telemetry = await request(`${prefix}/api/telemetry`);
    assert.equal(telemetry.serviceName, name);
  }
  console.log('PASS: all four services are ready and return their own telemetry');

  const components = await request('/api/components');
  component = components.components[0];
  assert(component, 'Seed at least one component before running smoke checks');
  componentChanged = true;
  await request(`/api/components/${encodeURIComponent(component.id)}`, {
    method: 'PUT',
    body: { status: 'DEGRADED_PERFORMANCE' },
  });
  let summary = await request('/api/status-summary');
  assert.equal(summary.components.find((item) => item.id === component.id)?.status, 'DEGRADED_PERFORMANCE');
  console.log('PASS: component writes reach the status service');

  const created = await request('/api/incidents', {
    method: 'POST',
    body: {
      title: `Microservice smoke check ${Date.now()}`,
      impact: 'CRITICAL',
      affectedComponents: [component.name],
      message: 'Temporary incident created by the local smoke check.',
    },
  });
  incidentId = created.incident.id;
  const filtered = await request('/api/incidents?status=INVESTIGATING');
  assert(filtered.incidents.some((item) => item.id === incidentId));
  summary = await request('/api/status-summary');
  assert.equal(summary.overallStatus, 'OUTAGE');
  assert(summary.activeIncidents.some((item) => item.id === incidentId));

  await request(`/api/incidents/${encodeURIComponent(incidentId)}`, {
    method: 'PUT',
    body: { status: 'RESOLVED', message: 'Smoke check complete.' },
  });
  summary = await request('/api/status-summary');
  assert(!summary.activeIncidents.some((item) => item.id === incidentId));
  console.log('PASS: incident create, filter, resolve, and cache invalidation');

  await request('/api/status-summary/cache-purge', { method: 'POST' });
  console.log('PASS: cache purge route');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  const cleanup = [];
  if (incidentId) {
    cleanup.push(request(`/api/incidents/${encodeURIComponent(incidentId)}`, { method: 'DELETE' }));
  }
  if (componentChanged) {
    cleanup.push(request(`/api/components/${encodeURIComponent(component.id)}`, {
      method: 'PUT',
      body: { status: component.status },
    }));
  }
  for (const result of await Promise.allSettled(cleanup)) {
    if (result.status === 'rejected') {
      console.error(`Cleanup failed: ${result.reason.message}`);
      process.exitCode = 1;
    }
  }
}
