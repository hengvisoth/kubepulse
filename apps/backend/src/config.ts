import os from 'os';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
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
