import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PublishCheckSnapshot } from '../../domain/service/work-order-publish-check.policy';
import { WorkOrderPublishCheckReadPort } from '../../domain/repository/work-order-publish-check.read-port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

type Row = Record<string, unknown>;

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * JOB-SRS-002 (issue #42) — PG read adapter cho publish-check: 1 query duy
 * nhất JOIN `work_orders` + `projects` + `work_types` + `project_areas` +
 * `trades` (×2: trade của work-type, trade của WO). Dùng cột hiện có, không
 * migration. Read-only (SELECT), không audit.
 */
@Injectable()
export class PgWorkOrderPublishCheckReadAdapter implements WorkOrderPublishCheckReadPort {
  private pool(): Pool {
    return getPool();
  }

  async fetchSnapshot(workOrderId: string): Promise<PublishCheckSnapshot | null> {
    const r = await this.pool().query(
      `SELECT
         wo.id AS wo_id, wo.code AS wo_code, wo.project_id AS wo_project_id,
         wo.area_id AS wo_area_id, wo.work_type_id AS wo_work_type_id,
         wo.required_trade_id AS wo_required_trade_id,
         wo.title AS wo_title, wo.description AS wo_description,
         wo.instructions AS wo_instructions, wo.priority AS wo_priority,
         wo.status AS wo_status,
         wo.planned_start_at AS wo_planned_start_at,
         wo.planned_end_at AS wo_planned_end_at,
         wo.planned_headcount AS wo_planned_headcount,
         wo.job_board_open AS wo_job_board_open,
         p.id AS p_id, p.status AS p_status,
         wt.id AS wt_id, wt.is_active AS wt_is_active,
         wt.required_trade_id AS wt_required_trade_id,
         wt.required_fields AS wt_required_fields,
         a.id AS a_id, a.project_id AS a_project_id, a.is_active AS a_is_active,
         t_wt.id AS t_wt_id, t_wt.is_active AS t_wt_is_active,
         t_wo.id AS t_wo_id, t_wo.is_active AS t_wo_is_active
       FROM public.work_orders wo
       LEFT JOIN public.projects p ON p.id = wo.project_id
       LEFT JOIN public.work_types wt ON wt.id = wo.work_type_id
       LEFT JOIN public.project_areas a ON a.id = wo.area_id
       LEFT JOIN public.trades t_wt ON t_wt.id = wt.required_trade_id
       LEFT JOIN public.trades t_wo ON t_wo.id = wo.required_trade_id
       WHERE wo.id = $1
       LIMIT 1`,
      [workOrderId],
    );
    if (r.rows.length === 0) return null;
    const row = r.rows[0] as Row;
    return {
      workOrder: {
        id: String(row['wo_id']),
        projectId: String(row['wo_project_id']),
        areaId: (row['wo_area_id'] as string | null) ?? null,
        requiredTradeId: (row['wo_required_trade_id'] as string | null) ?? null,
        title: String(row['wo_title']),
        code: String(row['wo_code']),
        description: (row['wo_description'] as string | null) ?? null,
        instructions: (row['wo_instructions'] as string | null) ?? null,
        priority: String(row['wo_priority'] ?? 'NORMAL'),
        status: String(row['wo_status'] ?? 'DRAFT'),
        plannedStartAt: toDate(row['wo_planned_start_at']),
        plannedEndAt: toDate(row['wo_planned_end_at']),
        plannedHeadcount:
          row['wo_planned_headcount'] === null || row['wo_planned_headcount'] === undefined
            ? null
            : Number(row['wo_planned_headcount']),
        jobBoardOpen: Boolean(row['wo_job_board_open']),
      },
      project:
        row['p_id'] === null || row['p_id'] === undefined
          ? null
          : { id: String(row['p_id']), status: String(row['p_status']) },
      workType:
        row['wt_id'] === null || row['wt_id'] === undefined
          ? null
          : {
              id: String(row['wt_id']),
              isActive: Boolean(row['wt_is_active']),
              requiredTradeId: (row['wt_required_trade_id'] as string | null) ?? null,
              requiredFieldsRaw: row['wt_required_fields'] ?? [],
            },
      area:
        row['a_id'] === null || row['a_id'] === undefined
          ? null
          : {
              id: String(row['a_id']),
              projectId: String(row['a_project_id']),
              isActive: Boolean(row['a_is_active']),
            },
      workTypeTrade:
        row['t_wt_id'] === null || row['t_wt_id'] === undefined
          ? null
          : { id: String(row['t_wt_id']), isActive: Boolean(row['t_wt_is_active']) },
      workOrderTrade:
        row['t_wo_id'] === null || row['t_wo_id'] === undefined
          ? null
          : { id: String(row['t_wo_id']), isActive: Boolean(row['t_wo_is_active']) },
    };
  }
}
