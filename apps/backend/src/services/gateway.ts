import { Express, Request, Response, Router } from 'express';
import { config } from '../config';
import { chaos } from '../chaos';
import { forwardRequest, requestJson } from '../http';

export function mountGateway(app: Express): void {
  // Route before JSON parsing so every forwarded request keeps its exact bytes.
  app.use((req, res, next) => {
    const domain = req.path.match(/^\/api\/(components|incidents|status-summary)(?:\/|$)/)?.[1];
    if (domain) {
      const role = domain === 'status-summary' ? 'status' : domain as 'components' | 'incidents';
      return forwardRequest(req, res, config.serviceUrls[role], req.originalUrl, config.upstreamTimeoutMs);
    }
    const diagnostic = req.originalUrl.match(/^\/services\/(components|incidents|status)(\/[^?]*)?(\?.*)?$/);
    if (diagnostic) {
      const role = diagnostic[1] as keyof typeof config.serviceUrls;
      return forwardRequest(req, res, config.serviceUrls[role], `${diagnostic[2] || '/'}${diagnostic[3] || ''}`, config.upstreamTimeoutMs);
    }
    next();
  });
}

export function gatewayDiscovery(): Router {
  const router = Router();
  router.get('/services', async (req: Request, res: Response) => {
    const services = await Promise.all(Object.entries(config.serviceUrls).map(async ([name, url]) => {
      try {
        const health = await requestJson(url, '/readyz', { timeoutMs: config.upstreamTimeoutMs });
        return { name, url, ok: true, status: health.status, pod: health.pod };
      } catch (error: any) { return { name, url, ok: false, error: error.message }; }
    }));
    const ready = !chaos.getIsReadinessFailing();
    res.json({ services: [{ name: 'gateway', ok: ready, status: ready ? 'ready' : 'unready', pod: config.podName }, ...services], servedByPod: config.podName });
  });
  return router;
}
