import { ConflictException, BadRequestException } from '@nestjs/common';
import { CreateTradeUseCase } from './create-trade.use-case';
import { TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { AuditLogEntity } from '../../../iam/domain/entity/audit-log.entity';

function makeTradeRepo(): jest.Mocked<TradeRepositoryPort> {
  return {
    findById: jest.fn(),
    findByIds: jest.fn(),
    findAllActive: jest.fn(),
    findByCode: jest.fn(async () => null),
    search: jest.fn(),
    create: jest.fn(),
    createWithClient: jest.fn(async () => {}),
    save: jest.fn(),
    countActiveUsage: jest.fn(async () => 0),
  } as unknown as jest.Mocked<TradeRepositoryPort>;
}

describe('CreateTradeUseCase ORG-SRS-003', () => {
  let tradeRepo: jest.Mocked<TradeRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: CreateTradeUseCase;
  const actorUserId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    tradeRepo = makeTradeRepo();
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new CreateTradeUseCase(tradeRepo, audit, tx);
  });

  it('tạo trade hợp lệ với audit ORG_TRADE_CREATED', async () => {
    const out = await useCase.execute({
      code: 'TRD-001',
      name: 'Xay dung phan tho',
      description: 'Mo ta',
      actorUserId,
    });
    expect(out.entity.code).toBe('TRD-001');
    expect(out.entity.name).toBe('Xay dung phan tho');
    expect(out.entity.isActiveStatus()).toBe(true);
    expect(out.entity.isAssignable()).toBe(true);
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_TRADE_CREATED', entityType: 'TRADE' }));
  });

  it('create mặc định ACTIVE và audit afterData đủ public fields', async () => {
    await useCase.execute({ code: 'TRD-002', name: 'Dien nuoc', actorUserId });
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as {
      action: string;
      beforeData: unknown;
      afterData: { code: string; status: string; assignable: boolean; description: string | null };
    };
    expect(call.beforeData).toBeUndefined();
    expect(call.afterData.code).toBe('TRD-002');
    expect(call.afterData.status).toBe('ACTIVE');
    expect(call.afterData.assignable).toBe(true);
    expect(call.afterData.description).toBeNull();
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('trùng mã bị chặn ConflictException (pre-check findByCode)', async () => {
    tradeRepo.findByCode.mockResolvedValue({ id: 'other' } as never);
    await expect(useCase.execute({ code: 'TRD-001', name: 'Alpha', actorUserId })).rejects.toThrow(ConflictException);
    expect(tradeRepo.createWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('code không hợp lệ bị reject', async () => {
    await expect(useCase.execute({ code: 'A', name: 'Alpha', actorUserId })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ code: 'TRD 001', name: 'Alpha', actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('name quá dài / rỗng bị reject', async () => {
    await expect(useCase.execute({ code: 'TRD-002', name: '', actorUserId })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ code: 'TRD-002', name: 'A'.repeat(121), actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('description quá 500 ký tự bị reject', async () => {
    await expect(useCase.execute({ code: 'TRD-002', name: 'Alpha', description: 'a'.repeat(501), actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('status không hợp lệ bị reject', async () => {
    await expect(useCase.execute({ code: 'TRD-002', name: 'Alpha', status: 'UNKNOWN' as never, actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('DB unique violation (23505/ux_trades) mapping sang 409, không tạo audit', async () => {
    tradeRepo.findByCode.mockResolvedValue(null);
    tradeRepo.createWithClient = jest.fn(async () => {
      const err = Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_trades_code' });
      throw err;
    });
    await expect(useCase.execute({ code: 'TRD-003', name: 'Alpha', actorUserId })).rejects.toThrow(ConflictException);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('double-submit/retry: create + audit mỗi lần chạy đúng một lần trong tx', async () => {
    await useCase.execute({ code: 'TRD-004', name: 'Beta', actorUserId });
    expect(tradeRepo.createWithClient).toHaveBeenCalledTimes(1);
    expect(audit.logWithClient).toHaveBeenCalledTimes(1);
  });

  it('IAM-SRS-008: correlationId hợp lệ đi vào audit payload; absent → null', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    await useCase.execute({ code: 'TRD-010', name: 'Corr', actorUserId, correlationId: corr });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_TRADE_CREATED', correlationId: corr }));
    (audit.logWithClient as jest.Mock).mockClear();
    await useCase.execute({ code: 'TRD-011', name: 'NoCorr', actorUserId });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_TRADE_CREATED', correlationId: null }));
  });
});