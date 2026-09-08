import { WorkOrderEntity } from '../../../../domain/entity/work-order.entity';
import { WorkOrderListRef } from '../../../../domain/repository/work-order-repository.port';
import { WorkOrderResponseDto } from '../dto/work-order.dto';

export interface WorkOrderResponseOptions {
  workTypeName?: string | null;
  projectName?: string | null;
  idempotentReplay?: boolean;
}

/**
 * JOB-SRS-001 (issue #41) — map `WorkOrderEntity` sang response summary.
 * Timestamptz → ISO string (null giữ null); `requestKey` cố ý OMIT khỏi
 * response (chỉ nằm trong audit afterData phục vụ trace replay).
 */
export function toWorkOrderResponse(
  entity: WorkOrderEntity,
  options?: WorkOrderResponseOptions,
): WorkOrderResponseDto {
  const pub = entity.toPublic();
  const response: WorkOrderResponseDto = {
    id: pub.id,
    code: pub.code,
    projectId: pub.projectId,
    areaId: pub.areaId,
    workTypeId: pub.workTypeId,
    requiredTradeId: pub.requiredTradeId,
    title: pub.title,
    description: pub.description,
    instructions: pub.instructions,
    priority: pub.priority,
    status: pub.status,
    plannedStartAt: pub.plannedStartAt ? pub.plannedStartAt.toISOString() : null,
    plannedEndAt: pub.plannedEndAt ? pub.plannedEndAt.toISOString() : null,
    dueAt: pub.dueAt ? pub.dueAt.toISOString() : null,
    plannedHeadcount: pub.plannedHeadcount,
    createdBy: pub.createdBy,
    createdAt: pub.createdAt.toISOString(),
    updatedAt: pub.updatedAt.toISOString(),
    version: pub.version,
  };
  if (options?.workTypeName !== undefined) response.workTypeName = options.workTypeName;
  if (options?.projectName !== undefined) response.projectName = options.projectName;
  if (options?.idempotentReplay !== undefined) response.idempotentReplay = options.idempotentReplay;
  return response;
}

export interface WorkOrderListResponseOptions {
  workTypeRefs?: Map<string, WorkOrderListRef>;
  projectRefs?: Map<string, WorkOrderListRef>;
}

/**
 * List `GET /api/v1/work-orders` — map từng entity + refs batch (thiếu ref →
 * field `undefined`, web fallback id rút gọn — mirror prj template mapper).
 */
export function toWorkOrderListResponse(
  entities: WorkOrderEntity[],
  options?: WorkOrderListResponseOptions,
): WorkOrderResponseDto[] {
  return entities.map((entity) => {
    const pub = entity.toPublic();
    const workTypeRef = pub.workTypeId ? options?.workTypeRefs?.get(pub.workTypeId) ?? null : null;
    const projectRef = pub.projectId ? options?.projectRefs?.get(pub.projectId) ?? null : null;
    return toWorkOrderResponse(entity, {
      workTypeName: workTypeRef ? workTypeRef.name : undefined,
      projectName: projectRef ? projectRef.name : undefined,
    });
  });
}
