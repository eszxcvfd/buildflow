import { WorkTypeEntity } from '../../../../domain/entity/work-type.entity';
import { WorkTypeResponseDto } from '../dto/work-type.dto';

export interface WorkTypeResponseOptions {
  warning?: string;
  usage?: { workOrders: number };
  alreadyInState?: boolean;
}

/**
 * PRJ-SRS-004 (issue #35) — map `WorkTypeEntity` sang response DTO.
 * Timestamptz → ISO string; `requiredFields`/`configVersion` luôn kèm theo
 * để JOB publish + picker render field theo type từ API thật.
 */
export function toWorkTypeResponse(
  entity: WorkTypeEntity,
  options?: WorkTypeResponseOptions,
): WorkTypeResponseDto {
  const pub = entity.toPublic();
  const response: WorkTypeResponseDto = {
    id: pub.id,
    code: pub.code,
    name: pub.name,
    description: pub.description,
    group: pub.group,
    requiredTradeId: pub.requiredTradeId,
    requiredFields: pub.requiredFields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options,
    })),
    configVersion: pub.configVersion,
    defaultDurationMinutes: pub.defaultDurationMinutes,
    defaultPriority: pub.defaultPriority,
    status: pub.status,
    usableForNewWorkOrder: pub.usableForNewWorkOrder,
    createdAt: pub.createdAt.toISOString(),
    updatedAt: pub.updatedAt.toISOString(),
  };
  if (options?.usage) response.usage = options.usage;
  if (options?.warning) response.warning = options.warning;
  if (options?.alreadyInState !== undefined) response.alreadyInState = options.alreadyInState;
  return response;
}

export function toWorkTypeListResponse(
  entities: WorkTypeEntity[],
): WorkTypeResponseDto[] {
  return entities.map((entity) => toWorkTypeResponse(entity));
}
