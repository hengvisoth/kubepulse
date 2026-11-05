import { Router, Request, Response } from 'express';
import os from 'os';
import { config } from '../config';
import { isRedisConnected } from '../redis';
import { chaos } from '../chaos';
import { requestJson } from '../http';

const router = Router();
const startTime = Date.now();

router.get('/telemetry', async (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  
  let redis: any = { host: config.redisHost, port: config.redisPort, connected: isRedisConnected(), owner: 'status' };
  if (config.serviceName === 'gateway') {
    try {
      const statusTelemetry = await requestJson(config.serviceUrls.status, '/api/telemetry', { timeoutMs: config.upstreamTimeoutMs });
      redis = { ...statusTelemetry.redis, owner: 'status', available: true };
    } catch { redis.available = false; }
  }
  res.json({
    serviceName: config.serviceName,
    podName: config.podName,
    appVersion: config.appVersion,
    envName: config.envName,
    rolloutTest: 3,
    podIp: config.podIp,
    nodeName: config.nodeName,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    processUptime: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    systemLoadAvg: os.loadavg(),
    memory: {
      rssMb: Math.round(memoryUsage.rss / (1024 * 1024)),
      heapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
    },
    redis,
    chaos: chaos.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
