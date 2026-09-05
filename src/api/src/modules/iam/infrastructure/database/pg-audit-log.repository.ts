import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { AuditLogEntity } from '../../domain/entity/audit-log.entity';
import { AuditLogFilter, AuditLogRepositoryPort } from '../../domain/repository/audit-log-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

function mapRow(row: Record<string, unknown>): AuditLogEntity {
  return new AuditLogEntity({
    id: String(row['id']),
    actorUserId: (row['actor_user_id'] as string | null) ?? null,
    action: String(row['action']),
    entityType: String(row['entity_type']),
    entityId: (row['entity_id'] as string | null) ?? null,
    beforeData: row['before_data'] ?? null,
    afterData: row['after_data'] ?? null,
    reason: (row['reason'] as string | null) ?? null,
    result: row['result'] as 'SUCCESS' | 'FAILED',
    ipAddress: (row['ip_address'] as string | null) ?? null,
    userAgent: (row['user_agent'] as string | null) ?? null,
    correlationId: (row['correlation_id'] as string | null) ?? null,
    createdAt: new Date(String(row['created_at'])),
  });
}

@Injectable()
export class PgAuditLogRepository implements AuditLogRepositoryPort {
  private pool(): Pool { return getPool(); }

  async findMany(filter: AuditLogFilter): Promise<{ entities: AuditLogEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.action) {
      conditions.push(`action = $${idx++}`);
      values.push(filter.action);
    }
    if (filter.actorUserId) {
      conditions.push(`actor_user_id = $${idx++}`);
      values.push(filter.actorUserId);
    }
    if (filter.entityType) {
      conditions.push(`entity_type = $${idx++}`);
      values.push(filter.entityType);
    }
    if (filter.entityId) {
      conditions.push(`entity_id = $${idx++}`);
      values.push(filter.entityId);
    }
    if (filter.result) {
      conditions.push(`result = $${idx++}`);
      values.push(filter.result);
    }
    if (filter.correlationId) {
      conditions.push(`correlation_id = $${idx++}`);
      values.push(filter.correlationId);
    }
    if (filter.from) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(filter.from.toISOString());
    }
    if (filter.to) {
      conditions.push(`created_at <= $${idx++}`);
      values.push(filter.to.toISOString());
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    const countResult = await this.pool().query(`SELECT COUNT(*) FROM public.audit_logs ${where}`, values);
    const total = Number(countResult.rows[0].count);

    const dataResult = await this.pool().query(
      `SELECT id, actor_user_id, action, entity_type, entity_id, before_data, after_data, reason, result, ip_address, user_agent, correlation_id, created_at
       FROM public.audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );

    const entities = dataResult.rows.map((r: Record<string, unknown>) => mapRow(r));
    return { entities, total };
  }

  async findById(id: string): Promise<AuditLogEntity | null> {
    const result = await this.pool().query(
      `SELECT id, actor_user_id, action, entity_type, entity_id, before_data, after_data, reason, result, ip_address, user_agent, correlation_id, created_at
       FROM public.audit_logs WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0]);
  }

  async existsByCorrelation(correlationId: string, action: string, entityId?: string | null): Promise<boolean> {
    let query = `SELECT 1 FROM public.audit_logs WHERE correlation_id = $1 AND action = $2 LIMIT 1`;
    const values: unknown[] = [correlationId, action];
    if (entityId) {
      query = `SELECT 1 FROM public.audit_logs WHERE correlation_id = $1 AND action = $2 AND entity_id = $3 LIMIT 1`;
      values.push(entityId);
    }
    const result = await this.pool().query(query, values);
    return result.rows.length > 0;
  }
}
