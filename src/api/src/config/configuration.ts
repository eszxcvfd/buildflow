export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  loginMaxFailedAttempts: number;
  loginLockDurationMinutes: number;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-jwt-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    loginMaxFailedAttempts: parseInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS ?? '5', 10),
    loginLockDurationMinutes: parseInt(process.env.LOGIN_LOCK_DURATION_MINUTES ?? '15', 10),
  };
}
