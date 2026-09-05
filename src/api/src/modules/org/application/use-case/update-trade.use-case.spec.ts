import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { UpdateTradeUseCase } from './update-trade.use-case';
import { TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { TradeEntity } from '../../domain/entity/trade.entity';
import { AuditLogEntity } from '../../../iam/domain/entity/audit-log.entity';

function makeTrade(): TradeEntity {
  return new TradeEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'TRD-001',
    name: 'Xay dung phan tho',
    description: 'Mo ta cu',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('UpdateTradeUseCase ORG-SRS-003', () => {
  let repo: jest.Mocked<TradeRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: UpdateTradeUseCase;
  const actorUserId = '22222222-2222-4222-8222-222222222222';
  const tradeId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    repo = {
      findById: jest.fn(async () => makeTrade()),
      findByIds: jest.fn(),
      findAllActive: jest.fn(),
      findByCode: jest.fn(async () => null),
      search: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      saveWithClient: jest.fn(async () => {}),
      countActiveUsage: jest.fn(async () => 0),
    } as unknown as jest.Mocked<TradeRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new UpdateTradeUseCase(repo, audit, tx);
  });

  it('cập nhật name + description thành công với audit ORG_TRADE_UPDATED', async () => {
    const { entity } = await useCase.execute({
      tradeId,
      name: 'Hoan thien noi that',
      description: 'Mo ta moi',
      actorUserId,
    });
    expect(entity.name).toBe('Hoan thien noi that');
    expect(entity.description).toBe('Mo ta moi');
    expect(entity.isActiveStatus()).toBe(true);
    expect(repo.saveWithClient).toHaveBeenCalledTimes(1);
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_TRADE_UPDATED' }));
  });

  it('audit beforeData/afterData phản ánh đúng nội dung trước/sau khi update', async () => {
    await useCase.execute({ tradeId, name: 'Ten moi', description: null, actorUserId });
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as {
      action: string;
      beforeData: { code: string; name: string; description: string | null; status: string };
      afterData: { code: string; name: string; description: string | null; status: string };
    };
    expect(call.beforeData.name).toBe('Xay dung phan tho');
    expect(call.afterData.name).toBe('Ten moi');
    expect(call.beforeData.description).toBe('Mo ta cu');
    expect(call.afterData.description).toBeNull();
    expect(call.beforeData.code).toBe('TRD-001');
    expect(call.afterData.code).toBe('TRD-001');
    expect(call.beforeData.status).toBe('ACTIVE');
    expect(call.afterData.status).toBe('ACTIVE');
  });

  it('đổi code thành công khi không trùng với trade khác', async () => {
    const { entity } = await useCase.execute({ tradeId, code: 'TRD-009', actorUserId });
    expect(entity.code).toBe('TRD-009');
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_TRADE_UPDATED' }));
  });

  it('trùng code với trade khác bị chặn ConflictException', async () => {
    repo.findByCode.mockResolvedValue({ id: 'other-trade-id' } as never);
    await expect(useCase.execute({ tradeId, code: 'TRD-999', actorUserId })).rejects.toThrow(ConflictException);
    expect(repo.saveWithClient).not.toHaveBeenCalled();
  });

  it('giữ nguyên code khi không đổi (exclude self)', async () => {
    await useCase.execute({ tradeId, code: 'TRD-001', name: 'Ten moi', actorUserId });
    expect(repo.findByCode).not.toHaveBeenCalled();
    expect(repo.saveWithClient).toHaveBeenCalledTimes(1);
  });

  it('không tìm thấy trade -> NotFound', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ tradeId: '33333333-3333-4333-8333-333333333333', actorUserId })).rejects.toThrow(NotFoundException);
  });

  it('name rỗng / code không hợp lệ bị reject 400', async () => {
    await expect(useCase.execute({ tradeId, name: '   ', actorUserId })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ tradeId, code: 'TRD X', actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('save gặp 23505/ux_trades mapping sang 409', async () => {
    repo.saveWithClient = jest.fn(async () => {
      const err = Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_trades_code' });
      throw err;
    });
    await expect(useCase.execute({ tradeId, code: 'TRD-200', actorUserId })).rejects.toThrow(ConflictException);
  });

  it('update chỉ-tên không tạo audit lặp — audit-once per tx', async () => {
    await useCase.execute({ tradeId, name: 'X', actorUserId });
    expect(audit.logWithClient).toHaveBeenCalledTimes(1);
  });

  it('_warning không xuất hiện trong audit ORG_TRADE_UPDATED khi update thường', async () => {
    await useCase.execute({ tradeId, name: 'Y', actorUserId });
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { afterData: Record<string, unknown> };
    expect(call.afterData._warning).toBeUndefined();
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('IAM-SRS-008: correlationId đi vào audit payload; absent → null', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    await useCase.execute({ tradeId, name: 'Corr', actorUserId, correlationId: corr });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_TRADE_UPDATED', correlationId: corr }));
    (audit.logWithClient as jest.Mock).mockClear();
    await useCase.execute({ tradeId, name: 'NoCorr', actorUserId });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_TRADE_UPDATED', correlationId: null }));
  });
});