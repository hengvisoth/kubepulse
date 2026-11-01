import { Router, Request, Response } from 'express';
import os from 'os';
import { config } from '../config';
import { isRedisConnected } from '../redis';
import { chaos } from '../chaos';

const router = Router();
const startTime = Date.now();

router.get('/telemetry', (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    podName: config.podName,
    appVersion: config.appVersion,
    envName: config.envName,
    rolloutTest: 2,
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
    redis: {
      host: config.redisHost,
      port: config.redisPort,
      connected: isRedisConnected(),
    },
    chaos: chaos.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
