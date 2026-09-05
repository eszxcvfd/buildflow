import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChangeTradeStatusUseCase, TRADE_IN_USE_WARNING } from './change-trade-status.use-case';
import { TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { TradeEntity } from '../../domain/entity/trade.entity';
import { AuditLogEntity } from '../../../iam/domain/entity/audit-log.entity';

function makeTrade(isActive = true): TradeEntity {
  return new TradeEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'TRD-001',
    name: 'Xay dung phan tho',
    description: 'Mo ta',
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('ChangeTradeStatusUseCase ORG-SRS-003', () => {
  let repo: jest.Mocked<TradeRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: ChangeTradeStatusUseCase;
  const actorUserId = '22222222-2222-4222-8222-222222222222';
  const tradeId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    repo = {
      findById: jest.fn(async () => makeTrade()),
      findByIds: jest.fn(),
      findAllActive: jest.fn(),
      findByCode: jest.fn(),
      search: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      saveWithClient: jest.fn(async () => {}),
      countActiveUsage: jest.fn(async () => 0),
    } as unknown as jest.Mocked<TradeRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new ChangeTradeStatusUseCase(repo, audit, tx);
  });

  it('deactivate trade chưa được dùng thành công — không warning, không _warning trong audit', async () => {
    const out = await useCase.execute({ tradeId, status: 'INACTIVE', actorUserId });
    expect(out.entity.status).toBe('INACTIVE');
    expect(out.entity.isAssignable()).toBe(false);
    expect(out.warning).toBeUndefined();
    expect(repo.countActiveUsage).toHaveBeenCalledWith(tradeId);
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { action: string; afterData: Record<string, unknown> };
    expect(call.action).toBe('ORG_TRADE_STATUS_CHANGED');
    expect(call.afterData._warning).toBeUndefined();
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('deactivate trade đang được tham chiếu (countActiveUsage>0): vẫn cho phép + warning trả về + _warning trong audit afterData', async () => {
    repo.countActiveUsage.mockResolvedValue(3);
    const out = await useCase.execute({ tradeId, status: 'INACTIVE', actorUserId });
    expect(out.entity.isInactive()).toBe(true);
    expect(out.warning).toBe(TRADE_IN_USE_WARNING);
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as {
      action: string;
      beforeData: { status: string };
      afterData: { status: string; _warning?: string };
    };
    expect(call.action).toBe('ORG_TRADE_STATUS_CHANGED');
    expect(call.beforeData.status).toBe('ACTIVE');
    expect(call.afterData.status).toBe('INACTIVE');
    expect(call.afterData._warning).toBe(TRADE_IN_USE_WARNING);
    // _warning + text tiếng Việt vẫn phải pass no-secrets sanitize
    expect(AuditLogEntity.isSanitized(call.beforeData)).toBe(true);
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('reactivate (INACTIVE->ACTIVE) bình thường, không gọi countActiveUsage, không warning', async () => {
    repo.findById.mockResolvedValue(makeTrade(false));
    const out = await useCase.execute({ tradeId, status: 'ACTIVE', actorUserId });
    expect(out.entity.isAssignable()).toBe(true);
    expect(out.warning).toBeUndefined();
    expect(repo.countActiveUsage).not.toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_TRADE_STATUS_CHANGED' }));
  });

  it('audit before/after đúng khi deactivate đang dùng và code/name giữ nguyên (không hard delete)', async () => {
    repo.countActiveUsage.mockResolvedValue(1);
    await useCase.execute({ tradeId, status: 'INACTIVE', actorUserId });
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as {
      beforeData: { code: string; name: string };
      afterData: { code: string; name: string; status: string };
    };
    expect(call.beforeData.code).toBe('TRD-001');
    expect(call.afterData.code).toBe('TRD-001');
    expect(call.beforeData.name).toBe('Xay dung phan tho');
    expect(call.afterData.name).toBe('Xay dung phan tho');
    expect(call.afterData.status).toBe('INACTIVE');
  });

  it('countActiveUsage lỗi (DB down) → use case REJECT, không deactivate, không gọi save/audit', async () => {
    repo.countActiveUsage.mockRejectedValue(new Error('db down'));
    await expect(useCase.execute({ tradeId, status: 'INACTIVE', actorUserId })).rejects.toThrow('db down');
    expect(repo.saveWithClient).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('status không hợp lệ bị reject 400', async () => {
    await expect(useCase.execute({ tradeId, status: 'UNKNOWN' as never, actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('không tìm thấy trade -> NotFound', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ tradeId, status: 'INACTIVE', actorUserId })).rejects.toThrow(NotFoundException);
  });

  it('same-status reject (400) và không ghi audit', async () => {
    await expect(useCase.execute({ tradeId, status: 'ACTIVE', actorUserId })).rejects.toThrow(BadRequestException);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('audit-once: mỗi lần chuyển trạng thái ghi đúng một audit trong tx', async () => {
    await useCase.execute({ tradeId, status: 'INACTIVE', actorUserId });
    expect(repo.saveWithClient).toHaveBeenCalledTimes(1);
    expect(audit.logWithClient).toHaveBeenCalledTimes(1);
  });

  it('IAM-SRS-008: correlationId đi vào audit payload; absent → null', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    await useCase.execute({ tradeId, status: 'INACTIVE', actorUserId, correlationId: corr });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_TRADE_STATUS_CHANGED', correlationId: corr }));
    (audit.logWithClient as jest.Mock).mockClear();
    repo.findById.mockResolvedValue(makeTrade(false)); // INACTIVE -> ACTIVE reactivation
    await useCase.execute({ tradeId, status: 'ACTIVE', actorUserId });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_TRADE_STATUS_CHANGED', correlationId: null }));
  });
});