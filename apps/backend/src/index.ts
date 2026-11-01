import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import { register, metricsMiddleware } from './metrics';
import { initRedis } from './redis';
import { chaos } from './chaos';
import healthRouter from './routes/health';
import telemetryRouter from './routes/telemetry';
import buildRouter from './routes/build';
import statusRouter from './routes/status';
import incidentsRouter from './routes/incidents';
import componentsRouter from './routes/components';
import chaosRouter from './routes/chaos';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Latency injection middleware for chaos testing
app.use((req: Request, res: Response, next: NextFunction) => {
  const latency = chaos.getLatencyMs();
  if (latency > 0 && !req.path.startsWith('/chaos')) {
    setTimeout(next, latency);
  } else {
    next();
  }
});

// Prometheus request metrics
app.use(metricsMiddleware);

// Expose Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Health probes (Kubernetes Liveness and Readiness)
app.use(healthRouter);

// API routes
app.use('/api', telemetryRouter);
app.use('/api', buildRouter);
app.use('/api', statusRouter);
app.use('/api', incidentsRouter);
app.use('/api', componentsRouter);

// Chaos endpoints
app.use('/chaos', chaosRouter);

// Root summary info
app.get('/', (req: Request, res: Response) => {
  res.json({
    app: 'KubePulse Backend API',
    version: config.appVersion,
    env: config.envName,
    pod: config.podName,
    endpoints: {
      telemetry: '/api/telemetry',
      statusSummary: '/api/status-summary',
      incidents: '/api/incidents',
      components: '/api/components',
      healthz: '/healthz',
      readyz: '/readyz',
      metrics: '/metrics',
      chaosCrash: 'POST /chaos/crash',
      chaosCpuSpike: 'POST /chaos/cpu-spike',
      chaosToggleReadiness: 'POST /chaos/toggle-readiness',
    },
  });
});

// Initialize Redis client
initRedis();

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 KubePulse Backend running on http://0.0.0.0:${config.port}`);
  console.log(`🏷️  Environment: ${config.envName}`);
  console.log(`📦 Version:     ${config.appVersion}`);
  console.log(`☸️  Pod Name:    ${config.podName}`);
  console.log(`📊 Metrics:     http://0.0.0.0:${config.port}/metrics`);
  console.log(`🩺 Probes:      /healthz & /readyz`);
  console.log(`=======================================================`);
});

// Graceful shutdown on SIGTERM / SIGINT for zero-downtime rolling updates
function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Gracefully terminating KubePulse pod ${config.podName}...`);
  server.close(() => {
    console.log(`HTTP server closed. Exiting process.`);
    process.exit(0);
  });

  // Force close after 10 seconds if connections are stuck
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
