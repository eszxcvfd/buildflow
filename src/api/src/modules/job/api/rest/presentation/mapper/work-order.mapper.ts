import { WorkOrderEntity } from '../../../../domain/entity/work-order.entity';
import { WorkOrderResponseDto } from '../dto/work-order.dto';

export interface WorkOrderResponseOptions {
  workTypeName?: string | null;
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
    plannedHeadcount: pub.plannedHeadcount,
    createdBy: pub.createdBy,
    createdAt: pub.createdAt.toISOString(),
    updatedAt: pub.updatedAt.toISOString(),
    version: pub.version,
  };
  if (options?.workTypeName !== undefined) response.workTypeName = options.workTypeName;
  if (options?.idempotentReplay !== undefined) response.idempotentReplay = options.idempotentReplay;
  return response;
}
