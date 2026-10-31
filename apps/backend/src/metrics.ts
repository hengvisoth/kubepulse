import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';
import { config } from './config';

// Create a Registry which registers the metrics
export const register = new client.Registry();

// Add default recommended metrics (memory, event loop, gc, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'kubepulse_',
  labels: {
    pod: config.podName,
    env: config.envName,
    version: config.appVersion,
  },
});

// Custom metric: HTTP requests total
export const httpRequestsTotal = new client.Counter({
  name: 'kubepulse_http_requests_total',
  help: 'Total number of HTTP requests handled by KubePulse',
  labelNames: ['method', 'route', 'status_code', 'pod', 'env'],
  registers: [register],
});

// Custom metric: Request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: 'kubepulse_http_request_duration_seconds',
  help: 'Histogram of HTTP request durations in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Custom metric: Chaos events triggered
export const chaosEventsTotal = new client.Counter({
  name: 'kubepulse_chaos_events_total',
  help: 'Total number of chaos events triggered',
  labelNames: ['type', 'pod', 'env'],
  registers: [register],
});

// Custom metric: Pod readiness state gauge (1 = Ready, 0 = Unready)
export const podReadinessGauge = new client.Gauge({
  name: 'kubepulse_pod_readiness_status',
  help: 'Current simulated readiness status of this pod (1 = ready, 0 = failing)',
  labelNames: ['pod', 'env'],
  registers: [register],
});
podReadinessGauge.set({ pod: config.podName, env: config.envName }, 1);

// Custom metric: CPU spike active gauge
export const cpuSpikeActiveGauge = new client.Gauge({
  name: 'kubepulse_cpu_spike_active',
  help: 'Whether a simulated CPU stress spike is currently active (1 = active, 0 = idle)',
  labelNames: ['pod'],
  registers: [register],
});
cpuSpikeActiveGauge.set({ pod: config.podName }, 0);

// Express middleware to capture Prometheus metrics
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Ignore /metrics and health probes from bloating application metrics
  if (req.path === '/metrics' || req.path === '/healthz' || req.path === '/readyz') {
    return next();
  }

  const end = httpRequestDuration.startTimer({ method: req.method, route: req.path });

  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: req.path,
      status_code: res.statusCode.toString(),
      pod: config.podName,
      env: config.envName,
    });
    end({ status_code: res.statusCode.toString() });
  });

  next();
}
