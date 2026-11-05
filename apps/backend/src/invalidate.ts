import { config } from './config';
import { requestJson } from './http';

export async function invalidateStatus(): Promise<void> {
  // Leave time for the domain response to return before the gateway deadline.
  const timeoutMs = Math.min(1000, Math.max(1, Math.floor(config.upstreamTimeoutMs / 4)));
  try {
    await requestJson(config.serviceUrls.status, '/api/status-summary/cache-purge', { timeoutMs, method: 'POST' });
  } catch (error) {
    console.warn(`[${config.serviceName}] Status cache invalidation failed after a successful write. Cached data expires within the Redis TTL (${config.redisTtlSeconds}s).`, (error as Error).message);
  }
}
