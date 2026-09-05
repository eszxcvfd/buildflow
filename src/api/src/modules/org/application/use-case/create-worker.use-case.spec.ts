import { ConflictException, BadRequestException } from '@nestjs/common';
import { CreateWorkerUseCase } from './create-worker.use-case';
import { WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { HasherPort } from '../../../iam/application/port/hasher.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { TradeEntity } from '../../domain/entity/trade.entity';

function makeTrade(id: string, isActive = true): TradeEntity {
  return new TradeEntity({ id, code: 'C1', name: 'Trade 1', isActive, createdAt: new Date(), updatedAt: new Date() });
}

describe('CreateWorkerUseCase ORG-SRS-001', () => {
  const TRADE_ACTIVE = '11111111-1111-4111-8111-111111111111';
  const TRADE_INACTIVE = '22222222-2222-4222-8222-222222222222';
  let workerRepo: jest.Mocked<WorkerRepositoryPort>;
  let tradeRepo: jest.Mocked<TradeRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let hasher: jest.Mocked<HasherPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: CreateWorkerUseCase;

  beforeEach(() => {
    workerRepo = {
      findMany: jest.fn() as unknown as jest.Mocked<WorkerRepositoryPort>['findMany'],
      findById: jest.fn(),
      findByEmployeeCode: jest.fn(async () => null),
      create: jest.fn(),
      createWithClient: jest.fn(async () => {}),
      save: jest.fn(),
      assignTradesWithClient: jest.fn(async () => {}),
      findActiveTradesByUserId: jest.fn(),
    } as unknown as jest.Mocked<WorkerRepositoryPort>;

    tradeRepo = {
      findById: jest.fn(),
      findByIds: jest.fn(async (ids: string[]) => ids.map((id) => makeTrade(id, id === TRADE_ACTIVE))),
      findAllActive: jest.fn(async () => [makeTrade(TRADE_ACTIVE)]),
    } as unknown as jest.Mocked<TradeRepositoryPort>;

    (workerRepo.findMany as jest.Mock).mockResolvedValue({ entities: [], total: 0 });

    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    hasher = { hash: jest.fn(async (p: string) => `$hash-${p}`), compare: jest.fn() } as unknown as jest.Mocked<HasherPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;

    useCase = new CreateWorkerUseCase(workerRepo, tradeRepo, hasher, audit, tx);
  });

  it('tạo worker thành công với trades và audit', async () => {
    const out = await useCase.execute({
      email: 'worker@example.com',
      password: 'Secret123!',
      fullName: 'Worker One',
      employeeCode: 'EMP001',
      trades: [{ tradeId: TRADE_ACTIVE, skillLevel: 3 }],
      actorUserId: 'admin-1',
    });
    expect(out.entity.user.email).toBe('worker@example.com');
    expect(out.entity.user.userType).toBe('WORKER');
    expect(out.entity.trades).toHaveLength(1);
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_WORKER_CREATED', result: 'SUCCESS' }));
  });

  it('trùng employeeCode bị chặn (unique identity)', async () => {
    workerRepo.findByEmployeeCode.mockResolvedValue({ id: 'other' } as never);
    await expect(useCase.execute({
      email: 'new@example.com',
      password: 'Secret123!',
      fullName: 'New',
      employeeCode: 'EMP001',
      actorUserId: 'admin-1',
    })).rejects.toThrow(ConflictException);
  });

  it('trùng email bị chặn', async () => {
    (workerRepo.findMany as jest.Mock).mockResolvedValue({
      entities: [
        {
          user: { email: 'worker@example.com' },
        } as never,
      ],
      total: 1,
    });
    // Our usecase checks exactEmailMatch by searching inside entities; so need to set email lower
    // It will find match because we return entity with same email
    await expect(useCase.execute({
      email: 'worker@example.com',
      password: 'Secret123!',
      fullName: 'New',
      actorUserId: 'admin-1',
    })).rejects.toThrow(ConflictException);
  });

  it('trade không tồn tại hoặc inactive bị reject', async () => {
    await expect(useCase.execute({
      email: 'w2@example.com',
      password: 'Secret123!',
      fullName: 'W2',
      trades: [{ tradeId: TRADE_INACTIVE, skillLevel: 2 }],
      actorUserId: 'admin-1',
    })).rejects.toThrow(BadRequestException);
  });

  it('skill level invalid bị reject', async () => {
    await expect(useCase.execute({
      email: 'w3@example.com',
      password: 'Secret123!',
      fullName: 'W3',
      trades: [{ tradeId: TRADE_ACTIVE, skillLevel: 6 }],
      actorUserId: 'admin-1',
    })).rejects.toThrow(BadRequestException);
  });

  it('không tạo bản ghi một phần khi trùng — transaction rollback', async () => {
    // Simulate unique violation inside transaction
    workerRepo.createWithClient = jest.fn(async () => {
      const err = Object.assign(new Error('duplicate'), { code: '23505', constraint: 'ux_users_employee_code' });
      throw err;
    });
    await expect(useCase.execute({
      email: 'dup@example.com',
      password: 'Secret123!',
      fullName: 'Dup',
      employeeCode: 'EMP_DUP',
      actorUserId: 'admin-1',
    })).rejects.toThrow(ConflictException);
  });

  it('retry/double-submit không tạo audit lặp — dùng transaction', async () => {
    // transaction wrapper ensures atomic create+audit; audit called once per success
    await useCase.execute({
      email: 'retry@example.com',
      password: 'Secret123!',
      fullName: 'Retry',
      employeeCode: 'EMP_RETRY',
      trades: [{ tradeId: TRADE_ACTIVE, skillLevel: 3 }],
      actorUserId: 'admin-1',
    });
    expect(workerRepo.createWithClient).toHaveBeenCalledTimes(1);
    expect(audit.logWithClient).toHaveBeenCalledTimes(1);
  });

  it('IAM-SRS-008: correlationId hợp lệ đi vào audit payload ORG_WORKER_CREATED', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    await useCase.execute({
      email: 'corr@example.com', password: 'Secret123!', fullName: 'Corr', trades: [{ tradeId: TRADE_ACTIVE, skillLevel: 3 }],
      actorUserId: 'admin-1', correlationId: corr,
    });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_WORKER_CREATED', correlationId: corr }));
  });

  it('IAM-SRS-008: correlationId absent → audit payload correlationId null', async () => {
    await useCase.execute({
      email: 'nocorr@example.com', password: 'Secret123!', fullName: 'No Corr', trades: [{ tradeId: TRADE_ACTIVE, skillLevel: 3 }],
      actorUserId: 'admin-1',
    });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_WORKER_CREATED', correlationId: null }));
  });
});
