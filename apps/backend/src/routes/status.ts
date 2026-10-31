import { Router, Request, Response } from 'express';
import { prisma, memoryStore } from '../db';
import { getCachedData, setCachedData, getCacheTtl, clearCache, isRedisConnected } from '../redis';
import { config } from '../config';

const router = Router();
const CACHE_KEY = 'kubepulse:status-summary';

router.get('/status-summary', async (req: Request, res: Response) => {
  const start = Date.now();

  try {
    // 1. Try reading from Redis Cache (30s TTL)
    const cached = await getCachedData<any>(CACHE_KEY);
    if (cached) {
      const ttl = await getCacheTtl(CACHE_KEY);
      const cacheSource = isRedisConnected()
        ? `redis (${config.redisHost}:${config.redisPort})`
        : 'In-Memory Cache (30s TTL)';
      res.setHeader('X-Cache-Status', 'HIT');
      return res.json({
        ...cached,
        cacheStatus: 'HIT',
        cacheSource,
        ttlSecondsRemaining: ttl > 0 ? ttl : config.redisTtlSeconds,
        servedByPod: config.podName,
        responseTimeMs: Date.now() - start,
      });
    }

    // 2. Cache Miss: Fetch live data from PostgreSQL (or memory fallback)
    let components: any[] = [];
    let activeIncidents: any[] = [];

    try {
      [components, activeIncidents] = await Promise.all([
        prisma.component.findMany({ orderBy: { order: 'asc' } }),
        prisma.incident.findMany({
          where: { status: { not: 'RESOLVED' } },
          include: { updates: { orderBy: { createdAt: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        }),
      ]);
    } catch (dbErr) {
      // Fallback to memory store if DB is down/initializing
      components = memoryStore.components;
      activeIncidents = memoryStore.incidents.filter((i) => i.status !== 'RESOLVED');
    }

    // Compute overall system health
    let overallStatus: 'OPERATIONAL' | 'DEGRADED' | 'OUTAGE' = 'OPERATIONAL';
    const hasMajorOutage = components.some((c) => c.status === 'MAJOR_OUTAGE') ||
      activeIncidents.some((i) => i.impact === 'CRITICAL');
    const hasDegraded = components.some((c) => c.status === 'DEGRADED_PERFORMANCE' || c.status === 'PARTIAL_OUTAGE') ||
      activeIncidents.length > 0;

    if (hasMajorOutage) {
      overallStatus = 'OUTAGE';
    } else if (hasDegraded) {
      overallStatus = 'DEGRADED';
    }

    const payload = {
      overallStatus,
      totalComponents: components.length,
      operationalComponents: components.filter((c) => c.status === 'OPERATIONAL').length,
      activeIncidentsCount: activeIncidents.length,
      components,
      activeIncidents,
      generatedAt: new Date().toISOString(),
    };

    // 3. Cache for 30 seconds (Redis if available, or In-Memory TTL cache)
    await setCachedData(CACHE_KEY, payload, config.redisTtlSeconds);

    res.setHeader('X-Cache-Status', 'MISS');
    return res.json({
      ...payload,
      cacheStatus: 'MISS',
      cacheSource: 'PostgreSQL Database',
      ttlSecondsRemaining: config.redisTtlSeconds,
      servedByPod: config.podName,
      responseTimeMs: Date.now() - start,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to load status summary',
      message: error.message,
      servedByPod: config.podName,
    });
  }
});

// Purge cache endpoint to verify cache re-generation
router.post('/status-summary/cache-purge', async (req: Request, res: Response) => {
  await clearCache(CACHE_KEY);
  return res.json({
    success: true,
    message: 'Redis status summary cache purged. Next request will be a cache MISS and re-query PostgreSQL.',
    servedByPod: config.podName,
  });
});

export default router;
