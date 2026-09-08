import { PoolClient } from 'pg';
import { WorkTypeEntity } from '../entity/work-type.entity';

export type WorkTypeFilterStatus = 'ACTIVE' | 'INACTIVE' | 'ALL';

export interface WorkTypeFilter {
  status?: WorkTypeFilterStatus;
  /** Lọc theo nhóm công việc (`work_type_group`, so khớp chính xác). */
  group?: string;
  /** Lọc theo skill yêu cầu (`required_trade_id`). */
  tradeId?: string;
  /** Tìm theo code/name (ILIKE). */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ActiveTradeRef {
  id: string;
  isActive: boolean;
}

export interface WorkTypeRepositoryPort {
  findById(id: string): Promise<WorkTypeEntity | null>;
  /** Tra cứu theo code, case-insensitive (`lower(code) = lower($1)`). */
  findByCode(code: string): Promise<WorkTypeEntity | null>;
  search(filter: WorkTypeFilter): Promise<{ entities: WorkTypeEntity[]; total: number }>;
  /** Picker cho JOB (Work Order mới): chỉ active, sắp theo name. */
  findAllActive(): Promise<WorkTypeEntity[]>;
  /**
   * Kiểm tra skill yêu cầu: đọc trực tiếp `public.trades` (org-owned).
   * Trả null khi trade không tồn tại; caller phân biệt 400 theo `isActive`.
   * Seam contract cho JOB publish (JOB-SRS-002) — không import org module.
   */
  findActiveTradeById(tradeId: string): Promise<ActiveTradeRef | null>;
  /**
   * Đếm Work Order đang tham chiếu loại này (`work_orders.work_type_id`,
   * trừ `CANCELLED`/`CLOSED`). Module JOB chưa tồn tại nên con số hôm nay
   * phản ánh forward-ref contract; chỉ dùng cho cảnh báo phạm vi áp dụng,
   * KHÔNG chặn transition (mirror trade `countActiveUsage` semantics).
   */
  countActiveWorkOrders(workTypeId: string): Promise<number>;
  create(workType: WorkTypeEntity): Promise<void>;
  createWithClient?(client: PoolClient, workType: WorkTypeEntity): Promise<void>;
  save(workType: WorkTypeEntity): Promise<void>;
  saveWithClient?(client: PoolClient, workType: WorkTypeEntity): Promise<void>;
}

export const PRJ_WORK_TYPE_REPOSITORY = Symbol('PRJ_WORK_TYPE_REPOSITORY');
