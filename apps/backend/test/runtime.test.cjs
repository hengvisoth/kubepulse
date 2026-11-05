const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const path = require('node:path');

async function port() {
  const server = http.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; await new Promise(resolve => server.close(resolve)); return value;
}
async function launch(t, role, port, urls) {
  const child = spawn(process.execPath, [path.join(__dirname, '../dist/index.js')], {
    env: { ...process.env, SERVICE_NAME: role, PORT: String(port), ENABLE_REDIS: 'false', DATABASE_URL: 'postgresql://demo:demo@127.0.0.1:1/demo?connect_timeout=1', UPSTREAM_TIMEOUT_MS: '150', ...urls },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = ''; child.stdout.on('data', data => logs += data); child.stderr.on('data', data => logs += data);
  t.after(async () => { if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(`http://127.0.0.1:${port}/healthz`)).ok) return { child, logs: () => logs }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Startup failed: ${logs}`);
}

test('four processes route writes, aggregate fresh status, discover health, and isolate chaos', async t => {
  const ports = Object.fromEntries(await Promise.all(['gateway', 'components', 'incidents', 'status'].map(async role => [role, await port()])));
  const urls = Object.fromEntries(['components', 'incidents', 'status'].map(role => [`${role.toUpperCase()}_SERVICE_URL`, `http://127.0.0.1:${ports[role]}`]));
  const processes = {};
  for (const role of ['components', 'incidents', 'status', 'gateway']) processes[role] = await launch(t, role, ports[role], urls);
  const gateway = `http://127.0.0.1:${ports.gateway}`;
  const call = (url, method = 'GET', body) => fetch(`${gateway}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const discovery = await (await call('/api/services')).json();
  assert.deepEqual(discovery.services.map(service => service.name).sort(), ['components', 'gateway', 'incidents', 'status']);
  assert.ok(discovery.services.every(service => service.ok));
  assert.equal((await (await call('/services/components/api/telemetry')).json()).serviceName, 'components');
  assert.equal((await (await call('/api/telemetry')).json()).serviceName, 'gateway');
  assert.equal((await fetch(`http://127.0.0.1:${ports.status}/api/components`)).status, 404);
  assert.equal((await call('/services/unknown/healthz')).status, 404);
  const before = await (await call('/api/status-summary')).json();
  assert.equal(before.cacheStatus, 'MISS');
  const id = before.components[0].id;
  assert.equal((await call(`/api/components/${id}`, 'PUT', { status: 'MAJOR_OUTAGE' })).status, 200);
  const afterResponse = await call('/api/status-summary');
  const after = await afterResponse.json();
  assert.equal(after.overallStatus, 'OUTAGE');
  assert.equal(afterResponse.headers.get('x-cache-status'), 'MISS');
  const incidentResponse = await call('/api/incidents', 'POST', { title: 'Integration incident', message: 'Started' });
  assert.equal(incidentResponse.status, 201);
  const incident = (await incidentResponse.json()).incident;
  assert.equal((await (await call('/api/status-summary')).json()).activeIncidentsCount, 1);
  assert.equal((await call(`/api/incidents/${incident.id}`, 'PUT', { status: 'RESOLVED', message: 'Resolved' })).status, 200);
  assert.equal((await (await call('/api/status-summary')).json()).activeIncidentsCount, 0);
  assert.equal((await call(`/api/incidents/${incident.id}`, 'DELETE')).status, 200);
  assert.equal((await call('/services/components/chaos/toggle-readiness', 'POST', { ready: false })).status, 200);
  assert.equal((await call('/services/components/readyz')).status, 503);
  assert.equal((await call('/readyz')).status, 200);
  assert.equal((await call('/services/incidents/readyz')).status, 200);
  await call('/services/components/chaos/reset', 'POST');
  processes.status.child.kill('SIGTERM'); await once(processes.status.child, 'exit');
  const mutation = await call(`/api/components/${id}`, 'PUT', { status: 'OPERATIONAL' });
  assert.equal(mutation.status, 200, 'committed writes must stay successful when invalidation fails');
  assert.match(processes.components.logs(), /invalidation failed after a successful write/);
  processes.components.child.kill('SIGTERM'); await once(processes.components.child, 'exit');
  assert.equal((await call('/api/components')).status, 502);
  assert.equal((await call('/api/status-summary')).status, 502);
});

test('status returns an explicit error when a domain service is missing', async t => {
  const statusPort = await port();
  await launch(t, 'status', statusPort, { COMPONENTS_SERVICE_URL: 'http://127.0.0.1:1', INCIDENTS_SERVICE_URL: 'http://127.0.0.1:1' });
  const response = await fetch(`http://127.0.0.1:${statusPort}/api/status-summary`);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).overallStatus, undefined);
});

test('unknown service names fail startup; local role ports have stable defaults', () => {
  const { spawnSync } = require('node:child_process');
  for (const [role, expected] of [['gateway', 5000], ['components', 5001], ['incidents', 5002], ['status', 5003]]) {
    const env = { ...process.env, SERVICE_NAME: role }; delete env.PORT;
    const result = spawnSync(process.execPath, ['-e', `console.log(require(${JSON.stringify(path.join(__dirname, '../dist/config'))}).config.port)`], { env, encoding: 'utf8' });
    assert.equal(result.status, 0); assert.equal(Number(result.stdout.trim()), expected);
  }
  const invalid = spawnSync(process.execPath, [path.join(__dirname, '../dist/index.js')], { env: { ...process.env, SERVICE_NAME: 'unknown' }, encoding: 'utf8' });
  assert.notEqual(invalid.status, 0); assert.match(invalid.stderr, /Unknown SERVICE_NAME/);
});

test('stalled cache invalidation stays within the gateway deadline after a committed write', async t => {
  let purgeRequests = 0;
  const statusStub = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/api/status-summary/cache-purge') {
      purgeRequests++;
      return; // Accept the request but never send a response.
    }
    res.writeHead(404); res.end();
  });
  statusStub.listen(0, '127.0.0.1'); await once(statusStub, 'listening');
  t.after(() => new Promise(resolve => { statusStub.closeAllConnections(); statusStub.close(resolve); }));
  const incidentsPort = await port();
  const gatewayPort = await port();
  const timeoutMs = 600;
  const urls = {
    INCIDENTS_SERVICE_URL: `http://127.0.0.1:${incidentsPort}`,
    STATUS_SERVICE_URL: `http://127.0.0.1:${statusStub.address().port}`,
    UPSTREAM_TIMEOUT_MS: String(timeoutMs),
  };
  const incidents = await launch(t, 'incidents', incidentsPort, urls);
  await launch(t, 'gateway', gatewayPort, urls);
  const start = performance.now();
  const response = await fetch(`http://127.0.0.1:${gatewayPort}/api/incidents`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Slow invalidation' }),
  });
  assert.equal(response.status, 201, 'a stalled purge must not hide a committed incident behind gateway 504');
  const incident = (await response.json()).incident;
  assert.ok(performance.now() - start < timeoutMs, 'the successful write response arrives before the outer gateway deadline');
  assert.equal(purgeRequests, 1);
  const stored = await fetch(`http://127.0.0.1:${gatewayPort}/api/incidents/${incident.id}`);
  assert.equal(stored.status, 200);
  assert.equal((await stored.json()).incident.title, 'Slow invalidation');
  assert.match(incidents.logs(), /invalidation failed after a successful write/);
});
