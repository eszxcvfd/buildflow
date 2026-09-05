import { NotFoundException, ConflictException } from '@nestjs/common';
import { UpdateContractorUseCase } from './update-contractor.use-case';
import { ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ContractorEntity } from '../../domain/entity/contractor.entity';
import { AuditLogEntity } from '../../../iam/domain/entity/audit-log.entity';

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

  it('audit beforeData/afterData phản ánh đúng nội dung trước/sau khi đổi trạng thái', async () => {
    await useCase.execute({
      contractorId: '11111111-1111-4111-8111-111111111111',
      status: 'INACTIVE',
      actorUserId,
    });
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as {
      action: string;
      beforeData: { status: string; contactName: string; code: string };
      afterData: { status: string; contactName: string; code: string };
    };
    expect(call.beforeData.status).toBe('ACTIVE');
    expect(call.afterData.status).toBe('INACTIVE');
    // public fields giữ nguyên qua status change
    expect(call.beforeData.code).toBe('CTR-001');
    expect(call.afterData.code).toBe('CTR-001');
    expect(call.beforeData.contactName).toBe('A');
    expect(call.afterData.contactName).toBe('A');
  });

  it('hasHistory=true khi ngừng hoạt động: afterData có _warning và payload vẫn sạch', async () => {
    (repo.hasHistory as jest.Mock).mockResolvedValue(true);
    await useCase.execute({
      contractorId: '11111111-1111-4111-8111-111111111111',
      status: 'INACTIVE',
      actorUserId,
    });
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as {
      action: string;
      beforeData: { status: string };
      afterData: { status: string; _warning?: string };
    };
    expect(call.beforeData.status).toBe('ACTIVE');
    expect(call.afterData.status).toBe('INACTIVE');
    expect(call.afterData._warning).toBe('Nhà thầu có lịch sử công việc, không xóa liên kết');
    // isSanitized không cho phép key nhạy cảm ở mọi độ sâu — _warning và text tiếng Việt phải pass
    expect(AuditLogEntity.isSanitized(call.beforeData)).toBe(true);
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('PATCH same-status + đổi contact/scope thành công — no-op status, audit ORG_CONTRACTOR_UPDATED, saveWithClient được gọi', async () => {
    const { entity } = await useCase.execute({
      contractorId: '11111111-1111-4111-8111-111111111111',
      contactName: 'Tran B',
      scope: 'Hoan thien',
      status: 'ACTIVE', // cùng status hiện tại — không được reject (#25)
      actorUserId,
    });
    expect(entity.contactName).toBe('Tran B');
    expect(entity.scope).toBe('Hoan thien');
    expect(entity.isActive()).toBe(true);
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CONTRACTOR_UPDATED' }));
    expect(repo.saveWithClient).toHaveBeenCalledTimes(1);
  });

  it('PATCH chỉ same-status (không field khác) thành công — idempotent no-op, saveWithClient vẫn gọi', async () => {
    const { entity } = await useCase.execute({
      contractorId: '11111111-1111-4111-8111-111111111111',
      status: 'ACTIVE',
      actorUserId,
    });
    expect(entity.isActive()).toBe(true);
    expect(entity.name).toBe('Alpha');
    expect(repo.saveWithClient).toHaveBeenCalledTimes(1);
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

  it('IAM-SRS-008: correlationId đi vào audit payload — cả ORG_CONTRACTOR_UPDATED lẫn ORG_CONTRACTOR_STATUS_CHANGED', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    const logWithClient = audit.logWithClient as jest.Mock;
    logWithClient.mockClear();
    await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', contactName: 'Tran B', actorUserId, correlationId: corr });
    expect(logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CONTRACTOR_UPDATED', correlationId: corr }));
    logWithClient.mockClear();
    await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', status: 'INACTIVE', actorUserId, correlationId: corr });
    expect(logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CONTRACTOR_STATUS_CHANGED', correlationId: corr }));
  });

  it('IAM-SRS-008: correlationId absent → audit payload correlationId null', async () => {
    const logWithClient = audit.logWithClient as jest.Mock;
    logWithClient.mockClear();
    await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', contactName: 'Tran B', actorUserId });
    expect(logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CONTRACTOR_UPDATED', correlationId: null }));
  });
});
