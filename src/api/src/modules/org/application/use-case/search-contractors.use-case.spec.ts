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

  describe('ORG-SRS-005 sort + fieldErrors (issue #28)', () => {
    it('sort/order hợp lệ được forward xuống repository', async () => {
      await useCase.execute({ sort: 'name', order: 'asc' });
      expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({ sort: 'name', order: 'asc' }));
    });

    it('sort/order sai → 400 kèm fieldErrors, không gọi repository', async () => {
      const badSort = await useCase.execute({ sort: 'nope' as never }).catch((e: unknown) => e);
      expect((badSort as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Sort không hợp lệ (name|createdAt)',
        fieldErrors: { sort: ['Sort không hợp lệ (name|createdAt)'] },
      });
      const badOrder = await useCase.execute({ order: 'nope' as never }).catch((e: unknown) => e);
      expect((badOrder as BadRequestException).getResponse()).toEqual({
        statusCode: 400,
        message: 'Order không hợp lệ (asc|desc)',
        fieldErrors: { order: ['Order không hợp lệ (asc|desc)'] },
      });
      expect(repo.findMany).not.toHaveBeenCalled();
    });
  });
});
