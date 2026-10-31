import Redis from 'ioredis';
import { config } from './config';

let redisClient: Redis | null = null;
let isConnected = false;

// High-performance In-Memory TTL Cache fallback (enables running completely without Redis)
interface CacheEntry {
  data: any;
  expiresAt: number;
}
const memoryCache = new Map<string, CacheEntry>();

export function initRedis(): Redis | null {
  if (!config.enableRedis) {
    console.log('[Cache] Running in In-Memory TTL mode (Redis disabled via ENABLE_REDIS=false)');
    return null;
  }

  if (redisClient) return redisClient;

  try {
    const redisOptions = config.redisUrl
      ? config.redisUrl
      : {
          host: config.redisHost,
          port: config.redisPort,
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
          retryStrategy(times: number) {
            // Keep retry intervals gentle
            return Math.min(times * 500, 3000);
          },
        };

    redisClient = new Redis(redisOptions as any);

    redisClient.on('connect', () => {
      console.log(`[Redis] Connected to ${config.redisHost}:${config.redisPort} (Internal k8s DNS)`);
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      // Graceful fallback notice - no crash
      if (isConnected) {
        console.warn(`[Redis] Connection interrupted (${err.message}) - using in-memory cache`);
      }
      isConnected = false;
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    return redisClient;
  } catch (err) {
    console.warn('[Redis] Failed to initialize client, using in-memory cache fallback');
    return null;
  }
}

export function isRedisConnected(): boolean {
  return isConnected && redisClient?.status === 'ready';
}

export function isUsingInMemoryCache(): boolean {
  return !isRedisConnected();
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  // 1. If Redis is connected, read from Redis
  if (isRedisConnected() && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data) as T;
    } catch {
      // Fall through to memoryCache
    }
  }

  // 2. In-Memory TTL Cache fallback
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  return entry.data as T;
}

export async function setCachedData(key: string, data: any, ttlSeconds: number = config.redisTtlSeconds): Promise<void> {
  // 1. If Redis is connected, store in Redis
  if (isRedisConnected() && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch {
      // Fall through to memoryCache
    }
  }

  // 2. Always store in In-Memory Cache as well
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function getCacheTtl(key: string): Promise<number> {
  if (isRedisConnected() && redisClient) {
    try {
      const ttl = await redisClient.ttl(key);
      if (ttl > 0) return ttl;
    } catch {
      // Fall through to memoryCache
    }
  }

  const entry = memoryCache.get(key);
  if (!entry) return -1;
  const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
  return remaining > 0 ? remaining : -1;
}

export async function clearCache(pattern: string = '*'): Promise<void> {
  memoryCache.clear();

  if (isRedisConnected() && redisClient) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } catch (err) {
      console.warn('[Redis] Failed to clear cache', err);
    }
  }
}

export async function checkRedisHealth(): Promise<{ ok: boolean; message: string; latencyMs: number; mode: string }> {
  if (isRedisConnected() && redisClient) {
    const start = Date.now();
    try {
      const ping = await redisClient.ping();
      return {
        ok: ping === 'PONG',
        message: 'Redis active (PONG)',
        latencyMs: Date.now() - start,
        mode: 'REDIS',
      };
    } catch (err: any) {
      return {
        ok: true,
        message: 'In-Memory fallback active (Redis unreachable)',
        latencyMs: 0,
        mode: 'IN_MEMORY',
      };
    }
  }

  return {
    ok: true,
    message: config.enableRedis
      ? 'In-Memory TTL Cache (Redis connecting/fallback)'
      : 'In-Memory TTL Cache (Redis disabled)',
    latencyMs: 0,
    mode: 'IN_MEMORY',
  };
}
