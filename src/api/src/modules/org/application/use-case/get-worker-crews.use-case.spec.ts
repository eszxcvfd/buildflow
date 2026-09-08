import { NotFoundException } from '@nestjs/common';
import { GetWorkerCrewsUseCase } from './get-worker-crews.use-case';
import { WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { CrewRepositoryPort, WorkerCrewMembership } from '../../domain/repository/crew-repository.port';
import { WorkerEntity } from '../../domain/entity/worker.entity';
import { UserEntity } from '../../../iam/domain/entity/user.entity';

function makeWorker(): WorkerEntity {
  const user = new UserEntity({
    id: 'w1',
    email: 'w@example.com',
    passwordHash: '$hash',
    fullName: 'Worker One',
    phone: null,
    avatarUrl: null,
    employeeCode: 'EMP-001',
    userType: 'WORKER',
    contractorId: null,
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
  return new WorkerEntity({ user, trades: [] });
}

function makeMembership(over: Partial<WorkerCrewMembership> = {}): WorkerCrewMembership {
  return {
    crewId: '11111111-1111-4111-8111-111111111111',
    crewCode: 'CREW-A',
    crewName: 'Đội A',
    crewStatus: 'ACTIVE',
    memberRole: 'MEMBER',
    effectiveFrom: '2026-09-01',
    effectiveTo: null,
    ...over,
  };
}

describe('GetWorkerCrewsUseCase ORG-03/ORG-05 (Worker ↔ Crew link)', () => {
  let workerRepo: jest.Mocked<WorkerRepositoryPort>;
  let crewRepo: jest.Mocked<CrewRepositoryPort>;
  let useCase: GetWorkerCrewsUseCase;

  beforeEach(() => {
    workerRepo = {
      findById: jest.fn(async () => makeWorker()),
      findMany: jest.fn(async () => ({ entities: [], total: 0 })),
      findByEmployeeCode: jest.fn(),
      countOpenAssignments: jest.fn(async () => 0),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      findActiveTradesByUserId: jest.fn(async () => []),
    } as unknown as jest.Mocked<WorkerRepositoryPort>;
    crewRepo = {
      findMembershipsByUser: jest.fn(async () => [makeMembership()]),
    } as unknown as jest.Mocked<CrewRepositoryPort>;
    useCase = new GetWorkerCrewsUseCase(workerRepo, crewRepo);
  });

  it('worker tồn tại → trả memberships (kèm crewStatus/role/dates)', async () => {
    const out = await useCase.execute({ workerId: 'w1' });
    expect(out.memberships).toHaveLength(1);
    expect(out.memberships[0]).toEqual(makeMembership());
    expect(crewRepo.findMembershipsByUser).toHaveBeenCalledWith('w1');
  });

  it('worker không là LEAD/MEMBER ở đâu → memberships rỗng (200 { data: [] })', async () => {
    crewRepo.findMembershipsByUser.mockResolvedValue([]);
    const out = await useCase.execute({ workerId: 'w1' });
    expect(out.memberships).toEqual([]);
  });

  it('giữ cả membership LEAD lẫn MEMBER (role từ repo, không ép MEMBER)', async () => {
    crewRepo.findMembershipsByUser.mockResolvedValue([
      makeMembership({ crewId: '11111111-1111-4111-8111-111111111111', memberRole: 'LEAD' }),
      makeMembership({ crewId: '22222222-2222-4222-8222-222222222222', crewCode: 'CREW-B', memberRole: 'MEMBER' }),
    ]);
    const out = await useCase.execute({ workerId: 'w1' });
    expect(out.memberships.map((m) => m.memberRole)).toEqual(['LEAD', 'MEMBER']);
  });

  it('không tìm thấy worker → NotFound, không gọi memberships', async () => {
    workerRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ workerId: 'missing' })).rejects.toThrow(NotFoundException);
    expect(crewRepo.findMembershipsByUser).not.toHaveBeenCalled();
  });

  it('read-only — không ghi audit, không mở transaction (chỉ 2 pool reads)', async () => {
    await useCase.execute({ workerId: 'w1' });
    expect(workerRepo.findById).toHaveBeenCalledTimes(1);
    expect(crewRepo.findMembershipsByUser).toHaveBeenCalledTimes(1);
    // Use case không inject AUDIT_PORT/TRANSACTION_PORT — constructor chỉ nhận 2 repo.
    expect(useCase).not.toHaveProperty('audit');
    expect(useCase).not.toHaveProperty('tx');
  });
});
