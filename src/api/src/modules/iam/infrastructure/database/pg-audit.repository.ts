import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AuditPort } from '../../application/port/audit.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

@Injectable()
export class PgAuditRepository implements AuditPort {
  private pool(): Pool {
    return getPool();
  }

  async log(params: {
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
  }): Promise<void> {
    // Best effort: if DATABASE_URL missing or table not present, swallow error
    try {
      await this.pool().query(
        `INSERT INTO public.audit_logs
         (actor_user_id, action, entity_type, entity_id, before_data, after_data, result, ip_address, user_agent, correlation_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
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
        ],
      );
    } catch {
      // swallow - don't break login flow if audit fails (e.g., DB not reachable in tests)
    }
  }
}
