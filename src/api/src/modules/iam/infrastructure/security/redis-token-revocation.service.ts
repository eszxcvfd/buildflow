import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { loadConfig } from '../../../../config/configuration';
import { TokenRevocationPort } from '../../application/port/token-revocation.port';

const JTI_KEY_PREFIX = 'iam:revoked:jti:';
const USER_CUTOFF_KEY_PREFIX = 'iam:revoked:user:';
/** Same command options as the health-check probe (src/health/health.service.ts). */
const REDIS_CONNECT_OPTIONS = {
  lazyConnect: true,
  connectTimeout: 2000,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
} as const;
/** One warn per throttle window per failure code — avoids log spam during an outage. */
const WARN_THROTTLE_MS = 30_000;

/**
 * Redis-backed token revocation (IAM-SRS-002 / IAM-SRS-007), selected by
 * TokenRevocationModule when REDIS_URL is configured.
 *
 * DATA.md compliance: Redis here is coordination-only and non-authoritative —
 * PostgreSQL `users.password_changed_at` remains the system of truth and is always
 * read fresh by the guard. This adapter only speeds up cross-instance propagation of
 * the jti denylist and user cutoffs. Therefore:
 * - WRITE failures (revoke / revokeAllForUserBefore) → warn + swallow: the request that
 *   changed the password must not fail because a cache node is down; other instances
 *   keep enforcing via their DB-backed cutoff read (worst case: their 30s cache window).
 * - READ failure on isRevoked → fail-open (return false): an outage must not invalidate
 *   every live JWT; the denylist is a cache, not truth.
 * - READ failure on isUserRevokedBefore → fall back to the cutoff passed in from the DB
 *   (the caller always enforces the DB value separately), i.e. degrade to per-instance
 *   behavior, never crash the request.
 *
 * Key design (auto-purge via TTL mirrors the in-memory self-purge semantics):
 * - `iam:revoked:jti:<jti>` = '1', EX = expiresAt - now (seconds, min 1)
 * - `iam:revoked:user:<userId>` = cutoff epoch-ms, EX = ceil(maxTtlMs / 1000), min 1
 *
 * No credentials or raw tokens are ever stored here — only jti and cutoff values.
 * A single shared ioredis client is created lazily (no per-call connections) and
 * disconnected in onModuleDestroy.
 */
@Injectable()
export class RedisTokenRevocationService implements TokenRevocationPort, OnModuleDestroy {
  private readonly logger = new Logger(RedisTokenRevocationService.name);
  /** Null when REDIS_URL is absent (defensive: the module factory never selects this class then). */
  private readonly client: Redis | null;
  private readonly lastWarnAt = new Map<string, number>();

  constructor() {
    const redisUrl = loadConfig().redisUrl;
    this.client = redisUrl ? new Redis(redisUrl, REDIS_CONNECT_OPTIONS) : null;
    // Without a listener an ioredis 'error' event would surface as an unhandled
    // EventEmitter error; route it through the throttled warn instead.
    this.client?.on('error', (err: Error) =>
      this.warnThrottled('redis-client', `Redis client error (token revocation): ${err.message}`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.client?.disconnect();
  }

  async revoke(jti: string, expiresAt: Date): Promise<void> {
    const ttlSec = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
    try {
      await this.client?.set(JTI_KEY_PREFIX + jti, '1', 'EX', ttlSec);
    } catch (err) {
      // WRITE failure → warn + swallow: revocation is best-effort coordination; the
      // natural token expiry still bounds the damage and the guard keeps enforcing
      // the DB-backed user cutoff.
      this.warnThrottled('revoke-jti', `Redis SET failed for jti revocation (continuing): ${(err as Error).message}`);
    }
  }

  async isRevoked(jti: string): Promise<boolean> {
    try {
      const count = await this.client?.exists(JTI_KEY_PREFIX + jti);
      return (count ?? 0) > 0;
    } catch (err) {
      // READ failure → fail-open (false): the denylist is a cache; blocking all
      // logins because Redis is unreachable would be worse than a missed revocation.
      this.warnThrottled('read-jti', `Redis EXISTS failed for jti (fail-open): ${(err as Error).message}`);
      return false;
    }
  }

  async revokeAllForUserBefore(userId: string, cutoff: Date, maxTtlMs: number): Promise<void> {
    const ttlSec = Math.max(1, Math.ceil(maxTtlMs / 1000));
    try {
      await this.client?.set(USER_CUTOFF_KEY_PREFIX + userId, String(cutoff.getTime()), 'EX', ttlSec);
    } catch (err) {
      // WRITE failure → warn + swallow: PostgreSQL password_changed_at is already
      // committed, so every instance falls back to enforcing the DB cutoff.
      this.warnThrottled('revoke-user', `Redis SET failed for user cutoff (continuing): ${(err as Error).message}`);
    }
  }

  async isUserRevokedBefore(userId: string, iat: number | undefined, cutoff: Date): Promise<boolean> {
    // IAM-SRS-007 fail-closed invariant: without iat we cannot prove the token was
    // issued after the cutoff → reject regardless of any cache state.
    if (iat === undefined) return true;
    // Effective cutoff = max(redis cutoff, DB-provided cutoff): the cache may only
    // tighten the check, never loosen it, and survives restarts via the DB value.
    let effective = cutoff.getTime();
    try {
      const raw = await this.client?.get(USER_CUTOFF_KEY_PREFIX + userId);
      if (raw !== null && raw !== undefined) {
        const redisCutoff = Number(raw);
        if (Number.isFinite(redisCutoff)) effective = Math.max(effective, redisCutoff);
      }
    } catch (err) {
      // READ failure → keep the DB-provided cutoff only (per-instance behavior, the
      // pre-Redis semantics) — the guard still enforces users.password_changed_at.
      this.warnThrottled('read-user', `Redis GET failed for user cutoff (DB fallback): ${(err as Error).message}`);
    }
    return iat * 1000 < effective;
  }

  private warnThrottled(code: string, message: string): void {
    const now = Date.now();
    const last = this.lastWarnAt.get(code) ?? 0;
    if (now - last < WARN_THROTTLE_MS) return;
    this.lastWarnAt.set(code, now);
    this.logger.warn(`[${code}] ${message}`);
  }
}
