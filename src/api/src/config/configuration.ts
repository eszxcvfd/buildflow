export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
  };
}
