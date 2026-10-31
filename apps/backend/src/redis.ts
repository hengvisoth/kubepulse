import Redis from 'ioredis';
import { config } from './config';

let redisClient: Redis | null = null;
let isConnected = false;

export function initRedis(): Redis {
  if (redisClient) return redisClient;

  const redisOptions = config.redisUrl
    ? config.redisUrl
    : {
        host: config.redisHost,
        port: config.redisPort,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        retryStrategy(times: number) {
          const delay = Math.min(times * 500, 3000);
          return delay;
        },
      };

  redisClient = new Redis(redisOptions as any);

  redisClient.on('connect', () => {
    console.log(`[Redis] Connected to ${config.redisHost}:${config.redisPort} (Internal k8s DNS)`);
    isConnected = true;
  });

  redisClient.on('error', (err) => {
    // Log concisely without crashing
    console.warn(`[Redis] Notice: Connection issue (${err.message}) - fallback to DB`);
    isConnected = false;
  });

  redisClient.on('close', () => {
    isConnected = false;
  });

  return redisClient;
}

export function isRedisConnected(): boolean {
  return isConnected && redisClient?.status === 'ready';
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  if (!isRedisConnected() || !redisClient) return null;
  try {
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (err) {
    console.warn('[Redis] Failed to get key', key, err);
    return null;
  }
}

export async function setCachedData(key: string, data: any, ttlSeconds: number = config.redisTtlSeconds): Promise<void> {
  if (!isRedisConnected() || !redisClient) return;
  try {
    await redisClient.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch (err) {
    console.warn('[Redis] Failed to set key', key, err);
  }
}

export async function getCacheTtl(key: string): Promise<number> {
  if (!isRedisConnected() || !redisClient) return -1;
  try {
    return await redisClient.ttl(key);
  } catch {
    return -1;
  }
}

export async function clearCache(pattern: string = '*'): Promise<void> {
  if (!isRedisConnected() || !redisClient) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (err) {
    console.warn('[Redis] Failed to clear cache', err);
  }
}

export async function checkRedisHealth(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  if (!redisClient) {
    return { ok: false, message: 'Redis client not initialized', latencyMs: 0 };
  }
  const start = Date.now();
  try {
    const ping = await redisClient.ping();
    return {
      ok: ping === 'PONG',
      message: 'PONG',
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err.message || 'Redis ping failed',
      latencyMs: Date.now() - start,
    };
  }
}
