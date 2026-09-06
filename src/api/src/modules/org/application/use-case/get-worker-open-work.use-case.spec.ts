import { NotFoundException } from '@nestjs/common';
import { GetWorkerOpenWorkUseCase } from './get-worker-open-work.use-case';
import { WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
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

describe('GetWorkerOpenWorkUseCase ORG-SRS-004 (issue #27)', () => {
  let repo: jest.Mocked<WorkerRepositoryPort>;
  let useCase: GetWorkerOpenWorkUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn(async () => makeWorker()),
      findMany: jest.fn(async () => ({ entities: [], total: 0 })),
      findByEmployeeCode: jest.fn(),
      countOpenAssignments: jest.fn(async () => 0),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      findActiveTradesByUserId: jest.fn(async () => []),
    } as unknown as jest.Mocked<WorkerRepositoryPort>;
    useCase = new GetWorkerOpenWorkUseCase(repo);
  });

  it('worker tồn tại → trả {openAssignments} từ count', async () => {
    repo.countOpenAssignments.mockResolvedValue(4);
    const out = await useCase.execute({ workerId: 'w1' });
    expect(out).toEqual({ openAssignments: 4 });
    expect(repo.countOpenAssignments).toHaveBeenCalledWith('w1');
  });

  it('worker tồn tại, không open work → 0', async () => {
    const out = await useCase.execute({ workerId: 'w1' });
    expect(out).toEqual({ openAssignments: 0 });
  });

  it('không tìm thấy worker → NotFound, không gọi count', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ workerId: 'missing' })).rejects.toThrow(NotFoundException);
    expect(repo.countOpenAssignments).not.toHaveBeenCalled();
  });
});
