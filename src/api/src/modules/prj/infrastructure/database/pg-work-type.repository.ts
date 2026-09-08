import { ConflictException, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { WorkTypeEntity } from '../../domain/entity/work-type.entity';
import {
  RequiredFieldConfig,
  WorkTypePriority,
  normalizeRequiredFields,
} from '../../domain/service/work-type.policy';
import { WorkTypeFilter, WorkTypeRepositoryPort, ActiveTradeRef, SaveWorkTypeOptions } from '../../domain/repository/work-type-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

type Row = Record<string, unknown>;

function parseRequiredFields(raw: unknown): RequiredFieldConfig[] {
  if (raw === null || raw === undefined) return [];
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  // Shape đã validate ở app layer (policy); repo re-validate phòng thủ để
  // không bao giờ persist/audit payload sai shape khi caller bỏ qua policy.
  return normalizeRequiredFields(value);
}

function mapRow(row: Row): WorkTypeEntity {
  return new WorkTypeEntity({
    id: String(row['id']),
    code: String(row['code']),
    name: String(row['name']),
    description: (row['description'] as string | null) ?? null,
    group: (row['work_type_group'] as string | null) ?? null,
    requiredTradeId: (row['required_trade_id'] as string | null) ?? null,
    requiredFields: parseRequiredFields(row['required_fields']),
    configVersion: Number(row['config_version'] ?? 1),
    defaultDurationMinutes:
      row['default_duration_minutes'] === null || row['default_duration_minutes'] === undefined
        ? null
        : Number(row['default_duration_minutes']),
    defaultPriority: (String(row['default_priority'] ?? 'NORMAL') as WorkTypePriority),
    isActive: Boolean(row['is_active']),
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

const WORK_TYPE_COLUMNS =
  'id, code, name, description, work_type_group, required_trade_id, required_fields, ' +
  'config_version, default_duration_minutes, default_priority, is_active, created_at, updated_at';

@Injectable()
export class PgWorkTypeRepository implements WorkTypeRepositoryPort {
  private pool(): Pool { return getPool(); }

  async findById(id: string): Promise<WorkTypeEntity | null> {
    const r = await this.pool().query(
      `SELECT ${WORK_TYPE_COLUMNS} FROM public.work_types WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async findByCode(code: string): Promise<WorkTypeEntity | null> {
    const r = await this.pool().query(
      `SELECT ${WORK_TYPE_COLUMNS} FROM public.work_types WHERE lower(code) = lower($1) LIMIT 1`,
      [code.trim()],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async search(filter: WorkTypeFilter): Promise<{ entities: WorkTypeEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.status && filter.status !== 'ALL') {
      conditions.push(`is_active = $${idx++}`);
      values.push(filter.status === 'ACTIVE');
    }
    if (filter.group) {
      conditions.push(`work_type_group = $${idx++}`);
      values.push(filter.group);
    }
    if (filter.tradeId) {
      conditions.push(`required_trade_id = $${idx++}`);
      values.push(filter.tradeId);
    }
    if (filter.search) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      conditions.push(`(lower(code) ILIKE $${idx} OR lower(name) ILIKE $${idx})`);
      values.push(term);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countR = await this.pool().query(`SELECT COUNT(*) FROM public.work_types ${where}`, values);
    const total = Number(countR.rows[0].count);

    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    const dataR = await this.pool().query(
      `SELECT ${WORK_TYPE_COLUMNS} FROM public.work_types ${where} ORDER BY name ASC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );

    return { entities: dataR.rows.map((row: Row) => mapRow(row)), total };
  }

  async findAllActive(): Promise<WorkTypeEntity[]> {
    const r = await this.pool().query(
      `SELECT ${WORK_TYPE_COLUMNS} FROM public.work_types WHERE is_active = true ORDER BY name ASC`,
    );
    return r.rows.map((row: Row) => mapRow(row));
  }

  async findActiveTradeById(tradeId: string): Promise<ActiveTradeRef | null> {
    const r = await this.pool().query(
      'SELECT id, is_active FROM public.trades WHERE id = $1 LIMIT 1',
      [tradeId],
    );
    if (r.rows.length === 0) return null;
    return { id: String(r.rows[0].id), isActive: Boolean(r.rows[0].is_active) };
  }

  async countActiveWorkOrders(workTypeId: string): Promise<number> {
    // Forward-ref contract cho JOB module (chưa tồn tại): đếm Work Order đang
    // tham chiếu loại này, trừ trạng thái kết thúc. Chỉ dùng cho cảnh báo phạm
    // vi áp dụng (update config / deactivate) — KHÔNG chặn transition.
    const r = await this.pool().query(
      `SELECT COUNT(*)::int AS total FROM public.work_orders
        WHERE work_type_id = $1 AND status NOT IN ('CANCELLED', 'CLOSED')`,
      [workTypeId],
    );
    return Number(r.rows[0].total ?? 0);
  }

  private async createOnExecutor(executor: Pool | PoolClient, workType: WorkTypeEntity): Promise<void> {
    const p = workType.getProps();
    await executor.query(
      `INSERT INTO public.work_types
        (id, code, name, description, work_type_group, required_trade_id, required_fields,
         config_version, default_duration_minutes, default_priority, is_active, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13)`,
      [
        p.id,
        p.code,
        p.name,
        p.description ?? null,
        p.group ?? null,
        p.requiredTradeId ?? null,
        JSON.stringify(p.requiredFields),
        p.configVersion,
        p.defaultDurationMinutes ?? null,
        p.defaultPriority,
        p.isActive,
        p.createdAt,
        p.updatedAt,
      ],
    );
  }

  async create(workType: WorkTypeEntity): Promise<void> {
    await this.createOnExecutor(this.pool(), workType);
  }

  async createWithClient(client: PoolClient, workType: WorkTypeEntity): Promise<void> {
    await this.createOnExecutor(client, workType);
  }

  private async saveOnExecutor(
    executor: Pool | PoolClient,
    workType: WorkTypeEntity,
    opts?: SaveWorkTypeOptions,
  ): Promise<void> {
    const p = workType.getProps();
    // Optimistic locking SQL guard: pre-check ở use-case fail-fast cho
    // sequential mismatch; guard này đóng lost update khi hai PATCH đồng thời
    // cùng version (cả hai đều pass pre-check trước khi commit).
    const guard = opts?.expectedConfigVersion !== undefined;
    const result = await executor.query(
      `UPDATE public.work_types SET code=$1, name=$2, description=$3, work_type_group=$4,
        required_trade_id=$5, required_fields=$6::jsonb, config_version=$7,
        default_duration_minutes=$8, default_priority=$9, is_active=$10, updated_at=$11
       WHERE id=$12${guard ? ' AND config_version = $13' : ''}`,
      guard
        ? [
          p.code,
          p.name,
          p.description ?? null,
          p.group ?? null,
          p.requiredTradeId ?? null,
          JSON.stringify(p.requiredFields),
          p.configVersion,
          p.defaultDurationMinutes ?? null,
          p.defaultPriority,
          p.isActive,
          p.updatedAt,
          p.id,
          opts?.expectedConfigVersion,
        ]
        : [
          p.code,
          p.name,
          p.description ?? null,
          p.group ?? null,
          p.requiredTradeId ?? null,
          JSON.stringify(p.requiredFields),
          p.configVersion,
          p.defaultDurationMinutes ?? null,
          p.defaultPriority,
          p.isActive,
          p.updatedAt,
          p.id,
        ],
    );
    if (guard && result.rowCount === 0) {
      const cur = await executor.query(
        'SELECT config_version FROM public.work_types WHERE id = $1 LIMIT 1',
        [p.id],
      );
      const current = cur.rows.length > 0 ? Number(cur.rows[0].config_version) : p.configVersion;
      throw new ConflictException({
        statusCode: 409,
        message: `Cấu hình đã bị thay đổi bởi người dùng khác (hiện tại version ${current}); vui lòng tải lại và thử lại`,
        code: 'WORK_TYPE_CONFIG_CONFLICT',
        fieldErrors: {
          expectedConfigVersion: [`Version cấu hình đã thay đổi (hiện tại: ${current})`],
        },
      });
    }
  }

  async save(workType: WorkTypeEntity, opts?: SaveWorkTypeOptions): Promise<void> {
    await this.saveOnExecutor(this.pool(), workType, opts);
  }

  async saveWithClient(client: PoolClient, workType: WorkTypeEntity, opts?: SaveWorkTypeOptions): Promise<void> {
    await this.saveOnExecutor(client, workType, opts);
  }
}
