import { AuditLogEntity } from '../../../../domain/entity/audit-log.entity';
import { AuditLogResponseDto } from '../dto/audit-log.dto';

export function toAuditLogResponse(entity: AuditLogEntity): AuditLogResponseDto {
  const p = entity.getProps();
  return {
    id: p.id,
    actorUserId: p.actorUserId,
    action: p.action,
    entityType: p.entityType,
    entityId: p.entityId,
    beforeData: p.beforeData,
    afterData: p.afterData,
    result: p.result,
    ipAddress: p.ipAddress,
    userAgent: p.userAgent,
    correlationId: p.correlationId,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toAuditLogListResponse(entities: AuditLogEntity[]): AuditLogResponseDto[] {
  return entities.map(toAuditLogResponse);
}
