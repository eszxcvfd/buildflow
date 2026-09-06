import { CrewEntity } from '../../../../domain/entity/crew.entity';
import { CrewResponseDto } from '../dto/crew.dto';

export function toCrewResponse(entity: CrewEntity): CrewResponseDto {
  const pub = entity.toPublic();
  return {
    id: pub.id,
    code: pub.code,
    name: pub.name,
    description: pub.description,
    contractorId: pub.contractorId,
    status: pub.status,
    eligible: pub.eligible,
    leaderUserId: pub.leaderUserId,
    createdBy: pub.createdBy,
    createdAt: pub.createdAt.toISOString(),
    updatedAt: pub.updatedAt.toISOString(),
  };
}

export function toCrewListResponse(entities: CrewEntity[]): CrewResponseDto[] {
  return entities.map(toCrewResponse);
}
