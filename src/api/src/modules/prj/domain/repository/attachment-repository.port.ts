import { AttachmentEntity } from '../entity/attachment.entity';

export const PRJ_ATTACHMENT_REPOSITORY = Symbol('PRJ_ATTACHMENT_REPOSITORY');

/**
 * PRJ-SRS-009 (issue #40) — attachment repository port (mirror
 * work-order-repository.port style). Đọc WO→project cho WO extension route
 * đọc trực tiếp `public.work_orders` (mirror `findActiveWorkTypeById` đọc
 * chéo bảng trong cùng adapter).
 */
export interface AttachmentRepositoryPort {
  findById(id: string): Promise<AttachmentEntity | null>;
  findByRequestKey(requestKey: string): Promise<AttachmentEntity | null>;
  /** Metadata list của project (mọi owner trong project), cả inactive. */
  listByProjectId(projectId: string): Promise<AttachmentEntity[]>;
  /** Metadata list của một work order. */
  listByWorkOrderId(workOrderId: string): Promise<AttachmentEntity[]>;
  /** Resolve project chứa WO (WO extension route); null khi WO missing. */
  findWorkOrderProjectById(workOrderId: string): Promise<{ id: string; projectId: string } | null>;
  create(entity: AttachmentEntity): Promise<void>;
  createWithClient?(client: unknown, entity: AttachmentEntity): Promise<void>;
  /**
   * Soft-retire: `is_active=false` + deactivated_*; trả về entity sau retire,
   * `alreadyInactive=true` khi đã retire trước đó (idempotent, không audit).
   */
  retireWithClient?(
    client: unknown,
    id: string,
    input: { deactivatedBy: string; deactivatedAt: Date; reason: string | null },
  ): Promise<{ entity: AttachmentEntity; alreadyInactive: boolean }>;
}
