import { WorkOrderTemplateEntity } from '../../../../domain/entity/work-order-template.entity';
import { TemplateWorkTypeRef } from '../../../../domain/repository/work-order-template-repository.port';
import { WorkOrderTemplateResponseDto } from '../dto/work-order-template.dto';

export interface WorkOrderTemplateResponseOptions {
  alreadyInState?: boolean;
  /** Enrichment `workType` từ use-case (thiếu → `workType: null`). */
  workTypeRefs?: Map<string, TemplateWorkTypeRef>;
}

/**
 * PRJ-SRS-008 (issue #39) — map `WorkOrderTemplateEntity` sang response DTO.
 * Timestamptz → ISO string; `requiredSkills`/`checklistSnapshot`/`version` luôn
 * kèm theo để JOB prefill copy giá trị từ API thật (JOB-SRS-001).
 */
export function toWorkOrderTemplateResponse(
  entity: WorkOrderTemplateEntity,
  options?: WorkOrderTemplateResponseOptions,
): WorkOrderTemplateResponseDto {
  const pub = entity.toPublic();
  const ref = pub.workTypeId ? options?.workTypeRefs?.get(pub.workTypeId) ?? null : null;
  const response: WorkOrderTemplateResponseDto = {
    id: pub.id,
    code: pub.code,
    name: pub.name,
    description: pub.description,
    workTypeId: pub.workTypeId,
    workType: ref ? { id: ref.id, code: ref.code, name: ref.name } : null,
    requiredTradeId: pub.requiredTradeId,
    defaultDurationMinutes: pub.defaultDurationMinutes,
    defaultPriority: pub.defaultPriority,
    requiredSkills: pub.requiredSkills.map((s) => ({ code: s.code, label: s.label })),
    checklistSnapshot: pub.checklistSnapshot.map((c) => ({
      title: c.title,
      answerType: c.answerType,
      isRequired: c.isRequired,
      isBlocking: c.isBlocking,
      requiresPhoto: c.requiresPhoto,
      sequenceNo: c.sequenceNo,
    })),
    sourceChecklistTemplateId: pub.sourceChecklistTemplateId,
    status: pub.status,
    version: pub.version,
    usableForNewWorkOrder: pub.usableForNewWorkOrder,
    createdAt: pub.createdAt.toISOString(),
    updatedAt: pub.updatedAt.toISOString(),
  };
  if (options?.alreadyInState !== undefined) response.alreadyInState = options.alreadyInState;
  return response;
}

export function toWorkOrderTemplateListResponse(
  entities: WorkOrderTemplateEntity[],
  workTypeRefs?: Map<string, TemplateWorkTypeRef>,
): WorkOrderTemplateResponseDto[] {
  return entities.map((entity) => toWorkOrderTemplateResponse(entity, { workTypeRefs }));
}
