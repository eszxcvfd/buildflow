import { AttachmentEntity } from '../../../../domain/entity/attachment.entity';
import { AttachmentResponseDto } from '../dto/attachment.dto';

/** PRJ-SRS-009 (issue #40) — entity → response (không lộ storageKey/path). */
export function toAttachmentResponse(
  entity: AttachmentEntity,
  extra?: { idempotentReplay?: boolean; alreadyInactive?: boolean },
): AttachmentResponseDto {
  return {
    id: entity.id,
    projectId: entity.projectId,
    workOrderId: entity.workOrderId,
    ownerType: entity.ownerType,
    fileName: entity.fileName,
    mimeType: entity.mimeType,
    sizeBytes: entity.sizeBytes,
    caption: entity.caption,
    isActive: entity.isActive,
    deactivatedAt: entity.deactivatedAt ? entity.deactivatedAt.toISOString() : null,
    deactivatedBy: entity.deactivatedBy,
    deactivateReason: entity.deactivateReason,
    createdAt: entity.createdAt.toISOString(),
    ...(extra?.idempotentReplay ? { idempotentReplay: true } : {}),
    ...(extra?.alreadyInactive ? { alreadyInactive: true } : {}),
  };
}

export function toAttachmentListResponse(entities: AttachmentEntity[]): { data: AttachmentResponseDto[]; total: number } {
  return { data: entities.map((e) => toAttachmentResponse(e)), total: entities.length };
}
