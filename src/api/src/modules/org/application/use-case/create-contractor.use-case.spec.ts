import { ConflictException, BadRequestException } from '@nestjs/common';
import { CreateContractorUseCase } from './create-contractor.use-case';
import { ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';

describe('CreateContractorUseCase ORG-SRS-002', () => {
  let contractorRepo: jest.Mocked<ContractorRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: CreateContractorUseCase;
  const actorUserId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    contractorRepo = {
      findById: jest.fn(),
      findByCode: jest.fn(async () => null),
      findMany: jest.fn(),
      findActiveForAssignment: jest.fn(),
      create: jest.fn(),
      createWithClient: jest.fn(async () => {}),
      save: jest.fn(),
      hasHistory: jest.fn(async () => false),
    } as unknown as jest.Mocked<ContractorRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new CreateContractorUseCase(contractorRepo, audit, tx);
  });

  it('tạo contractor hợp lệ với audit', async () => {
    const out = await useCase.execute({
      code: 'CTR-001',
      name: 'Cong ty Alpha',
      contactName: 'Nguyen Van A',
      phone: '+84901234567',
      email: 'alpha@example.com',
      scope: 'Thi cong phan tho',
      actorUserId,
    });
    expect(out.entity.code).toBe('CTR-001');
    expect(out.entity.isActive()).toBe(true);
    expect(out.entity.isEligibleForAssignment()).toBe(true);
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CONTRACTOR_CREATED' }));
  });

  it('trùng mã bị chặn', async () => {
    contractorRepo.findByCode.mockResolvedValue({ id: 'other' } as never);
    await expect(useCase.execute({ code: 'CTR-001', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong', actorUserId })).rejects.toThrow(ConflictException);
  });

  it('code không hợp lệ bị reject', async () => {
    await expect(useCase.execute({ code: 'A', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong', actorUserId })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ code: 'CTR 001', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong', actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('email không hợp lệ bị reject (qua entity)', async () => {
    await expect(useCase.execute({ code: 'CTR-002', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong', email: 'bad', actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('thiếu contactName phải reject (issue #25: thiếu contact)', async () => {
    await expect(useCase.execute({ code: 'CTR-002', name: 'Alpha', scope: 'Thi cong', actorUserId } as never)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ code: 'CTR-002', name: 'Alpha', contactName: '', scope: 'Thi cong', actorUserId })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ code: 'CTR-002', name: 'Alpha', contactName: '   ', scope: 'Thi cong', actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('thiếu scope phải reject (issue #25: thiếu scope)', async () => {
    await expect(useCase.execute({ code: 'CTR-003', name: 'Alpha', contactName: 'Nguyen A', actorUserId } as never)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ code: 'CTR-003', name: 'Alpha', contactName: 'Nguyen A', scope: '', actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('không tạo bản ghi một phần khi DB unique violation', async () => {
    contractorRepo.createWithClient = jest.fn(async () => {
      const err = Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_contractors_code' });
      throw err;
    });
    // need to reset findByCode to not detect duplicate early
    contractorRepo.findByCode.mockResolvedValue(null);
    await expect(useCase.execute({ code: 'CTR-003', name: 'Alpha', contactName: 'Nguyen A', scope: 'Thi cong', actorUserId })).rejects.toThrow(ConflictException);
  });

  it('retry/double-submit không tạo audit trừu tượng lặp — dùng transaction', async () => {
    // transaction wrapper ensures atomic create+audit; we verify audit called once per success
    await useCase.execute({ code: 'CTR-004', name: 'Beta', contactName: 'Nguyen B', scope: 'Hoan thien', actorUserId });
    expect(contractorRepo.createWithClient).toHaveBeenCalledTimes(1);
    expect(audit.logWithClient).toHaveBeenCalledTimes(1);
  });

  it('IAM-SRS-008: correlationId hợp lệ đi vào audit payload ORG_CONTRACTOR_CREATED', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    await useCase.execute({ code: 'CTR-010', name: 'Corr', contactName: 'Nguyen C', scope: 'Thi cong', actorUserId, correlationId: corr });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CONTRACTOR_CREATED', correlationId: corr }));
  });

  it('IAM-SRS-008: correlationId absent → audit payload correlationId null', async () => {
    await useCase.execute({ code: 'CTR-011', name: 'NoCorr', contactName: 'Nguyen N', scope: 'Thi cong', actorUserId });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CONTRACTOR_CREATED', correlationId: null }));
  });
});
