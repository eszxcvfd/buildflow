import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { UpdateContractorUseCase } from './update-contractor.use-case';
import { ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ContractorEntity } from '../../domain/entity/contractor.entity';

function makeContractor(status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'): ContractorEntity {
  return new ContractorEntity({
    id: '11111111-1111-4111-8111-111111111111',
    code: 'CTR-001',
    name: 'Alpha',
    contactName: 'A',
    phone: '+84901234567',
    email: 'a@example.com',
    status,
    scope: 'general',
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('UpdateContractorUseCase ORG-SRS-002', () => {
  let repo: jest.Mocked<ContractorRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: UpdateContractorUseCase;
  const actorUserId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    repo = {
      findById: jest.fn(async () => makeContractor()),
      findByCode: jest.fn(async () => null),
      findMany: jest.fn(),
      findActiveForAssignment: jest.fn(),
      create: jest.fn(),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      hasHistory: jest.fn(async () => false),
    } as unknown as jest.Mocked<ContractorRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new UpdateContractorUseCase(repo, audit, tx);
  });

  it('cập nhật contact + scope thành công', async () => {
    const { entity } = await useCase.execute({
      contractorId: '11111111-1111-4111-8111-111111111111',
      contactName: 'Tran B',
      scope: 'Hoan thien',
      actorUserId,
    });
    expect(entity.contactName).toBe('Tran B');
    expect(entity.scope).toBe('Hoan thien');
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CONTRACTOR_UPDATED' }));
  });

  it('đổi trạng thái ACTIVE->INACTIVE', async () => {
    const { entity } = await useCase.execute({
      contractorId: '11111111-1111-4111-8111-111111111111',
      status: 'INACTIVE',
      actorUserId,
    });
    expect(entity.isInactive()).toBe(true);
    expect(entity.isEligibleForAssignment()).toBe(false);
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CONTRACTOR_STATUS_CHANGED' }));
  });

  it('trùng status bị reject', async () => {
    await expect(useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', status: 'ACTIVE', actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('không tìm thấy contractor -> NotFound', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ contractorId: '33333333-3333-4333-8333-333333333333', actorUserId })).rejects.toThrow(NotFoundException);
  });

  it('trùng code với contractor khác bị chặn', async () => {
    repo.findByCode.mockResolvedValue({ id: 'other-id' } as never);
    await expect(useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', code: 'CTR-999', actorUserId })).rejects.toThrow(ConflictException);
  });

  it('INACTIVE contractor vẫn truy được lịch sử', async () => {
    const inactive = makeContractor('INACTIVE');
    repo.findById.mockResolvedValue(inactive);
    const fetched = await repo.findById('11111111-1111-4111-8111-111111111111');
    expect(fetched?.isInactive()).toBe(true);
    expect(fetched?.id).toBe('11111111-1111-4111-8111-111111111111');
  });
});
