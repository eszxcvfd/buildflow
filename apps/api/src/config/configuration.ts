import type { AppEnv } from './env';

export interface AppConfig {
  nodeEnv: AppEnv['NODE_ENV'];
  host: string;
  port: number;
  corsOrigins: string[];
  databaseUrl: string;
  minio: {
    endpoint: string;
    port: number;
    accessKey: string;
    secretKey: string;
  };
}

export default (): AppConfig => {
  const env = process.env as unknown as AppEnv;
  return {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: Number(env.PORT),
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    databaseUrl: env.DATABASE_URL,
    minio: {
      endpoint: env.MINIO_ENDPOINT,
      port: Number(env.MINIO_PORT),
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    },
  };
};
