import { BadRequestException } from '@nestjs/common';
import { SearchTradesUseCase } from './search-trades.use-case';
import { TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import { TradeEntity } from '../../domain/entity/trade.entity';

function makeTrade(code = 'TRD-001', isActive = true, idSuffix = '111111111111'): TradeEntity {
  return new TradeEntity({
    id: `11111111-1111-4111-8111-${idSuffix}`,
    code,
    name: `Trade ${code}`,
    description: null,
    isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('SearchTradesUseCase ORG-SRS-003', () => {
  let repo: jest.Mocked<TradeRepositoryPort>;
  let useCase: SearchTradesUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAllActive: jest.fn(),
      findByCode: jest.fn(),
      search: jest.fn(async () => ({ entities: [makeTrade('TRD-001', true, '111111111111'), makeTrade('TRD-002', false, '222222222222')], total: 2 })),
      create: jest.fn(),
      save: jest.fn(),
      countActiveUsage: jest.fn(async () => 0),
    } as unknown as jest.Mocked<TradeRepositoryPort>;
    useCase = new SearchTradesUseCase(repo);
  });

  it('search với status ACTIVE và search-term được truyền đúng xuống filter', async () => {
    await useCase.execute({ status: 'ACTIVE', search: 'phan tho', limit: 10, offset: 0 });
    expect(repo.search).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', search: 'phan tho', limit: 10, offset: 0 }));
  });

  it('status ALL không bị reject và được truyền xuống filter', async () => {
    await useCase.execute({ status: 'ALL' });
    expect(repo.search).toHaveBeenCalledWith(expect.objectContaining({ status: 'ALL' }));
  });

  it('trả về entities + total từ repository', async () => {
    const out = await useCase.execute({ limit: 10, offset: 0 });
    expect(out.entities).toHaveLength(2);
    expect(out.total).toBe(2);
  });

  it('status không hợp lệ bị reject', async () => {
    await expect(useCase.execute({ status: 'UNKNOWN' as never })).rejects.toThrow(BadRequestException);
  });

  it('limit ngoài khoảng 1-100 bị reject', async () => {
    await expect(useCase.execute({ limit: 0 })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ limit: 101 })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ limit: 1.5 })).rejects.toThrow(BadRequestException);
  });

  it('offset âm hoặc không nguyên bị reject', async () => {
    await expect(useCase.execute({ offset: -1 })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ offset: 1.5 })).rejects.toThrow(BadRequestException);
  });

  it('limit/offset hợp lệ ở biên được chấp nhận', async () => {
    await useCase.execute({ limit: 1, offset: 0 });
    await useCase.execute({ limit: 100, offset: 500 });
    expect(repo.search).toHaveBeenCalledTimes(2);
  });
});