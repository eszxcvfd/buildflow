import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { WorkOrderEntity, WorkOrderStatus } from '../../domain/entity/work-order.entity';
import { WorkOrderPriority } from '../../domain/service/work-order.policy';
import { ActiveAreaRef, ActiveTradeRef, ActiveWorkTypeRef, JobBoardFilter, JobBoardScopeFilter, WorkOrderFilter, WorkOrderListRef, WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

type Row = Record<string, unknown>;

function mapRow(row: Row): WorkOrderEntity {
  const rawCustomFields = row['custom_fields'];
  const customFields =
    rawCustomFields !== null &&
    typeof rawCustomFields === 'object' &&
    !Array.isArray(rawCustomFields)
      ? (rawCustomFields as Record<string, string | number | boolean>)
      : {};
  return WorkOrderEntity.fromPersistence({
    id: String(row['id']),
    code: String(row['code']),
    projectId: String(row['project_id']),
    areaId: (row['area_id'] as string | null) ?? null,
    workTypeId: String(row['work_type_id']),
    requiredTradeId: (row['required_trade_id'] as string | null) ?? null,
    title: String(row['title']),
    description: (row['description'] as string | null) ?? null,
    instructions: (row['instructions'] as string | null) ?? null,
    priority: String(row['priority'] ?? 'NORMAL') as WorkOrderPriority,
    status: String(row['status'] ?? 'DRAFT') as WorkOrderStatus,
    plannedStartAt: row['planned_start_at'] ? new Date(String(row['planned_start_at'])) : null,
    plannedEndAt: row['planned_end_at'] ? new Date(String(row['planned_end_at'])) : null,
    dueAt: row['due_at'] ? new Date(String(row['due_at'])) : null,
    plannedHeadcount:
      row['planned_headcount'] === null || row['planned_headcount'] === undefined
        ? null
        : Number(row['planned_headcount']),
    customFields,
    createdBy: String(row['created_by']),
    version: Number(row['version'] ?? 1),
    jobBoardOpen: Boolean(row['job_board_open'] ?? false),
    jobBoardOpenFrom: row['job_board_open_from'] ? new Date(String(row['job_board_open_from'])) : null,
    jobBoardOpenUntil: row['job_board_open_until'] ? new Date(String(row['job_board_open_until'])) : null,
    requestKey: (row['request_key'] as string | null) ?? null,
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

const WORK_ORDER_COLUMNS =
  'id, code, project_id, area_id, work_type_id, required_trade_id, title, ' +
  'description, instructions, priority, status, planned_start_at, planned_end_at, due_at, ' +
  'planned_headcount, custom_fields, created_by, version, ' +
  'job_board_open, job_board_open_from, job_board_open_until, ' +
  'request_key, created_at, updated_at';

@Injectable()
export class PgWorkOrderRepository implements WorkOrderRepositoryPort {
  private pool(): Pool { return getPool(); }

  async findById(id: string): Promise<WorkOrderEntity | null> {
    const r = await this.pool().query(
      `SELECT ${WORK_ORDER_COLUMNS} FROM public.work_orders WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async findByCode(code: string): Promise<WorkOrderEntity | null> {
    const r = await this.pool().query(
      `SELECT ${WORK_ORDER_COLUMNS} FROM public.work_orders WHERE lower(code) = lower($1) LIMIT 1`,
      [code.trim()],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async findByRequestKey(requestKey: string): Promise<WorkOrderEntity | null> {
    const r = await this.pool().query(
      `SELECT ${WORK_ORDER_COLUMNS} FROM public.work_orders WHERE request_key = $1 LIMIT 1`,
      [requestKey],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async findActiveWorkTypeById(workTypeId: string): Promise<ActiveWorkTypeRef | null> {
    const r = await this.pool().query(
      'SELECT id, is_active, required_trade_id FROM public.work_types WHERE id = $1 LIMIT 1',
      [workTypeId],
    );
    if (r.rows.length === 0) return null;
    return {
      id: String(r.rows[0].id),
      isActive: Boolean(r.rows[0].is_active),
      requiredTradeId: (r.rows[0].required_trade_id as string | null) ?? null,
    };
  }

  async findActiveAreaById(areaId: string): Promise<ActiveAreaRef | null> {
    const r = await this.pool().query(
      'SELECT id, project_id, is_active FROM public.project_areas WHERE id = $1 LIMIT 1',
      [areaId],
    );
    if (r.rows.length === 0) return null;
    return {
      id: String(r.rows[0].id),
      projectId: String(r.rows[0].project_id),
      isActive: Boolean(r.rows[0].is_active),
    };
  }

  async findActiveTradeById(tradeId: string): Promise<ActiveTradeRef | null> {
    const r = await this.pool().query(
      'SELECT id, code, name, is_active FROM public.trades WHERE id = $1 LIMIT 1',
      [tradeId],
    );
    if (r.rows.length === 0) return null;
    return {
      id: String(r.rows[0].id),
      isActive: Boolean(r.rows[0].is_active),
      code: String(r.rows[0].code),
      name: String(r.rows[0].name),
    };
  }

  async findProjectStatusById(projectId: string): Promise<{ id: string; status: string } | null> {
    const r = await this.pool().query('SELECT id, status FROM public.projects WHERE id = $1 LIMIT 1', [
      projectId,
    ]);
    if (r.rows.length === 0) return null;
    return { id: String(r.rows[0].id), status: String(r.rows[0].status) };
  }

  async findWorkTypeNameById(workTypeId: string): Promise<string | null> {
    const r = await this.pool().query('SELECT name FROM public.work_types WHERE id = $1 LIMIT 1', [
      workTypeId,
    ]);
    if (r.rows.length === 0) return null;
    return String(r.rows[0].name);
  }

  /**
   * List WO (mirror prj `pg-work-order-template.repository search`):
   * filter status/projectId/scope-`projectIds`/search-ILIKE + `COUNT` total +
   * page (`ORDER BY updated_at DESC` — WO mới/cập nhật lên đầu).
   */
  async search(filter: WorkOrderFilter): Promise<{ entities: WorkOrderEntity[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (filter.status && filter.status !== 'ALL') {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }
    if (filter.projectId) {
      conditions.push(`project_id = $${idx++}`);
      values.push(filter.projectId);
    } else if (filter.projectIds) {
      conditions.push(`project_id = ANY($${idx++}::uuid[])`);
      values.push(filter.projectIds);
    }
    if (filter.search) {
      const term = `%${filter.search.trim()}%`;
      conditions.push(`(code ILIKE $${idx} OR title ILIKE $${idx})`);
      values.push(term);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countR = await this.pool().query(`SELECT COUNT(*) FROM public.work_orders ${where}`, values);
    const total = Number(countR.rows[0].count);

    const limit = Math.min(Math.max(filter.limit ?? 20, 1), 100);
    const offset = Math.max(filter.offset ?? 0, 0);

    const dataR = await this.pool().query(
      `SELECT ${WORK_ORDER_COLUMNS} FROM public.work_orders ${where} ORDER BY updated_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );

    return { entities: dataR.rows.map((row: Row) => mapRow(row)), total };
  }

  async findWorkTypeRefs(ids: string[]): Promise<Map<string, WorkOrderListRef>> {
    const refs = new Map<string, WorkOrderListRef>();
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

  async findProjectRefs(ids: string[]): Promise<Map<string, WorkOrderListRef>> {
    const refs = new Map<string, WorkOrderListRef>();
    if (ids.length === 0) return refs;
    const r = await this.pool().query(
      'SELECT id, code, name FROM public.projects WHERE id = ANY($1::uuid[])',
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

  /**
   * JOB-SRS-006 (issue #46, BD13) — WHERE availability dùng chung giữa
   * `searchJobBoard` và `findJobBoardFilterOptions` (cùng scope +
   * availability predicate, tránh drift). `$1` luôn là `now`.
   */
  private jobBoardBaseConditions(filter: JobBoardScopeFilter): {
    conditions: string[];
    values: unknown[];
    nextIdx: number;
  } {
    return {
      conditions: [
        `w.status = 'OPEN'`,
        `w.job_board_open = true`,
        `(w.job_board_open_from IS NULL OR w.job_board_open_from <= $1)`,
        `(w.job_board_open_until IS NULL OR w.job_board_open_until > $1)`,
        `NOT EXISTS (SELECT 1 FROM public.assignments a
                       WHERE a.work_order_id = w.id
                         AND a.status IN ('PENDING_ACCEPTANCE','ACTIVE'))`,
      ],
      values: [filter.now],
      nextIdx: 2,
    };
  }

  /**
   * JOB-SRS-005 (issue #45) — list Job Board (BD5) + JOB-SRS-006 (#46, BD10/
   * BD11): availability predicate HOÀN TOÀN server-side trong SQL (KHÔNG
   * post-filter — post-filter phá `total` và page): `status='OPEN' +
   * job_board_open + trong window (from NULL hoặc <= now; until NULL hoặc
   * strict > now — biên `until==now` loại, conservative, xem ENDPOINTS §20) +
   * NOT EXISTS assignment PENDING/ACTIVE + scope (`project_id = ANY(...)`
   * chỉ non-ADMIN) + 5 chiều filter AND-compose (#46: `projectId` đơn,
   * `areaId[]`/`workTypeId[]` lặp, overlap instant trên PLANNED dates,
   * `required_trade_id = ANY(tradeIds)` cho `skill=mine`).
   * `now` do caller (use case) capture MỘT lần, truyền vào đây.
   * `COUNT` trên CÙNG where cho `total`; page
   * `ORDER BY updated_at DESC, id DESC` (tiebreak `id` deterministic — BD1).
   */
  async searchJobBoard(filter: JobBoardFilter): Promise<{ entities: WorkOrderEntity[]; total: number }> {
    const base = this.jobBoardBaseConditions({ projectIds: filter.projectIds, now: filter.now });
    const conditions = [...base.conditions];
    const values: unknown[] = [...base.values];
    let idx = base.nextIdx;
    // Scope giữ vị trí đầu (ngay sau availability) — filter không bypass.
    if (filter.projectId) {
      conditions.push(`w.project_id = $${idx++}::uuid`);
      values.push(filter.projectId);
    } else if (filter.projectIds) {
      conditions.push(`w.project_id = ANY($${idx++}::uuid[])`);
      values.push(filter.projectIds);
    }
    if (filter.areaIds) {
      conditions.push(`w.area_id = ANY($${idx++}::uuid[])`);
      values.push(filter.areaIds);
    }
    if (filter.workTypeIds) {
      conditions.push(`w.work_type_id = ANY($${idx++}::uuid[])`);
      values.push(filter.workTypeIds);
    }
    // Date filter trên PLANNED dates (overlap instant, timezone-correct —
    // BD10): row `planned_start_at IS NULL` bị loại khi có date filter
    // (conservative — không xác nhận được overlap).
    if (filter.plannedFrom || filter.plannedTo) {
      conditions.push(`w.planned_start_at IS NOT NULL`);
      if (filter.plannedTo) {
        conditions.push(`w.planned_start_at <= $${idx++}`);
        values.push(filter.plannedTo);
      }
      if (filter.plannedFrom) {
        conditions.push(`COALESCE(w.planned_end_at, w.planned_start_at) >= $${idx++}`);
        values.push(filter.plannedFrom);
      }
    }
    if (filter.requiredTradeIds) {
      conditions.push(`w.required_trade_id = ANY($${idx++}::uuid[])`);
      values.push(filter.requiredTradeIds);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const countR = await this.pool().query(
      `SELECT COUNT(*) FROM public.work_orders w ${where}`,
      values,
    );
    const total = Number(countR.rows[0].count);

    // F003 (#45) — Number.isFinite guard TRƯỚC Math.min/max: NaN/Infinity
    // (không qua controller) → dùng default, không để NaN lọt vào LIMIT/OFFSET.
    // NOTE: twin clamp trong search() của #41-44 giữ nguyên (out of scope).
    const rawLimit = Number.isFinite(filter.limit) ? filter.limit : 20;
    const limit = Math.min(Math.max(rawLimit, 1), 100);
    const rawOffset = Number.isFinite(filter.offset) ? filter.offset : 0;
    const offset = Math.max(rawOffset, 0);

    const dataR = await this.pool().query(
      `SELECT ${WORK_ORDER_COLUMNS} FROM public.work_orders w ${where} ORDER BY w.updated_at DESC, w.id DESC LIMIT $${idx++} OFFSET $${idx++}`,
      [...values, limit, offset],
    );
    return { entities: dataR.rows.map((row: Row) => mapRow(row)), total };
  }

  /**
   * JOB-SRS-006 (issue #46, BD11) — trade active của actor cho `skill=mine`:
   * điều kiện mirror org `pg-worker.repository.ts:43`
   * (`resource_type='USER' AND is_active=true`). Không lọc effective-window
   * (eligibility claim-gate thuộc #48/#49 — bridge BD11).
   */
  async findActiveTradeIdsByUserId(userId: string): Promise<string[]> {
    const r = await this.pool().query(
      `SELECT trade_id FROM public.resource_trades
        WHERE resource_type = 'USER' AND user_id = $1 AND is_active = true`,
      [userId],
    );
    return (r.rows as Row[]).map((row) => String(row['trade_id']));
  }

  /**
   * JOB-SRS-006 (issue #46, BD13) — DISTINCT nguồn filter-options trên ĐÚNG
   * WHERE availability+scope (dùng `jobBoardBaseConditions` chung với
   * `searchJobBoard`). 4 SELECT DISTINCT (bounded bởi scope+availability,
   * index `ix_work_orders_job_board` có sẵn). `required_trade_id` NULL bỏ qua.
   */
  async findJobBoardFilterOptions(filter: JobBoardScopeFilter): Promise<{
    projectIds: string[];
    areaIds: string[];
    workTypeIds: string[];
    tradeIds: string[];
  }> {
    const base = this.jobBoardBaseConditions(filter);
    const conditions = [...base.conditions];
    const values: unknown[] = [...base.values];
    let idx = base.nextIdx;
    if (filter.projectIds) {
      conditions.push(`w.project_id = ANY($${idx++}::uuid[])`);
      values.push(filter.projectIds);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const [projects, areas, workTypes, trades] = await Promise.all([
      this.pool().query(`SELECT DISTINCT w.project_id AS id FROM public.work_orders w ${where}`, values),
      this.pool().query(
        `SELECT DISTINCT w.area_id AS id FROM public.work_orders w ${where} AND w.area_id IS NOT NULL`,
        values,
      ),
      this.pool().query(`SELECT DISTINCT w.work_type_id AS id FROM public.work_orders w ${where}`, values),
      this.pool().query(
        `SELECT DISTINCT w.required_trade_id AS id FROM public.work_orders w ${where} AND w.required_trade_id IS NOT NULL`,
        values,
      ),
    ]);
    const ids = (r: { rows: Row[] }): string[] =>
      r.rows.map((row) => String(row['id'])).sort();
    return {
      projectIds: ids(projects),
      areaIds: ids(areas),
      workTypeIds: ids(workTypes),
      tradeIds: ids(trades),
    };
  }

  private async createOnExecutor(executor: Pool | PoolClient, workOrder: WorkOrderEntity): Promise<void> {
    const p = workOrder.getProps();
    await executor.query(
      `INSERT INTO public.work_orders
        (id, code, project_id, area_id, work_type_id, required_trade_id, title,
         description, instructions, priority, status, planned_start_at, planned_end_at,
         planned_headcount, custom_fields, created_by, version,
         job_board_open, job_board_open_from, job_board_open_until,
         request_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        p.id,
        p.code,
        p.projectId,
        p.areaId ?? null,
        p.workTypeId,
        p.requiredTradeId ?? null,
        p.title,
        p.description ?? null,
        p.instructions ?? null,
        p.priority,
        p.status,
        p.plannedStartAt,
        p.plannedEndAt,
        p.plannedHeadcount ?? null,
        JSON.stringify(p.customFields ?? {}),
        p.createdBy,
        p.version,
        p.jobBoardOpen ?? false,
        p.jobBoardOpenFrom ?? null,
        p.jobBoardOpenUntil ?? null,
        p.requestKey ?? null,
        p.createdAt,
        p.updatedAt,
      ],
    );
  }

  async create(workOrder: WorkOrderEntity): Promise<void> {
    await this.createOnExecutor(this.pool(), workOrder);
  }

  async createWithClient(client: PoolClient, workOrder: WorkOrderEntity): Promise<void> {
    await this.createOnExecutor(client, workOrder);
  }

  /**
   * JOB-SRS-003 (#43) — update toàn bộ cột mutable + `version`/`updated_at`
   * mới. Guard `AND version = $N` khi gửi `expectedVersion` (mirror
   * `pg-work-order-template.repository saveOnExecutor`); trả về rowCount.
   */
  async updateWithClient(
    client: PoolClient,
    workOrder: WorkOrderEntity,
    expectedVersion?: number,
  ): Promise<number> {
    const p = workOrder.getProps();
    const guard = expectedVersion !== undefined;
    const result = await client.query(
      `UPDATE public.work_orders SET code=$1, project_id=$2, area_id=$3, work_type_id=$4,
        required_trade_id=$5, title=$6, description=$7, instructions=$8, priority=$9,
        status=$10, planned_start_at=$11, planned_end_at=$12, due_at=$13,
        planned_headcount=$14, custom_fields=$15, version=$16, updated_at=$17
       WHERE id=$18${guard ? ' AND version = $19' : ''}`,
      guard
        ? [
          p.code, p.projectId, p.areaId ?? null, p.workTypeId, p.requiredTradeId ?? null,
          p.title, p.description ?? null, p.instructions ?? null, p.priority, p.status,
          p.plannedStartAt, p.plannedEndAt, p.dueAt ?? null, p.plannedHeadcount ?? null,
          JSON.stringify(p.customFields ?? {}),
          p.version, p.updatedAt, p.id, expectedVersion,
        ]
        : [
          p.code, p.projectId, p.areaId ?? null, p.workTypeId, p.requiredTradeId ?? null,
          p.title, p.description ?? null, p.instructions ?? null, p.priority, p.status,
          p.plannedStartAt, p.plannedEndAt, p.dueAt ?? null, p.plannedHeadcount ?? null,
          JSON.stringify(p.customFields ?? {}),
          p.version, p.updatedAt, p.id,
        ],
    );
    return result.rowCount ?? 0;
  }

  /**
   * JOB-SRS-004 (#44) — guarded UPDATE mở/đóng Job Board (open + close
   * chung). `updateWithClient` (#43) KHÔNG đụng các cột `job_board_*` (PATCH
   * không được clobber board — regression R3).
   */
  async updateJobBoardWithClient(
    client: PoolClient,
    input: {
      workOrderId: string;
      jobBoardOpen: boolean;
      jobBoardOpenFrom: Date | null;
      jobBoardOpenUntil: Date | null;
      toStatus: WorkOrderStatus;
      expectedVersion?: number | null;
    },
  ): Promise<number> {
    const guard = input.expectedVersion !== undefined && input.expectedVersion !== null;
    if (input.jobBoardOpen) {
      const result = await client.query(
        `UPDATE public.work_orders
            SET job_board_open = true, job_board_open_from = $2, job_board_open_until = $3,
                status = $4, version = version + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1${guard ? ' AND version = $5' : ''}
             AND job_board_open = false
             AND status IN ('DRAFT','READY','OPEN')
             AND NOT EXISTS (SELECT 1 FROM public.assignments a
                             WHERE a.work_order_id = work_orders.id
                               AND a.status IN ('PENDING_ACCEPTANCE','ACTIVE'))`,
        guard
          ? [input.workOrderId, input.jobBoardOpenFrom, input.jobBoardOpenUntil, input.toStatus, input.expectedVersion]
          : [input.workOrderId, input.jobBoardOpenFrom, input.jobBoardOpenUntil, input.toStatus],
      );
      return result.rowCount ?? 0;
    }
    const result = await client.query(
      `UPDATE public.work_orders
          SET job_board_open = false,
              status = CASE WHEN status = 'OPEN' THEN 'READY' ELSE status END,
              version = version + 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1${guard ? ' AND version = $2' : ''}
           AND job_board_open = true AND status NOT IN ('CANCELLED')`,
      guard ? [input.workOrderId, input.expectedVersion] : [input.workOrderId],
    );
    return result.rowCount ?? 0;
  }

  /**
   * JOB-SRS-004 (#44) — writer `work_order_state_history` (bảng có từ 0001
   * nhưng chưa từng có writer — R7). `reason varchar(500)` nên caller cap 500.
   */
  async insertStateHistoryWithClient(
    client: PoolClient,
    input: {
      workOrderId: string;
      fromStatus: WorkOrderStatus | null;
      toStatus: WorkOrderStatus;
      changedBy: string;
      reason: string | null;
      correlationId: string | null;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO public.work_order_state_history
         (id, work_order_id, from_status, to_status, changed_by, reason, correlation_id)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
      [
        input.workOrderId,
        input.fromStatus,
        input.toStatus,
        input.changedBy,
        input.reason,
        input.correlationId,
      ],
    );
  }

  /**
   * JOB-SRS-005 (issue #45) — batch refs cho Job Board card (BD6, mirror
   * `findProjectRefs`): `public.project_areas` / `public.trades` đều có cột
   * `id, code, name` từ baseline 0001. Không lọc `is_active`. Ids rỗng → rỗng.
   */
  async findAreaRefs(ids: string[]): Promise<Map<string, WorkOrderListRef>> {
    const refs = new Map<string, WorkOrderListRef>();
    if (ids.length === 0) return refs;
    const r = await this.pool().query(
      'SELECT id, code, name FROM public.project_areas WHERE id = ANY($1::uuid[])',
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

  async findTradeRefs(ids: string[]): Promise<Map<string, WorkOrderListRef>> {
    const refs = new Map<string, WorkOrderListRef>();
    if (ids.length === 0) return refs;
    const r = await this.pool().query(
      'SELECT id, code, name FROM public.trades WHERE id = ANY($1::uuid[])',
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

  async hasActiveAssignmentByWorkOrderIds(ids: string[]): Promise<Set<string>> {    const found = new Set<string>();
    if (ids.length === 0) return found;
    const r = await this.pool().query(
      `SELECT work_order_id FROM public.assignments
        WHERE work_order_id = ANY($1::uuid[])
          AND status IN ('PENDING_ACCEPTANCE','ACTIVE')`,
      [ids],
    );
    for (const row of r.rows as Row[]) {
      found.add(String(row['work_order_id']));
    }
    return found;
  }
}
