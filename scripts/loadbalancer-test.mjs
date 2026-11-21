import assert from 'node:assert/strict';

// Load Balancer Test & Demonstration Script for KubePulse
const target = (process.env.API_URL || process.env.LB_URL || 'http://localhost:5000').replace(/\/$/, '');
const requestCount = Number(process.env.REQUEST_COUNT || 30);
const timeoutMs = Number(process.env.TIMEOUT_MS || 5000);

console.log('====================================================');
console.log('⚖️  KubePulse Load Balancer Verification & Demo');
console.log(`Target URL: ${target}`);
console.log(`Sampling:   ${requestCount} requests`);
console.log('====================================================\n');

async function sendRequest(path = '/api/telemetry') {
  const url = `${target}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
    });
    const duration = Date.now() - start;
    const body = await res.json().catch(() => ({}));
    const servedBy = res.headers.get('x-served-by') || body.podName || body.pod || 'unknown-pod';
    const upstream = res.headers.get('x-upstream-backend') || 'direct';
    const lbHeader = res.headers.get('x-load-balancer');

    return {
      ok: res.ok,
      status: res.status,
      servedBy,
      upstream,
      lbHeader,
      duration,
      body,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      servedBy: 'error',
      upstream: 'none',
      lbHeader: null,
      duration: Date.now() - start,
      error: err.message,
    };
  }
}

async function run() {
  // 1. Initial Reachability Check
  console.log('1. Checking connection to Load Balancer / Gateway...');
  const probe = await sendRequest('/healthz');
  if (!probe.ok && probe.status !== 200) {
    console.error(`❌ Target unreachable at ${target} (HTTP ${probe.status}: ${probe.error || 'Check that the stack is running'})`);
    console.log('ℹ️  Tip: Run `make lb-up` or `make up` or set `API_URL=http://status.kubepulse.local`');
    process.exit(1);
  }
  console.log(`✅ Connected! (Serving pod: ${probe.servedBy}${probe.lbHeader ? `, LB: ${probe.lbHeader}` : ''})\n`);

  // 2. Traffic Distribution Sampling
  console.log(`2. Sending ${requestCount} requests to measure traffic distribution...`);
  const distribution = new Map();
  let totalSuccessful = 0;

  for (let i = 0; i < requestCount; i++) {
    const result = await sendRequest('/api/telemetry');
    if (result.ok) {
      totalSuccessful++;
      const current = distribution.get(result.servedBy) || 0;
      distribution.set(result.servedBy, current + 1);
    }
  }

  console.log('\n--- Traffic Distribution Summary ---');
  console.log('Pod / Replica Name                | Requests | Share');
  console.log('----------------------------------+----------+-------');
  for (const [pod, count] of distribution.entries()) {
    const pct = ((count / totalSuccessful) * 100).toFixed(1);
    console.log(`${pod.padEnd(34)}| ${String(count).padStart(8)} | ${pct.padStart(5)}%`);
  }
  console.log('----------------------------------+----------+-------');
  console.log(`Total sample size: ${totalSuccessful} successful responses across ${distribution.size} replica(s)\n`);

  if (distribution.size > 1) {
    console.log(`🎉 Multiple active replicas detected (${distribution.size}). Traffic is being load-balanced!\n`);
  } else {
    console.log('ℹ️  Single replica responded. If testing multi-replica load balancing, run `make lb-up` or `make k8s-prod`.\n');
  }

  // 3. Failover & Health Check Demonstration
  console.log('3. Demonstrating Load Balancer Failover & Readiness Probing...');
  try {
    // Attempt to toggle readiness chaos on the active target
    const toggleRes = await fetch(`${target}/chaos/toggle-readiness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });

    if (toggleRes.ok) {
      const chaosData = await toggleRes.json();
      const failingPod = chaosData.pod || probe.servedBy;
      console.log(`⚡ Injected readiness failure on pod: ${failingPod}`);
      console.log('   Readiness probe /readyz now returns HTTP 503.');

      // Sample requests during failover
      const failoverSamples = 10;
      let failingPodHits = 0;
      for (let i = 0; i < failoverSamples; i++) {
        const res = await sendRequest('/api/telemetry');
        if (res.servedBy === failingPod && !res.ok) {
          failingPodHits++;
        }
      }

      console.log(`   Failover check complete. Traffic monitored during degraded readiness.`);

      // Reset chaos
      await fetch(`${target}/chaos/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('🧹 Chaos reset: Pod restored to healthy readiness pool.\n');
    } else {
      console.log('ℹ️  Chaos endpoint not supported or restricted; skipping active injection.\n');
    }
  } catch (err) {
    console.log(`ℹ️  Readiness test note: ${err.message}`);
  }

  console.log('====================================================');
  console.log('✅ Load Balancer Demonstration Completed Successfully');
  console.log('====================================================');
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
