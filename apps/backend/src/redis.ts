import Redis from 'ioredis';
import { config } from './config';

let redisClient: Redis | null = null;
export function initRedis(): Redis | null {
  if (config.serviceName !== 'status' || !config.enableRedis) return null;
  if (redisClient) return redisClient;
  const options = {
    maxRetriesPerRequest: 1,
    connectTimeout: Math.min(config.upstreamTimeoutMs, 2000),
    commandTimeout: config.upstreamTimeoutMs,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => Math.min(times * 500, 3000),
  };
  redisClient = config.redisUrl
    ? new Redis(config.redisUrl, options)
    : new Redis({ ...options, host: config.redisHost, port: config.redisPort });
  redisClient.on('error', error => console.warn(`[Redis] ${error.message}; summaries will be fetched fresh`));
  return redisClient;
}

export function isRedisConnected(): boolean { return redisClient?.status === 'ready'; }
export function closeRedis(): void { redisClient?.disconnect(); }

interface RedisCommands {
  eval(script: string, numberOfKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

const CACHE_KEY = 'kubepulse:status-summary';
const GENERATION_KEY = `${CACHE_KEY}:generation`;
// Lua makes generation checks, reads, writes, and invalidation atomic across replicas.
const READ = `return {redis.call('GET', KEYS[1]) or '0', redis.call('GET', KEYS[2]) or '', redis.call('TTL', KEYS[2])}`;
const PUBLISH = `if (redis.call('GET', KEYS[1]) or '0') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3]); return 1`;
const INVALIDATE = `local generation = redis.call('INCR', KEYS[1]); redis.call('DEL', KEYS[2]); return generation`;

export class SummaryCache {
  constructor(private getClient: () => RedisCommands | null, private enabled: boolean, private ttl = config.redisTtlSeconds) {}

  async read(): Promise<{ generation: string | null; data: any; ttl: number }> {
    const client = this.getClient();
    if (client) {
      try {
        const [generation, raw, ttl] = await client.eval(READ, 2, GENERATION_KEY, CACHE_KEY) as [string, string, number];
        return { generation: String(generation), data: raw ? JSON.parse(raw) : null, ttl };
      } catch (error) { console.warn('[Redis] Cache read failed; fetching fresh data', error); }
    }
    return { generation: null, data: null, ttl: 0 };
  }

  async publish(generation: string | null, data: unknown): Promise<boolean> {
    const client = this.getClient();
    if (!client || generation === null) return false;
    try { return Number(await client.eval(PUBLISH, 2, GENERATION_KEY, CACHE_KEY, generation, JSON.stringify(data), this.ttl)) === 1; }
    catch (error) { console.warn('[Redis] Cache publish failed', error); return false; }
  }

  async invalidate(): Promise<void> {
    if (!this.enabled) return;
    const client = this.getClient();
    if (!client) throw new Error('Redis unavailable; cache expires at its TTL');
    await client.eval(INVALIDATE, 2, GENERATION_KEY, CACHE_KEY);
  }
}

export const summaryCache = new SummaryCache(() => isRedisConnected() ? redisClient : null, config.enableRedis);

export async function checkRedisHealth(): Promise<{ ok: boolean; message: string; latencyMs: number; mode: string }> {
  const start = Date.now();
  if (isRedisConnected() && redisClient) {
    try {
      await redisClient.ping();
      return { ok: true, message: 'Redis active (PONG)', latencyMs: Date.now() - start, mode: 'REDIS' };
    } catch { /* Fresh HTTP aggregation remains available. */ }
  }
  return { ok: true, message: 'Redis unavailable or disabled; summaries are fetched fresh', latencyMs: 0, mode: 'UNCACHED' };
}
