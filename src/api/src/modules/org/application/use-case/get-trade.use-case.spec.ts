import { NotFoundException } from '@nestjs/common';
import { GetTradeUseCase } from './get-trade.use-case';
import { TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { TradeEntity } from '../../domain/entity/trade.entity';

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

describe('GetTradeUseCase ORG-SRS-003', () => {
  let repo: jest.Mocked<TradeRepositoryPort>;
  let useCase: GetTradeUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn(async () => makeTrade()),
      findByIds: jest.fn(),
      findAllActive: jest.fn(),
      findByCode: jest.fn(),
      search: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      countActiveUsage: jest.fn(async () => 0),
    } as unknown as jest.Mocked<TradeRepositoryPort>;
    useCase = new GetTradeUseCase(repo);
  });

  it('lấy trade theo id thành công', async () => {
    const { entity } = await useCase.execute({ tradeId: '11111111-1111-4111-8111-111111111111' });
    expect(entity.code).toBe('TRD-001');
    expect(entity.isAssignable()).toBe(true);
  });

  it('không tìm thấy trade -> NotFound', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ tradeId: '33333333-3333-4333-8333-333333333333' })).rejects.toThrow(NotFoundException);
  });

  it('trade inactive vẫn truy được chi tiết (lịch sử catalog)', async () => {
    repo.findById.mockResolvedValue(makeTrade(false));
    const { entity } = await useCase.execute({ tradeId: '11111111-1111-4111-8111-111111111111' });
    expect(entity.isInactive()).toBe(true);
    expect(entity.isAssignable()).toBe(false);
    expect(entity.toPublic().status).toBe('INACTIVE');
  });
});