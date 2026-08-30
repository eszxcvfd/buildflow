import { WorkerEntity } from '../../../../domain/entity/worker.entity';
import { WorkerResponseDto } from '../dto/worker.dto';

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

export function toWorkerListResponse(entities: WorkerEntity[]): WorkerResponseDto[] {
  return entities.map(toWorkerResponse);
}
