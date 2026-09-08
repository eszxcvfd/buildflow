import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { WorkOrderEntity, WorkOrderStatus } from '../../domain/entity/work-order.entity';
import { WorkOrderPriority } from '../../domain/service/work-order.policy';
import { ActiveAreaRef, ActiveTradeRef, ActiveWorkTypeRef, WorkOrderRepositoryPort } from '../../domain/repository/work-order-repository.port';
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
    plannedHeadcount:
      row['planned_headcount'] === null || row['planned_headcount'] === undefined
        ? null
        : Number(row['planned_headcount']),
    createdBy: String(row['created_by']),
    version: Number(row['version'] ?? 1),
    requestKey: (row['request_key'] as string | null) ?? null,
    createdAt: new Date(String(row['created_at'])),
    updatedAt: new Date(String(row['updated_at'])),
  });
}

const WORK_ORDER_COLUMNS =
  'id, code, project_id, area_id, work_type_id, required_trade_id, title, ' +
  'description, instructions, priority, status, planned_start_at, planned_end_at, ' +
  'planned_headcount, created_by, version, request_key, created_at, updated_at';

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
      'SELECT id, is_active FROM public.work_types WHERE id = $1 LIMIT 1',
      [workTypeId],
    );
    if (r.rows.length === 0) return null;
    return { id: String(r.rows[0].id), isActive: Boolean(r.rows[0].is_active) };
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
      'SELECT id, is_active FROM public.trades WHERE id = $1 LIMIT 1',
      [tradeId],
    );
    if (r.rows.length === 0) return null;
    return { id: String(r.rows[0].id), isActive: Boolean(r.rows[0].is_active) };
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

  private async createOnExecutor(executor: Pool | PoolClient, workOrder: WorkOrderEntity): Promise<void> {
    const p = workOrder.getProps();
    await executor.query(
      `INSERT INTO public.work_orders
        (id, code, project_id, area_id, work_type_id, required_trade_id, title,
         description, instructions, priority, status, planned_start_at, planned_end_at,
         planned_headcount, created_by, version, request_key, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
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
        p.createdBy,
        p.version,
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
}
