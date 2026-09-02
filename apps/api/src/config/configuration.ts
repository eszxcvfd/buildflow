import type { AppEnv } from './env';

export interface AppConfig {
  nodeEnv: AppEnv['NODE_ENV'];
  port: number;
  apiPrefix: string;
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
    port: Number(env.PORT ?? 3000),
    apiPrefix: env.API_GLOBAL_PREFIX,
    databaseUrl: env.DATABASE_URL,
    minio: {
      endpoint: env.MINIO_ENDPOINT,
      port: Number(env.MINIO_PORT ?? 9000),
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
    },
  };
};
