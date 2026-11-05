import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { register, metricsMiddleware } from './metrics';
import { initRedis, closeRedis } from './redis';
import { chaos } from './chaos';
import healthRouter from './routes/health';
import telemetryRouter from './routes/telemetry';
import buildRouter from './routes/build';
import chaosRouter from './routes/chaos';
import { mountGateway, gatewayDiscovery } from './services/gateway';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const latency = chaos.getLatencyMs();
    if (latency > 0 && !req.path.startsWith('/chaos')) setTimeout(next, latency);
    else next();
  });
  app.use(metricsMiddleware);
  if (config.serviceName === 'gateway') mountGateway(app);
  app.use(express.json());
  const local = express.Router();
  local.get('/metrics', async (req, res) => {
    try { res.set('Content-Type', register.contentType); res.end(await register.metrics()); }
    catch { res.status(500).end('Failed to collect metrics'); }
  });
  local.use(healthRouter);
  local.use('/api', telemetryRouter, buildRouter);
  local.use('/chaos', chaosRouter);
  app.use(local);
  if (config.serviceName === 'gateway') {
    app.use('/services/gateway', local);
    app.use('/api', gatewayDiscovery());
  } else {
    // Load only the owning role. Gateway and status never initialize Prisma.
    const service = require(`./services/${config.serviceName}`).default;
    app.use('/api', service);
  }
  app.get('/', (req, res) => res.json({
    app: 'KubePulse Backend API', serviceName: config.serviceName, version: config.appVersion, env: config.envName, pod: config.podName,
    endpoints: { telemetry: '/api/telemetry', build: '/api/build', healthz: '/healthz', readyz: '/readyz', metrics: '/metrics', chaos: '/chaos/status', ...(config.serviceName === 'gateway' ? { services: '/api/services', statusSummary: '/api/status-summary', incidents: '/api/incidents', components: '/api/components' } : {}) },
  }));
  return app;
}

export function startService() {
  initRedis();
  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => console.log(`[${config.serviceName}] KubePulse listening on ${config.port}; pod=${config.podName}; env=${config.envName}`));
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    server.close(async () => {
      closeRedis();
      if (config.serviceName === 'components' || config.serviceName === 'incidents') await (await import('./db')).prisma.$disconnect();
      clearTimeout(timeout);
      process.exit(0);
    });
    server.closeIdleConnections();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  return app;
}
