import { CrewEntity } from '../../../../domain/entity/crew.entity';
import { CrewListEnrichment, CrewMemberRow } from '../../../../domain/repository/crew-repository.port';
import { CrewResponseDto, CrewMemberResponseDto } from '../dto/crew.dto';

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

/** ORG-05 — GET /crews: profile kèm leaderName/memberCount (thiếu map → null/0). */
export function toCrewListResponse(
  entities: CrewEntity[],
  enrichments?: Map<string, CrewListEnrichment>,
): CrewResponseDto[] {
  return entities.map((e) => {
    const enrichment = enrichments?.get(e.id);
    return {
      ...toCrewResponse(e),
      leaderName: enrichment?.leaderName ?? null,
      memberCount: enrichment?.memberCount ?? 0,
    };
  });
}

/** ORG-SRS-007 (issue #30) — map CrewMemberRow sang response DTO. */
export function toCrewMemberResponse(row: CrewMemberRow): CrewMemberResponseDto {
  return {
    id: row.id,
    userId: row.userId,
    memberRole: row.memberRole,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    isActive: row.isActive,
    addedBy: row.addedBy,
    createdAt: row.createdAt.toISOString(),
    userName: row.userName ?? null,
    userCode: row.userCode ?? null,
  };
}

export function toCrewMemberListResponse(rows: CrewMemberRow[]): CrewMemberResponseDto[] {
  return rows.map(toCrewMemberResponse);
}
