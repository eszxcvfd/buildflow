import { PoolClient } from 'pg';
import { ChecklistSnapshotItem } from '../service/work-order-template.policy';
import { WorkOrderTemplateEntity } from '../entity/work-order-template.entity';

export type WorkOrderTemplateFilterStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ALL';

export interface WorkOrderTemplateFilter {
  status?: WorkOrderTemplateFilterStatus;
  /** Lọc theo loại công việc (`work_type_id`). */
  workTypeId?: string;
  /** Tìm theo code/name (ILIKE). */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ActiveTradeRef {
  id: string;
  code: string;
  isActive: boolean;
}

export interface ActiveWorkTypeRef {
  id: string;
  isActive: boolean;
}

export interface ChecklistTemplateSnapshot {
  id: string;
  items: ChecklistSnapshotItem[];
}

export interface SaveWorkOrderTemplateOptions {
  /**
   * Optimistic locking SQL guard: khi gửi, `UPDATE ... WHERE id=$ AND
   * version=$expected`; rowcount 0 → 409
   * `WORK_ORDER_TEMPLATE_CONFIG_CONFLICT` (hai PATCH đồng thời cùng version
   * không còn lost update). Không gửi = last-write-wins (không guard).
   */
  expectedVersion?: number;
}

export interface WorkOrderTemplateRepositoryPort {
  findById(id: string): Promise<WorkOrderTemplateEntity | null>;
  /** Tra cứu theo code, case-insensitive (`lower(code) = lower($1)`). */
  findByCode(code: string): Promise<WorkOrderTemplateEntity | null>;
  search(filter: WorkOrderTemplateFilter): Promise<{ entities: WorkOrderTemplateEntity[]; total: number }>;
  /** Picker cho JOB (Work Order mới): chỉ ACTIVE, sắp theo name. */
  findAllActive(): Promise<WorkOrderTemplateEntity[]>;
  /**
   * Kiểm tra skill yêu cầu: đọc trực tiếp `public.trades` (org-owned) theo id.
   * Trả null khi trade không tồn tại; caller phân biệt 400 theo `isActive`.
   */
  findActiveTradeById(tradeId: string): Promise<ActiveTradeRef | null>;
  /**
   * Kiểm tra `required_skills[].code`: đọc `public.trades` theo code
   * (case-insensitive). Trả null khi không tồn tại; caller phân biệt 400
   * theo `isActive`.
   */
  findActiveTradeByCode(code: string): Promise<ActiveTradeRef | null>;
  /**
   * Kiểm tra `work_type_id`: đọc trực tiếp `public.work_types` (prj-owned).
   * Trả null khi không tồn tại; caller phân biệt 400 theo `isActive`.
   */
  findActiveWorkTypeById(workTypeId: string): Promise<ActiveWorkTypeRef | null>;
  /**
   * Kiểm tra `source_checklist_template_id`: đọc `public.checklist_templates`
   * + items (`checklist_template_items`, sắp `sequence_no`). Trả null khi
   * template không tồn tại. Items map sang shape `checklist_snapshot`
   * (snapshot-copy khi tạo — provenance, không live link).
   */
  findChecklistTemplateSnapshot(templateId: string): Promise<ChecklistTemplateSnapshot | null>;
  create(template: WorkOrderTemplateEntity): Promise<void>;
  createWithClient?(client: PoolClient, template: WorkOrderTemplateEntity): Promise<void>;
  save(template: WorkOrderTemplateEntity, opts?: SaveWorkOrderTemplateOptions): Promise<void>;
  saveWithClient?(client: PoolClient, template: WorkOrderTemplateEntity, opts?: SaveWorkOrderTemplateOptions): Promise<void>;
}

export const PRJ_WORK_ORDER_TEMPLATE_REPOSITORY = Symbol('PRJ_WORK_ORDER_TEMPLATE_REPOSITORY');
