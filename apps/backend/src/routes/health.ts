import { Router, Request, Response } from 'express';
import { chaos } from '../chaos';
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
    serviceName: config.serviceName,
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
      serviceName: config.serviceName,
      reason: 'Simulated readiness failure (/chaos/toggle-readiness is active)',
      pod: config.podName,
      env: config.envName,
      timestamp: new Date().toISOString(),
    });
  }

  const ownsDatabase = config.serviceName === 'components' || config.serviceName === 'incidents';
  const dbHealth = ownsDatabase
    ? await (await import('../db')).checkDatabaseHealth()
    : { ok: true, message: 'Not owned by this service', latencyMs: 0 };
  const redisHealth = config.serviceName === 'status'
    ? await checkRedisHealth()
    : { ok: true, message: 'Not owned by this service', latencyMs: 0, mode: 'NOT_APPLICABLE' };
  const isHealthy = true; // Domain services keep their intentional database fallback.
  const status = 200;

  return res.status(status).json({
    status: isHealthy ? 'ready' : 'degraded',
    serviceName: config.serviceName,
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
