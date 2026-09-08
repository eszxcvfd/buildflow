import { ConflictException, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { WorkOrderTemplateEntity } from '../../domain/entity/work-order-template.entity';
import {
  ChecklistAnswerType,
  ChecklistSnapshotItem,
  RequiredSkillRef,
  WoTemplatePriority,
  WoTemplateStatus,
  normalizeChecklistSnapshot,
  normalizeRequiredSkills,
} from '../../domain/service/work-order-template.policy';
import {
  ActiveTradeRef,
  ActiveWorkTypeRef,
  ChecklistTemplateSnapshot,
  SaveWorkOrderTemplateOptions,
  TemplateWorkTypeRef,
  WorkOrderTemplateFilter,
  WorkOrderTemplateRepositoryPort,
} from '../../domain/repository/work-order-template-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

type Row = Record<string, unknown>;

function parseSkills(raw: unknown): RequiredSkillRef[] {
  if (raw === null || raw === undefined) return [];
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  // Shape đã validate ở app layer (policy); repo re-validate phòng thủ để
  // không bao giờ persist/audit payload sai shape khi caller bỏ qua policy.
  return normalizeRequiredSkills(value);
}

function parseChecklist(raw: unknown): ChecklistSnapshotItem[] {
  if (raw === null || raw === undefined) return [];
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return normalizeChecklistSnapshot(value);
}

function mapRow(row: Row): WorkOrderTemplateEntity {
  return new WorkOrderTemplateEntity({
    id: String(row['id']),
    code: String(row['code']),
    name: String(row['name']),
    description: (row['description'] as string | null) ?? null,
    workTypeId: (row['work_type_id'] as string | null) ?? null,
    requiredTradeId: (row['required_trade_id'] as string | null) ?? null,
    defaultDurationMinutes:
      row['default_duration_minutes'] === null || row['default_duration_minutes'] === undefined
        ? null
        : Number(row['default_duration_minutes']),
    defaultPriority: String(row['default_priority'] ?? 'NORMAL') as WoTemplatePriority,
    requiredSkills: parseSkills(row['required_skills']),
    checklistSnapshot: parseChecklist(row['checklist_snapshot']),
    sourceChecklistTemplateId: (row['source_checklist_template_id'] as string | null) ?? null,
    status: String(row['status'] ?? 'DRAFT') as WoTemplateStatus,
    version: Number(row['version'] ?? 1),
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

const TEMPLATE_COLUMNS =
  'id, code, name, description, work_type_id, required_trade_id, ' +
  'default_duration_minutes, default_priority, required_skills, checklist_snapshot, ' +
  'source_checklist_template_id, status, version, created_at, updated_at';

@Injectable()
export class PgWorkOrderTemplateRepository implements WorkOrderTemplateRepositoryPort {
  private pool(): Pool { return getPool(); }

  async findById(id: string): Promise<WorkOrderTemplateEntity | null> {
    const r = await this.pool().query(
      `SELECT ${TEMPLATE_COLUMNS} FROM public.work_order_templates WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async findByCode(code: string): Promise<WorkOrderTemplateEntity | null> {
    const r = await this.pool().query(
      `SELECT ${TEMPLATE_COLUMNS} FROM public.work_order_templates WHERE lower(code) = lower($1) LIMIT 1`,
      [code.trim()],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async search(filter: WorkOrderTemplateFilter): Promise<{ entities: WorkOrderTemplateEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.status && filter.status !== 'ALL') {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }
    if (filter.workTypeId) {
      conditions.push(`work_type_id = $${idx++}`);
      values.push(filter.workTypeId);
    }
    if (filter.search) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      conditions.push(`(lower(code) ILIKE $${idx} OR lower(name) ILIKE $${idx})`);
      values.push(term);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countR = await this.pool().query(`SELECT COUNT(*) FROM public.work_order_templates ${where}`, values);
    const total = Number(countR.rows[0].count);

    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    const dataR = await this.pool().query(
      `SELECT ${TEMPLATE_COLUMNS} FROM public.work_order_templates ${where} ORDER BY name ASC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );

    return { entities: dataR.rows.map((row: Row) => mapRow(row)), total };
  }

  async findAllActive(): Promise<WorkOrderTemplateEntity[]> {
    const r = await this.pool().query(
      `SELECT ${TEMPLATE_COLUMNS} FROM public.work_order_templates WHERE status = 'ACTIVE' ORDER BY name ASC`,
    );
    return r.rows.map((row: Row) => mapRow(row));
  }

  async findActiveTradeById(tradeId: string): Promise<ActiveTradeRef | null> {
    const r = await this.pool().query(
      'SELECT id, code, is_active FROM public.trades WHERE id = $1 LIMIT 1',
      [tradeId],
    );
    if (r.rows.length === 0) return null;
    return { id: String(r.rows[0].id), code: String(r.rows[0].code), isActive: Boolean(r.rows[0].is_active) };
  }

  async findActiveTradeByCode(code: string): Promise<ActiveTradeRef | null> {
    const r = await this.pool().query(
      'SELECT id, code, is_active FROM public.trades WHERE lower(code) = lower($1) LIMIT 1',
      [code.trim()],
    );
    if (r.rows.length === 0) return null;
    return { id: String(r.rows[0].id), code: String(r.rows[0].code), isActive: Boolean(r.rows[0].is_active) };
  }

  async findActiveWorkTypeById(workTypeId: string): Promise<ActiveWorkTypeRef | null> {
    const r = await this.pool().query(
      'SELECT id, is_active FROM public.work_types WHERE id = $1 LIMIT 1',
      [workTypeId],
    );
    if (r.rows.length === 0) return null;
    return { id: String(r.rows[0].id), isActive: Boolean(r.rows[0].is_active) };
  }

  async findWorkTypeRefs(ids: string[]): Promise<Map<string, TemplateWorkTypeRef>> {
    // Batch cho template profile enrichment: MỘT query cho mọi id, tránh N+1
    // (mirror crews `findListEnrichments`). Không lọc is_active — mẫu tham
    // chiếu loại đã ngừng vẫn hiện tên thay vì fallback id rút gọn.
    const refs = new Map<string, TemplateWorkTypeRef>();
    if (ids.length === 0) return refs;
    const r = await this.pool().query(
      'SELECT id, code, name FROM public.work_types WHERE id = ANY($1::uuid[])',
      [ids],
    );
    for (const row of r.rows as Row[]) {
      refs.set(String(row['id']), {
        id: String(row['id']),
        code: String(row['code']),
        name: String(row['name']),
      });
    }
    return refs;
  }

  async findChecklistTemplateSnapshot(templateId: string): Promise<ChecklistTemplateSnapshot | null> {
    const t = await this.pool().query(
      'SELECT id FROM public.checklist_templates WHERE id = $1 LIMIT 1',
      [templateId],
    );
    if (t.rows.length === 0) return null;
    const items = await this.pool().query(
      `SELECT title, answer_type, is_required, is_blocking, requires_photo, sequence_no
         FROM public.checklist_template_items WHERE template_id = $1 ORDER BY sequence_no ASC`,
      [templateId],
    );
    return {
      id: String(t.rows[0].id),
      items: items.rows.map((row: Row) => ({
        title: String(row['title']),
        answerType: String(row['answer_type']) as ChecklistAnswerType,
        isRequired: Boolean(row['is_required']),
        isBlocking: Boolean(row['is_blocking']),
        requiresPhoto: Boolean(row['requires_photo']),
        sequenceNo: Number(row['sequence_no']),
      })),
    };
  }

  private async createOnExecutor(executor: Pool | PoolClient, template: WorkOrderTemplateEntity): Promise<void> {
    const p = template.getProps();
    await executor.query(
      `INSERT INTO public.work_order_templates
        (id, code, name, description, work_type_id, required_trade_id,
         default_duration_minutes, default_priority, required_skills, checklist_snapshot,
         source_checklist_template_id, status, version, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15)`,
      [
        p.id,
        p.code,
        p.name,
        p.description ?? null,
        p.workTypeId ?? null,
        p.requiredTradeId ?? null,
        p.defaultDurationMinutes ?? null,
        p.defaultPriority,
        JSON.stringify(p.requiredSkills),
        JSON.stringify(p.checklistSnapshot),
        p.sourceChecklistTemplateId ?? null,
        p.status,
        p.version,
        p.createdAt,
        p.updatedAt,
      ],
    );
  }

  async create(template: WorkOrderTemplateEntity): Promise<void> {
    await this.createOnExecutor(this.pool(), template);
  }

  async createWithClient(client: PoolClient, template: WorkOrderTemplateEntity): Promise<void> {
    await this.createOnExecutor(client, template);
  }

  private async saveOnExecutor(
    executor: Pool | PoolClient,
    template: WorkOrderTemplateEntity,
    opts?: SaveWorkOrderTemplateOptions,
  ): Promise<void> {
    const p = template.getProps();
    // Optimistic locking SQL guard: pre-check ở use-case fail-fast cho
    // sequential mismatch; guard này đóng lost update khi hai PATCH đồng thời
    // cùng version (cả hai đều pass pre-check trước khi commit).
    const guard = opts?.expectedVersion !== undefined;
    const result = await executor.query(
      `UPDATE public.work_order_templates SET code=$1, name=$2, description=$3, work_type_id=$4,
        required_trade_id=$5, default_duration_minutes=$6, default_priority=$7,
        required_skills=$8::jsonb, checklist_snapshot=$9::jsonb,
        source_checklist_template_id=$10, status=$11, version=$12, updated_at=$13
       WHERE id=$14${guard ? ' AND version = $15' : ''}`,
      guard
        ? [
          p.code,
          p.name,
          p.description ?? null,
          p.workTypeId ?? null,
          p.requiredTradeId ?? null,
          p.defaultDurationMinutes ?? null,
          p.defaultPriority,
          JSON.stringify(p.requiredSkills),
          JSON.stringify(p.checklistSnapshot),
          p.sourceChecklistTemplateId ?? null,
          p.status,
          p.version,
          p.updatedAt,
          p.id,
          opts?.expectedVersion,
        ]
        : [
          p.code,
          p.name,
          p.description ?? null,
          p.workTypeId ?? null,
          p.requiredTradeId ?? null,
          p.defaultDurationMinutes ?? null,
          p.defaultPriority,
          JSON.stringify(p.requiredSkills),
          JSON.stringify(p.checklistSnapshot),
          p.sourceChecklistTemplateId ?? null,
          p.status,
          p.version,
          p.updatedAt,
          p.id,
        ],
    );
    if (guard && result.rowCount === 0) {
      const cur = await executor.query(
        'SELECT version FROM public.work_order_templates WHERE id = $1 LIMIT 1',
        [p.id],
      );
      const current = cur.rows.length > 0 ? Number(cur.rows[0].version) : p.version;
      throw new ConflictException({
        statusCode: 409,
        message: `Mẫu công việc đã bị thay đổi bởi người dùng khác (hiện tại version ${current}); vui lòng tải lại và thử lại`,
        code: 'WORK_ORDER_TEMPLATE_CONFIG_CONFLICT',
        fieldErrors: {
          expectedVersion: [`Version mẫu đã thay đổi (hiện tại: ${current})`],
        },
      });
    }
  }

  async save(template: WorkOrderTemplateEntity, opts?: SaveWorkOrderTemplateOptions): Promise<void> {
    await this.saveOnExecutor(this.pool(), template, opts);
  }

  async saveWithClient(client: PoolClient, template: WorkOrderTemplateEntity, opts?: SaveWorkOrderTemplateOptions): Promise<void> {
    await this.saveOnExecutor(client, template, opts);
  }
}
