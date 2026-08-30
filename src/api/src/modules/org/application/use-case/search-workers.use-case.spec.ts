import { BadRequestException } from '@nestjs/common';
import { SearchWorkersUseCase } from './search-workers.use-case';
import { WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { WorkerEntity } from '../../domain/entity/worker.entity';
import { UserEntity } from '../../../iam/domain/entity/user.entity';

function makeWorker(id: string, status: string, tradeId?: string): WorkerEntity {
  const user = new UserEntity({
    id,
    email: `${id}@example.com`,
    passwordHash: '$hash',
    fullName: `Worker ${id}`,
    phone: null,
    avatarUrl: null,
    employeeCode: `EMP-${id}`,
    userType: 'WORKER',
    contractorId: null,
    status: status as never,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return new WorkerEntity({
    user,
    trades: tradeId ? [{ tradeId, skillLevel: 3, effectiveFrom: new Date(), isActive: true }] : [],
  });
}

describe('SearchWorkersUseCase ORG-SRS-001', () => {
  const TRADE_ID = '11111111-1111-4111-8111-111111111111';
  let workerRepo: jest.Mocked<WorkerRepositoryPort>;
  let useCase: SearchWorkersUseCase;

  beforeEach(() => {
    workerRepo = {
      findMany: jest.fn(async (filter) => {
        // Simulate filtering is done at repository layer; return filtered mock
        const all = [makeWorker('w1', 'ACTIVE', TRADE_ID), makeWorker('w2', 'INACTIVE', TRADE_ID), makeWorker('w3', 'ACTIVE')];
        let filtered = all;
        if (filter.status) filtered = filtered.filter((w) => w.status === filter.status);
        if (filter.tradeId) filtered = filtered.filter((w) => w.trades.some((t) => t.tradeId === filter.tradeId));
        if (filter.search) filtered = filtered.filter((w) => w.fullName.toLowerCase().includes(filter.search!.toLowerCase()));
        return { entities: filtered, total: filtered.length };
      }),
      findById: jest.fn(),
      findByEmployeeCode: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findActiveTradesByUserId: jest.fn(),
    } as unknown as jest.Mocked<WorkerRepositoryPort>;

    useCase = new SearchWorkersUseCase(workerRepo);
  });

  it('CRUD/search và filter đúng', async () => {
    const out = await useCase.execute({ status: 'ACTIVE', limit: 10, offset: 0 });
    expect(out.entities.every((w) => w.status === 'ACTIVE')).toBe(true);
    expect(workerRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' }));
  });

  it('filter trade và skillLevel ở repository layer', async () => {
    await useCase.execute({ tradeId: TRADE_ID, skillLevel: 3 });
    expect(workerRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ tradeId: TRADE_ID, skillLevel: 3 }));
  });

  it('search theo tên/email/employeeCode', async () => {
    const out = await useCase.execute({ search: 'w1' });
    expect(out.entities.length).toBeGreaterThan(0);
    expect(workerRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ search: 'w1' }));
  });

  it('inactive worker vẫn search được nhưng eligible=false', async () => {
    const out = await useCase.execute({ status: 'INACTIVE' });
    expect(out.entities[0].status).toBe('INACTIVE');
    expect(out.entities[0].isEligibleForAssignment()).toBe(false);
  });

  it('validation invalid status/limit/tradeId/skillLevel', async () => {
    await expect(useCase.execute({ status: 'INVALID' })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ limit: 0 })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ limit: 101 })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ tradeId: 'not-uuid' })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ skillLevel: 6 })).rejects.toThrow(BadRequestException);
  });

  it('inactive worker bị chặn khi assign/self-claim — eligibility false', async () => {
    const inactive = makeWorker('w2', 'INACTIVE');
    expect(inactive.isEligibleForAssignment()).toBe(false);
    const active = makeWorker('w1', 'ACTIVE');
    expect(active.isEligibleForAssignment()).toBe(true);
  });
});
