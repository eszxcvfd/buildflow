import { PoolClient } from 'pg';
import { WorkOrderEntity, WorkOrderStatus } from '../entity/work-order.entity';

export interface ActiveWorkTypeRef {
  id: string;
  isActive: boolean;
}

export interface ActiveAreaRef {
  id: string;
  projectId: string;
  isActive: boolean;
}

export interface ActiveTradeRef {
  id: string;
  isActive: boolean;
}

export interface ProjectStatusRef {
  id: string;
  /** Raw `public.projects.status` (`DRAFT|ACTIVE|PAUSED|COMPLETED|CLOSED`). */
  status: string;
}

/**
 * Ref hiển thị cho WO list (mirror prj `TemplateWorkTypeRef`): đọc batch
 * MỘT query (`= ANY($1::uuid[])`), tránh N+1. Không lọc `is_active` (WO có
 * thể tham chiếu loại/dự án đã ngừng mà UI vẫn phải hiện tên thay vì
 * fallback id rút gọn). `null` khi ref thiếu.
 */
export interface WorkOrderListRef {
  id: string;
  code: string;
  name: string;
}

/** Filter cho `GET /api/v1/work-orders` (list scope + status/search/pagination). */
export interface WorkOrderFilter {
  /** Scope non-ADMIN: chỉ WO của các project này (`project_id = ANY(...)`). */
  projectIds?: string[];
  /** Lọc theo 1 project (`project_id = ...`). */
  projectId?: string;
  /** Lọc trạng thái (`ALL` = không lọc). */
  status?: WorkOrderStatus | 'ALL';
  /** Tìm theo code/title (ILIKE). */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface WorkOrderRepositoryPort {
  findById(id: string): Promise<WorkOrderEntity | null>;
  /** Tra cứu theo code, case-insensitive (`lower(code) = lower($1)`). */
  findByCode(code: string): Promise<WorkOrderEntity | null>;
  /** Tra cứu theo idempotency key (`request_key`, partial unique 0009). */
  findByRequestKey(requestKey: string): Promise<WorkOrderEntity | null>;
  /**
   * Kiểm tra loại công việc: đọc trực tiếp `public.work_types` (prj-owned).
   * Trả null khi không tồn tại; caller phân biệt 400 theo `isActive`.
   */
  findActiveWorkTypeById(workTypeId: string): Promise<ActiveWorkTypeRef | null>;
  /**
   * Kiểm tra khu vực: đọc trực tiếp `public.project_areas` (prj-owned).
   * Caller yêu cầu cùng project (`projectId`) VÀ đang active.
   */
  findActiveAreaById(areaId: string): Promise<ActiveAreaRef | null>;
  /**
   * Kiểm tra skill yêu cầu: đọc trực tiếp `public.trades` (org-owned,
   * mirror `WorkTypeRepositoryPort.findActiveTradeById`).
   */
  findActiveTradeById(tradeId: string): Promise<ActiveTradeRef | null>;
  /**
   * Trạng thái dự án: đọc trực tiếp `public.projects` (prj-owned, không
   * migration mới — mirror `findActiveWorkTypeById`). Caller yêu cầu `ACTIVE`
   * khi tạo WO (flow SRS step 1 'chọn project active').
   */
  findProjectStatusById(projectId: string): Promise<ProjectStatusRef | null>;
  /** Tên loại công việc cho response summary (`workTypeName?`). */
  findWorkTypeNameById(workTypeId: string): Promise<string | null>;
  /**
   * List `GET /api/v1/work-orders` (mirror prj `WorkOrderTemplateRepositoryPort.search`):
   * filter status/projectId/scope-`projectIds`/search-ILIKE + `COUNT` total +
   * page (`ORDER BY updated_at DESC`). `projectIds` rỗng → caller trả `[]`
   * sớm (không query).
   */
  search(filter: WorkOrderFilter): Promise<{ entities: WorkOrderEntity[]; total: number }>;
  /**
   * Batch refs hiển thị cho WO list: MỘT query cho mọi id
   * (`= ANY($1::uuid[])`), tránh N+1 — mirror prj `findWorkTypeRefs`.
   * Không lọc `is_active`. Ids rỗng → map rỗng.
   */
  findWorkTypeRefs(ids: string[]): Promise<Map<string, WorkOrderListRef>>;
  /** Như `findWorkTypeRefs` nhưng đọc `public.projects` (cột hiển thị `Dự án`). */
  findProjectRefs(ids: string[]): Promise<Map<string, WorkOrderListRef>>;
  create(workOrder: WorkOrderEntity): Promise<void>;
  createWithClient?(client: PoolClient, workOrder: WorkOrderEntity): Promise<void>;
  /**
   * JOB-SRS-003 (#43) — cập nhật WO trong tx. `expectedVersion` gửi →
   * SQL guard `AND version = $N` (mirror templates `saveOnExecutor`):
   * trả về số dòng ảnh hưởng; `0` = lost-update race → caller 409
   * `WORK_ORDER_CONFLICT`. Không gửi → update không guard.
   */
  updateWithClient?(
    client: PoolClient,
    workOrder: WorkOrderEntity,
    expectedVersion?: number,
  ): Promise<number>;
}

export const JOB_WORK_ORDER_REPOSITORY = Symbol('JOB_WORK_ORDER_REPOSITORY');
