import { Router, Request, Response } from 'express';
import { summaryCache } from '../redis';
import { config } from '../config';
import { requestJson, UpstreamError } from '../http';

const router = Router();
router.get('/status-summary', async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const cached = await summaryCache.read();
    if (cached.data) {
      res.setHeader('X-Cache-Status', 'HIT');
      return res.json({
        ...cached.data,
        cacheStatus: 'HIT',
        cacheSource: `redis (${config.redisHost}:${config.redisPort})`,
        ttlSecondsRemaining: Math.max(0, cached.ttl),
        servedByPod: config.podName,
        responseTimeMs: Date.now() - start,
      });
    }
    const [componentData, incidentData] = await Promise.all([
      requestJson(config.serviceUrls.components, '/api/components', { timeoutMs: config.upstreamTimeoutMs }),
      requestJson(config.serviceUrls.incidents, '/api/incidents', { timeoutMs: config.upstreamTimeoutMs }),
    ]);
    if (!Array.isArray(componentData.components) || !Array.isArray(incidentData.incidents)) throw new UpstreamError('Domain service returned an invalid response');
    const components = componentData.components;
    const activeIncidents = incidentData.incidents.filter((incident: any) => incident.status !== 'RESOLVED');
    const major = components.some((component: any) => component.status === 'MAJOR_OUTAGE') || activeIncidents.some((incident: any) => incident.impact === 'CRITICAL');
    const degraded = components.some((component: any) => ['DEGRADED_PERFORMANCE', 'PARTIAL_OUTAGE'].includes(component.status)) || activeIncidents.length > 0;
    const payload = {
      overallStatus: major ? 'OUTAGE' : degraded ? 'DEGRADED' : 'OPERATIONAL',
      totalComponents: components.length,
      operationalComponents: components.filter((component: any) => component.status === 'OPERATIONAL').length,
      activeIncidentsCount: activeIncidents.length,
      components,
      activeIncidents,
      generatedAt: new Date().toISOString(),
    };
    const published = await summaryCache.publish(cached.generation, payload);
    res.setHeader('X-Cache-Status', 'MISS');
    return res.json({ ...payload, cacheStatus: 'MISS', cacheSource: 'Component and incident services', ttlSecondsRemaining: published ? config.redisTtlSeconds : 0, servedByPod: config.podName, responseTimeMs: Date.now() - start });
  } catch (error: any) {
    return res.status(error instanceof UpstreamError ? error.statusCode : 503).json({ error: 'Failed to load status summary', message: error.message, servedByPod: config.podName });
  }
});

router.post('/status-summary/cache-purge', async (req: Request, res: Response) => {
  try {
    await summaryCache.invalidate();
    return res.json({ success: true, message: 'Status cache purged. Next request reads the component and incident services.', servedByPod: config.podName });
  } catch (error: any) {
    return res.status(503).json({ error: 'Status cache invalidation unavailable', message: error.message, servedByPod: config.podName });
  }
});
export default router;
