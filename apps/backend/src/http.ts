import http, { IncomingMessage, ServerResponse, OutgoingHttpHeaders } from 'http';
import https from 'https';

export class UpstreamError extends Error {
  constructor(message: string, public statusCode = 502) { super(message); }
}

const hopHeaders = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']);
function cleanHeaders(headers: IncomingMessage['headers']): OutgoingHttpHeaders {
  const blocked = new Set([...hopHeaders, ...(headers.connection || '').split(',').map(value => value.trim().toLowerCase())]);
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !blocked.has(key.toLowerCase())));
}

// Join raw paths without URL path normalization. Targets come only from configuration.
function targetOptions(base: string, path: string) {
  const url = new URL(base);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Service URL must use HTTP or HTTPS');
  return { protocol: url.protocol, hostname: url.hostname, port: url.port, path: `${url.pathname.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}` };
}

export function forwardRequest(req: IncomingMessage, res: ServerResponse, base: string, path: string, timeoutMs: number): void {
  let outgoing: http.ClientRequest;
  let timer: NodeJS.Timeout;
  const fail = (error: Error, statusCode = 502) => {
    clearTimeout(timer);
    if (res.headersSent) { res.destroy(error); return; }
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: statusCode === 504 ? 'Service request timed out' : 'Service unavailable', message: error.message }));
  };
  try {
    const options = targetOptions(base, path);
    outgoing = (options.protocol === 'https:' ? https : http).request({ ...options, method: req.method, headers: cleanHeaders(req.headers) }, upstream => {
      res.writeHead(upstream.statusCode || 502, cleanHeaders(upstream.headers));
      upstream.pipe(res);
      upstream.on('error', error => fail(error));
      upstream.on('end', () => clearTimeout(timer));
    });
    timer = setTimeout(() => {
      fail(new Error(`Upstream exceeded ${timeoutMs}ms`), 504);
      outgoing.destroy();
    }, timeoutMs);
    outgoing.on('error', error => { if (!res.writableEnded) fail(error); });
    res.on('close', () => { clearTimeout(timer); outgoing.destroy(); });
    req.pipe(outgoing);
  } catch (error) { fail(error as Error); }
}

export function requestJson<T = any>(base: string, path: string, options: { timeoutMs: number; method?: string } ): Promise<T> {
  return new Promise((resolve, reject) => {
    let timer: NodeJS.Timeout;
    let outgoing: http.ClientRequest;
    try {
      const target = targetOptions(base, path);
      outgoing = (target.protocol === 'https:' ? https : http).request({ ...target, method: options.method || 'GET', headers: { accept: 'application/json' } }, response => {
        const chunks: Buffer[] = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('error', error => { clearTimeout(timer); reject(new UpstreamError(error.message)); });
        response.on('end', () => {
          clearTimeout(timer);
          if (!response.statusCode || response.statusCode >= 400) return reject(new UpstreamError(`Service returned HTTP ${response.statusCode}`, response.statusCode === 504 ? 504 : 502));
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
          catch { reject(new UpstreamError('Service returned invalid JSON')); }
        });
      });
      timer = setTimeout(() => outgoing.destroy(new UpstreamError(`Upstream exceeded ${options.timeoutMs}ms`, 504)), options.timeoutMs);
      outgoing.on('error', error => { clearTimeout(timer); reject(error instanceof UpstreamError ? error : new UpstreamError(error.message)); });
      outgoing.end();
    } catch (error) { reject(new UpstreamError((error as Error).message)); }
  });
}
