import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

export const serviceNames = ['gateway', 'components', 'incidents', 'status'] as const;
export type ServiceName = typeof serviceNames[number];
const serviceName = process.env.SERVICE_NAME || 'gateway';
if (!serviceNames.includes(serviceName as ServiceName)) {
  throw new Error(`Unknown SERVICE_NAME: ${serviceName}`);
}
const localPorts = { gateway: 5000, components: 5001, incidents: 5002, status: 5003 };
const parsedTimeout = Number(process.env.UPSTREAM_TIMEOUT_MS || 3000);
if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) throw new Error('UPSTREAM_TIMEOUT_MS must be positive');

export const config = {
  serviceName: serviceName as ServiceName,
  upstreamTimeoutMs: parsedTimeout,
  serviceUrls: {
    components: process.env.COMPONENTS_SERVICE_URL || 'http://localhost:5001',
    incidents: process.env.INCIDENTS_SERVICE_URL || 'http://localhost:5002',
    status: process.env.STATUS_SERVICE_URL || 'http://localhost:5003',
  },
  port: parseInt(process.env.PORT || String(localPorts[serviceName as ServiceName]), 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  envName: (process.env.ENV_NAME || process.env.NEXT_PUBLIC_ENV_NAME || 'DEV').toUpperCase(),
  appVersion: process.env.APP_VERSION || 'v1.0.0',
  podName: process.env.HOSTNAME || process.env.POD_NAME || os.hostname(),
  podIp: process.env.POD_IP || '127.0.0.1',
  nodeName: process.env.NODE_NAME || 'local-node',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kubepulse?schema=public',
  enableRedis: process.env.ENABLE_REDIS !== 'false',
  redisUrl: process.env.REDIS_URL || undefined,
  redisHost: process.env.REDIS_HOST || 'redis-service',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisTtlSeconds: parseInt(process.env.REDIS_TTL_SECONDS || '30', 10),
};
