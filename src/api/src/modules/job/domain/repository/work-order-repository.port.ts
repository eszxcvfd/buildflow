import { PoolClient } from 'pg';
import { WorkOrderEntity } from '../entity/work-order.entity';

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
  create(workOrder: WorkOrderEntity): Promise<void>;
  createWithClient?(client: PoolClient, workOrder: WorkOrderEntity): Promise<void>;
}

export const JOB_WORK_ORDER_REPOSITORY = Symbol('JOB_WORK_ORDER_REPOSITORY');
