const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { forwardRequest, requestJson } = require('../dist/http');

async function serve(t, handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('forwarding preserves encoded path, query, body, status, and useful headers', async t => {
  const upstream = await serve(t, async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.writeHead(201, { 'Content-Type': 'application/json', 'X-Cache-Status': 'MISS', 'X-Trace': req.headers['x-trace'] });
    res.end(JSON.stringify({ url: req.url, method: req.method, body }));
  });
  const gateway = await serve(t, (req, res) => forwardRequest(req, res, upstream, req.url, 200));
  const response = await fetch(`${gateway}/api/incidents/a%2Fb?status=A%20B&x=1&x=2`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Trace': 'test' }, body: '{ "title": "Demo" }',
  });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('x-cache-status'), 'MISS');
  assert.equal(response.headers.get('x-trace'), 'test');
  assert.deepEqual(await response.json(), { url: '/api/incidents/a%2Fb?status=A%20B&x=1&x=2', method: 'PUT', body: '{ "title": "Demo" }' });
});

test('missing service returns 502, stalled service returns 504', async t => {
  const gateway = await serve(t, (req, res) => forwardRequest(req, res, 'http://127.0.0.1:1', req.url, 50));
  assert.equal((await fetch(gateway)).status, 502);
  const stalled = await serve(t, () => {});
  const slowGateway = await serve(t, (req, res) => forwardRequest(req, res, stalled, req.url, 30));
  assert.equal((await fetch(slowGateway)).status, 504);
  await assert.rejects(requestJson(stalled, '/api/components', { timeoutMs: 30 }), error => error.statusCode === 504);
});
