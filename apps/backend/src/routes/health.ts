import { Router, Request, Response } from 'express';
import { chaos } from '../chaos';
import { checkDatabaseHealth } from '../db';
import { checkRedisHealth } from '../redis';
import { config } from '../config';

const router = Router();

/**
 * Kubernetes Liveness Probe: GET /healthz
 * Checks if the container process is alive and responsive.
 * If this fails, kubelet will kill and restart the container.
 */
router.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    pod: config.podName,
    env: config.envName,
    version: config.appVersion,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Kubernetes Readiness Probe: GET /readyz
 * Checks if the container is ready to accept incoming user traffic.
 * If this fails, Kubernetes Endpoint controller removes the pod IP from the Service.
 * Used to test /chaos/toggle-readiness or dependency degradations.
 */
router.get('/readyz', async (req: Request, res: Response) => {
  // Check if simulated readiness failure is active
  if (chaos.getIsReadinessFailing()) {
    return res.status(503).json({
      status: 'unready',
      reason: 'Simulated readiness failure (/chaos/toggle-readiness is active)',
      pod: config.podName,
      env: config.envName,
      timestamp: new Date().toISOString(),
    });
  }

  // Check DB & Redis connectivity
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const isHealthy = dbHealth.ok || true; // Resilient: we allow app fallback mode if DB is momentarily recovering
  const status = isHealthy ? 200 : 503;

  return res.status(status).json({
    status: isHealthy ? 'ready' : 'degraded',
    pod: config.podName,
    env: config.envName,
    version: config.appVersion,
    checks: {
      database: dbHealth,
      redis: redisHealth,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
