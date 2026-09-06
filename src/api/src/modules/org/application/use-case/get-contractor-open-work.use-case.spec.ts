import { NotFoundException } from '@nestjs/common';
import { GetContractorOpenWorkUseCase } from './get-contractor-open-work.use-case';
import { ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { ContractorEntity } from '../../domain/entity/contractor.entity';

function makeContractor(): ContractorEntity {
  return new ContractorEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CTR-001',
    name: 'Alpha Construction',
    contactName: 'Nguyen Van A',
    phone: '+84901234567',
    email: 'alpha@example.com',
    status: 'ACTIVE',
    scope: 'Thi cong phan tho',
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

describe('GetContractorOpenWorkUseCase ORG-SRS-004 (issue #27)', () => {
  let repo: jest.Mocked<ContractorRepositoryPort>;
  let useCase: GetContractorOpenWorkUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn(async () => makeContractor()),
      findByCode: jest.fn(),
      findMany: jest.fn(async () => ({ entities: [], total: 0 })),
      findActiveForAssignment: jest.fn(async () => ({ entities: [], total: 0 })),
      countOpenAssignments: jest.fn(async () => 0),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      create: jest.fn(async () => {}),
    } as unknown as jest.Mocked<ContractorRepositoryPort>;
    useCase = new GetContractorOpenWorkUseCase(repo);
  });

  it('contractor tồn tại → trả {openAssignments} từ count', async () => {
    repo.countOpenAssignments.mockResolvedValue(7);
    const out = await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111' });
    expect(out).toEqual({ openAssignments: 7 });
    expect(repo.countOpenAssignments).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
  });

  it('không tìm thấy contractor → NotFound, không gọi count', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ contractorId: '00000000-0000-4000-8000-000000000000' })).rejects.toThrow(NotFoundException);
    expect(repo.countOpenAssignments).not.toHaveBeenCalled();
  });
});
