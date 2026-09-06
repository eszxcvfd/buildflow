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

  describe('ORG-SRS-005 sort + fieldErrors (issue #28)', () => {
    it('sort/order hợp lệ được forward xuống repository', async () => {
      await useCase.execute({ sort: 'name', order: 'asc' });
      expect(workerRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ sort: 'name', order: 'asc' }));
      await useCase.execute({ sort: 'createdAt', order: 'desc' });
      expect(workerRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ sort: 'createdAt', order: 'desc' }));
    });

    it('sort/order sai → 400 kèm fieldErrors, không gọi repository', async () => {
      const badSort = await useCase.execute({ sort: 'salary' as never }).catch((e: unknown) => e);
      expect(badSort).toBeInstanceOf(BadRequestException);
      expect((badSort as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Sort không hợp lệ (name|createdAt)',
        fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] },
      });
      const badOrder = await useCase.execute({ order: 'sideways' as never }).catch((e: unknown) => e);
      expect((badOrder as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Order không hợp lệ (asc|desc)',
        fieldErrors: { order: ['Order không hợp lệ (asc|desc)'] },
      });
      expect(workerRepo.findMany).not.toHaveBeenCalled();
    });
  });

  it('inactive worker bị chặn khi assign/self-claim — eligibility false', async () => {
    const inactive = makeWorker('w2', 'INACTIVE');
    expect(inactive.isEligibleForAssignment()).toBe(false);
    const active = makeWorker('w1', 'ACTIVE');
    expect(active.isEligibleForAssignment()).toBe(true);
  });

  it('ORG-SRS-007 (issue #30, D9): crewId hợp lệ forward; sai → 400 fieldErrors', async () => {
    const crewId = '22222222-2222-4222-8222-222222222222';
    await useCase.execute({ crewId });
    expect(workerRepo.findMany).toHaveBeenCalledWith(expect.objectContaining({ crewId }));
    const err = await useCase.execute({ crewId: 'not-uuid' }).catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Crew ID không hợp lệ',
      fieldErrors: { crewId: ['Crew ID không hợp lệ'] },
    });
  });
});
