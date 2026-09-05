import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { AuditPort } from '../../application/port/audit.port';
import { AuditLogEntity } from '../../domain/entity/audit-log.entity';
import { loadConfig } from '../../../../config/configuration';

/**
 * IAM-SRS-008 — audit write reliability policy (infrastructure concern).
 *
 * 1. TX-EMBEDDED MANDATORY EVENTS (logWithClient — status change, role change):
 *    the audit INSERT runs inside the business transaction, so a genuine failure
 *    (connection loss, CHECK/FK violation, ...) rethrows and the business write
 *    aborts atomically ("audit failure = business failure"). No retry here: once
 *    a statement fails inside a PostgreSQL transaction the tx is aborted and a
 *    retry on the same client cannot succeed.
 *    A deduplicated insert (same correlation_id + action already recorded) is a
 *    no-op via ON CONFLICT DO NOTHING — rowCount 0, never an error — so retrying
 *    a producer event cannot abort the business write.
 *
 * 2. NON-TX BEST-EFFORT EVENTS (log — login/logout/password flows): audit must
 *    never break the business flow. Transient errors (connection/network,
 *    serialization failure, deadlock, pool exhaustion, server shutdown) get
 *    exactly one bounded retry after a short delay. On final failure — transient
 *    or not — the repository emits one structured error line (correlationId +
 *    action + driver code + truncated message) and resolves normally; secrets
 *    and payloads (beforeData/afterData/reason/ip/userAgent) are never logged.
 */

const AUDIT_RETRY_DELAY_MS = 100;

const INSERT_BASE =
  `INSERT INTO public.audit_logs
     (actor_user_id, action, entity_type, entity_id, before_data, after_data, result, ip_address, user_agent, correlation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`;

// Must match the predicate of partial unique index ux_audit_correlation_action
// (migration 0003) exactly, otherwise PostgreSQL cannot infer the conflict target.
const ON_CONFLICT_DEDUP =
  ' ON CONFLICT (correlation_id, action) WHERE correlation_id IS NOT NULL DO NOTHING';

// PostgreSQL SQLSTATE codes worth one retry; anything else fails fast.
const TRANSIENT_PG_CODES = new Set([
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '53300', // too_many_connections
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
]);

const TRANSIENT_SYSTEM_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
]);

function isTransientError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: unknown; message?: unknown };
  if (typeof err.code === 'string') {
    if (TRANSIENT_PG_CODES.has(err.code) || TRANSIENT_SYSTEM_CODES.has(err.code)) return true;
  }
  if (typeof err.message === 'string') {
    return /connection terminated|timeout expired|ECONNREFUSED|ECONNRESET|ETIMEDOUT/i.test(err.message);
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Structured failure line for best-effort audit writes. Includes correlation_id
 * and action only — never payloads/secrets (IAM-SRS-008).
 */
function logAuditWriteFailure(
  params: { action: string; entityType: string; correlationId?: string | null },
  error: unknown,
): void {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'audit_write_failed',
      policy: 'best_effort',
      action: params.action,
      entityType: params.entityType,
      correlationId: params.correlationId ?? null,
      pgCode: typeof code === 'string' ? code : null,
      error: message.slice(0, 200),
    }),
  );
}

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

interface AuditLogParams {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  result: 'SUCCESS' | 'FAILED';
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

@Injectable()
export class PgAuditRepository implements AuditPort {
  private pool(): Pool {
    return getPool();
  }

  private async logOnExecutor(
    executor: Pool | PoolClient,
    params: AuditLogParams,
  ): Promise<void> {
    // Write-time secret guard (IAM-SRS-008): a payload carrying a forbidden
    // secret key never reaches the DB. The throw propagates naturally —
    // best-effort `log()` swallows+logs it, tx-embedded `logWithClient()`
    // rethrows so the business write aborts. The error names no key/value.
    if (!AuditLogEntity.isSanitized(params.beforeData) || !AuditLogEntity.isSanitized(params.afterData)) {
      throw new Error('audit write rejected: forbidden secret key in beforeData/afterData (IAM-SRS-008)');
    }
    // Idempotent insert (IAM-SRS-008): when the event carries a correlation_id,
    // a duplicate (correlation_id, action) is swallowed by the DB instead of
    // raising a unique-violation, so producers can safely retry.
    const sql = params.correlationId ? INSERT_BASE + ON_CONFLICT_DEDUP : INSERT_BASE;
    await executor.query(sql, [
      params.actorUserId ?? null,
      params.action,
      params.entityType,
      params.entityId ?? null,
      params.beforeData ? JSON.stringify(params.beforeData) : null,
      params.afterData ? JSON.stringify(params.afterData) : null,
      params.result,
      params.ipAddress ?? null,
      params.userAgent ?? null,
      params.correlationId ?? null,
    ]);
  }

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.logOnExecutor(this.pool(), params);
    } catch (first) {
      if (!isTransientError(first)) {
        logAuditWriteFailure(params, first);
        return;
      }
      await delay(AUDIT_RETRY_DELAY_MS);
      try {
        await this.logOnExecutor(this.pool(), params);
      } catch (second) {
        logAuditWriteFailure(params, second);
      }
    }
  }

  async logWithClient(client: PoolClient, params: AuditLogParams): Promise<void> {
    // Single attempt inside the caller's transaction: rethrows on genuine
    // failure so the business write aborts; dedup is a silent no-op.
    await this.logOnExecutor(client, params);
  }
}
