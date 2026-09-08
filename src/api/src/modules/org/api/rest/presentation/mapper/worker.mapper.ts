import { WorkerEntity } from '../../../../domain/entity/worker.entity';
import { WorkerCrewMembership, WorkerCrewRef } from '../../../../domain/repository/crew-repository.port';
import { WorkerCrewMembershipDto, WorkerResponseDto } from '../dto/worker.dto';

export function toWorkerResponse(entity: WorkerEntity): WorkerResponseDto {
  const pub = entity.toPublicProfile();
  return {
    id: pub.id,
    email: pub.email,
    fullName: pub.fullName,
    phone: pub.phone,
    avatarUrl: pub.avatarUrl,
    employeeCode: pub.employeeCode,
    userType: pub.userType,
    contractorId: pub.contractorId,
    status: pub.status,
    trades: pub.trades.map((t) => ({
      tradeId: t.tradeId,
      skillLevel: t.skillLevel,
      effectiveFrom: (t.effectiveFrom as Date)?.toISOString?.() ?? undefined,
      isActive: t.isActive,
    })),
    eligible: pub.eligible,
    createdAt: pub.createdAt.toISOString(),
    updatedAt: pub.updatedAt.toISOString(),
  };
}

/** ORG-05 — GET /workers/:id: profile kèm active memberships. */
export function toWorkerDetailResponse(entity: WorkerEntity, crews: WorkerCrewRef[]): WorkerResponseDto {
  return { ...toWorkerResponse(entity), crews };
}

/** ORG-05 — GET /workers: mỗi profile kèm active memberships (thiếu map → []). */
export function toWorkerListResponse(
  entities: WorkerEntity[],
  crewsByUserId?: Map<string, WorkerCrewRef[]>,
): WorkerResponseDto[] {
  return entities.map((e) => toWorkerDetailResponse(e, crewsByUserId?.get(e.id) ?? []));
}

/** ORG-03/ORG-05 — map membership sang `GET /workers/:workerId/crews` item. */
export function toWorkerCrewMembershipResponse(m: WorkerCrewMembership): WorkerCrewMembershipDto {
  return {
    crewId: m.crewId,
    crewCode: m.crewCode,
    crewName: m.crewName,
    crewStatus: m.crewStatus,
    memberRole: m.memberRole,
    effectiveFrom: m.effectiveFrom,
    effectiveTo: m.effectiveTo,
  };
}

export function toWorkerCrewMembershipListResponse(memberships: WorkerCrewMembership[]): WorkerCrewMembershipDto[] {
  return memberships.map(toWorkerCrewMembershipResponse);
}
