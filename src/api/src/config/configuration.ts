export interface AppConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  loginMaxFailedAttempts: number;
  loginLockDurationMinutes: number;
  auditRetentionDays: number;
}

/** @returns parsed positive integer; logs a warn and falls back on invalid input */
function parseIntWithDefault(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`[config] invalid ${name}=${raw} (must be a positive integer); using default ${fallback}`);
    return fallback;
  }
  return parsed;
}

export function loadConfig(): AppConfig {
  const jwtSecret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    // Fail at boot, not at first token: production MUST have a strong JWT secret.
    if (!jwtSecret || jwtSecret.trim().length === 0) {
      throw new Error('JWT_SECRET is required when NODE_ENV=production');
    }
    if (jwtSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters when NODE_ENV=production');
    }
  }
  return {
    port: parseInt(process.env.PORT ?? '3000', 10),
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
    jwtSecret: jwtSecret ?? 'dev-jwt-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    loginMaxFailedAttempts: parseInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS ?? '5', 10),
    loginLockDurationMinutes: parseInt(process.env.LOGIN_LOCK_DURATION_MINUTES ?? '15', 10),
    // IAM-SRS-008 audit retention (owner-approved 2026-09-05): default 365 days.
    auditRetentionDays: parseIntWithDefault('AUDIT_RETENTION_DAYS', 365),
  };
}
