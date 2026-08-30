import { BadRequestException } from '@nestjs/common';
import { SearchContractorsUseCase } from './search-contractors.use-case';
import { ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';

describe('SearchContractorsUseCase ORG-SRS-002', () => {
  let repo: jest.Mocked<ContractorRepositoryPort>;
  let useCase: SearchContractorsUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn(),
      findByCode: jest.fn(),
      findMany: jest.fn(async () => ({ entities: [], total: 0 })),
      findActiveForAssignment: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<ContractorRepositoryPort>;
    useCase = new SearchContractorsUseCase(repo);
  });

  it('tìm kiếm với status ACTIVE và scope filter', async () => {
    await useCase.execute({ status: 'ACTIVE', scope: 'phan tho', limit: 10, offset: 0 });
    expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', scope: 'phan tho' }));
  });

  it('eligibleOnly ép filter ACTIVE', async () => {
    await useCase.execute({ eligibleOnly: true, search: 'alpha' });
    expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', search: 'alpha' }));
  });

  it('status không hợp lệ bị reject', async () => {
    await expect(useCase.execute({ status: 'UNKNOWN' as never })).rejects.toThrow(BadRequestException);
  });

  it('limit vượt 100 bị reject', async () => {
    await expect(useCase.execute({ limit: 101 })).rejects.toThrow(BadRequestException);
  });

  it('không lộ contractor ngoài scope tìm kiếm (search đúng được truyền)', async () => {
    await useCase.execute({ search: 'CTR-001' });
    expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({ search: 'CTR-001' }));
  });
});
