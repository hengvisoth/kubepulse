const test = require('node:test');
const assert = require('node:assert/strict');
const { SummaryCache } = require('../dist/redis');

class FakeRedis {
  generation = '0'; data = null;
  async eval(script, count, ...args) {
    if (script.includes("redis.call('INCR'")) { this.generation = String(Number(this.generation) + 1); this.data = null; return this.generation; }
    if (script.includes("redis.call('SET'")) { if (args[2] !== this.generation) return 0; this.data = args[3]; return 1; }
    return [this.generation, this.data || '', this.data ? 30 : -2];
  }
}

test('without Redis there is no replica-local summary cache', async () => {
  const cache = new SummaryCache(() => null, false);
  const before = await cache.read();
  await cache.publish(before.generation, { overallStatus: 'OPERATIONAL' });
  assert.equal((await cache.read()).data, null);
  await cache.invalidate();
});

test('an invalidated in-flight summary cannot be published as current', async () => {
  const redis = new FakeRedis();
  const cache = new SummaryCache(() => redis, true);
  const old = await cache.read();
  await cache.invalidate();
  assert.equal(await cache.publish(old.generation, { overallStatus: 'OPERATIONAL' }), false);
  assert.equal((await cache.read()).data, null);
  const current = await cache.read();
  assert.equal(await cache.publish(current.generation, { overallStatus: 'DEGRADED' }), true);
  assert.equal((await cache.read()).data.overallStatus, 'DEGRADED');
});

test('configured but unavailable Redis reports invalidation failure', async () => {
  const cache = new SummaryCache(() => null, true);
  await assert.rejects(cache.invalidate(), /unavailable/);
});

const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const http = require('node:http');
const Redis = require('ioredis');

test('real Redis Lua shares cached data and rejects stale writers across replicas', { skip: spawnSync('redis-server', ['--version']).status !== 0 }, async t => {
  const reservation = http.createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const server = spawn('redis-server', ['--bind', '127.0.0.1', '--port', String(port), '--save', '', '--appendonly', 'no'], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', data => { if (data.toString().includes('Ready to accept connections')) resolve(); });
    server.once('exit', code => reject(new Error(`Redis exited: ${code}`)));
    server.once('error', reject);
  });
  const first = new Redis({ host: '127.0.0.1', port, maxRetriesPerRequest: 0 });
  const second = new Redis({ host: '127.0.0.1', port, maxRetriesPerRequest: 0 });
  t.after(() => { first.disconnect(); second.disconnect(); });
  await Promise.all([once(first, 'ready'), once(second, 'ready')]);
  const replicaA = new SummaryCache(() => first, true);
  const replicaB = new SummaryCache(() => second, true);
  const oldRead = await replicaA.read();
  assert.equal(await replicaA.publish(oldRead.generation, { overallStatus: 'OPERATIONAL' }), true);
  assert.equal((await replicaB.read()).data.overallStatus, 'OPERATIONAL');
  await replicaB.invalidate();
  assert.equal(await replicaA.publish(oldRead.generation, { overallStatus: 'OPERATIONAL' }), false);
  assert.equal((await replicaB.read()).data, null);
  const current = await replicaB.read();
  assert.equal(await replicaB.publish(current.generation, { overallStatus: 'OUTAGE' }), true);
  const shared = await replicaA.read();
  assert.equal(shared.data.overallStatus, 'OUTAGE');
  assert.ok(shared.ttl > 0 && shared.ttl <= 30);
});
