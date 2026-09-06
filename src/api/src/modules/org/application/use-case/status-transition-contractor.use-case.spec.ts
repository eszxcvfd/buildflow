import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StatusTransitionContractorUseCase, auditActionFor } from './status-transition-contractor.use-case';
import { ContractorRepositoryPort } from '../../domain/repository/contractor-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ContractorEntity } from '../../domain/entity/contractor.entity';
import { AuditLogEntity } from '../../../iam/domain/entity/audit-log.entity';
import { REASON_REQUIRED_MESSAGE, openWorkWarningText } from '../../domain/service/resource-status.policy';

function makeContractor(id: string = '11111111-1111-4111-8111-111111111111', status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'): ContractorEntity {
  return new ContractorEntity({
    id,
    code: 'CTR-001',
    name: 'Alpha Construction',
    contactName: 'Nguyen Van A',
    phone: '+84901234567',
    email: 'alpha@example.com',
    status,
    scope: 'Thi cong phan tho',
    createdBy: '22222222-2222-4222-8222-222222222222',
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

describe('StatusTransitionContractorUseCase ORG-SRS-004 (issue #27)', () => {
  let repo: jest.Mocked<ContractorRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: StatusTransitionContractorUseCase;
  const actorUserId = '22222222-2222-4222-8222-222222222222';
  const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

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
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new StatusTransitionContractorUseCase(repo, audit, tx);
  });

  it('ACTIVATE (INACTIVE -> ACTIVE): status ACTIVE, audit ORG_CONTRACTOR_REACTIVATED, không gọi countOpenAssignments', async () => {
    repo.findById.mockResolvedValue(makeContractor('11111111-1111-4111-8111-111111111111', 'INACTIVE'));
    const out = await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'ACTIVATE', actorUserId: actorUserId, correlationId: corr });
    expect(out.entity.status).toBe('ACTIVE');
    expect(out.alreadyInState).toBe(false);
    expect(out.warning).toBeUndefined();
    expect(repo.countOpenAssignments).not.toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'ORG_CONTRACTOR_REACTIVATED', correlationId: corr }),
    );
  });

  it('SUSPEND (ACTIVE -> INACTIVE) với reason: audit ORG_CONTRACTOR_SUSPENDED, reason vào payload KHÔNG vào afterData', async () => {
    const out = await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'SUSPEND', reason: 'Vi phạm hợp đồng', actorUserId: actorUserId });
    expect(out.entity.status).toBe('INACTIVE');
    expect(out.alreadyInState).toBe(false);
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as {
      action: string; reason: string | null; beforeData: { status: string }; afterData: Record<string, unknown>;
    };
    expect(call.action).toBe('ORG_CONTRACTOR_SUSPENDED');
    expect(call.reason).toBe('Vi phạm hợp đồng');
    expect(call.beforeData.status).toBe('ACTIVE');
    expect(call.afterData.status).toBe('INACTIVE');
    expect(call.afterData.reason).toBeUndefined();
    expect(AuditLogEntity.isSanitized(call.beforeData)).toBe(true);
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('TERMINATE (ACTIVE -> INACTIVE) với reason: audit ORG_CONTRACTOR_TERMINATED', async () => {
    const out = await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'TERMINATE', reason: 'Chấm dứt hợp đồng', actorUserId: actorUserId });
    expect(out.entity.status).toBe('INACTIVE');
    expect(out.alreadyInState).toBe(false);
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CONTRACTOR_TERMINATED' }));
  });

  it('SUSPEND/TERMINATE thiếu reason → 400, KHÔNG gọi save/audit', async () => {
    await expect(useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'SUSPEND', actorUserId: actorUserId })).rejects.toThrow(REASON_REQUIRED_MESSAGE);
    await expect(useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'TERMINATE', reason: '  ', actorUserId: actorUserId })).rejects.toThrow(REASON_REQUIRED_MESSAGE);
    expect(audit.logWithClient).not.toHaveBeenCalled();
    expect(repo.saveWithClient).not.toHaveBeenCalled();
  });

  it('action không hợp lệ → 400', async () => {
    await expect(useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'FOO' as never, actorUserId: actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('không tìm thấy contractor → NotFound', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ contractorId: 'missing', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId })).rejects.toThrow(NotFoundException);
  });

  it('idempotent repeat: SUSPEND khi đã INACTIVE → alreadyInState=true, KHÔNG audit', async () => {
    repo.findById.mockResolvedValue(makeContractor('11111111-1111-4111-8111-111111111111', 'INACTIVE'));
    const out = await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId });
    expect(out.alreadyInState).toBe(true);
    expect(out.entity.status).toBe('INACTIVE');
    expect(audit.logWithClient).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(repo.saveWithClient).not.toHaveBeenCalled();
    expect(repo.countOpenAssignments).not.toHaveBeenCalled();
  });

  it('idempotent repeat: TERMINATE khi đã INACTIVE → alreadyInState=true, KHÔNG audit', async () => {
    repo.findById.mockResolvedValue(makeContractor('11111111-1111-4111-8111-111111111111', 'INACTIVE'));
    const out = await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'TERMINATE', reason: 'x', actorUserId: actorUserId });
    expect(out.alreadyInState).toBe(true);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('idempotent repeat: ACTIVATE khi đã ACTIVE → alreadyInState=true, KHÔNG audit', async () => {
    const out = await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'ACTIVATE', actorUserId: actorUserId });
    expect(out.alreadyInState).toBe(true);
    expect(out.entity.status).toBe('ACTIVE');
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('SUSPEND có open work: countOpenAssignments gọi, warning trả về, _warning trong afterData pass sanitize', async () => {
    repo.countOpenAssignments.mockResolvedValue(2);
    const out = await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId });
    expect(repo.countOpenAssignments).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    expect(out.warning).toEqual({ openAssignments: 2 });
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { afterData: { _warning?: string } };
    expect(call.afterData._warning).toBe(openWorkWarningText(2));
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('SUSPEND không open work: không warning, không _warning', async () => {
    const out = await useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId });
    expect(out.warning).toBeUndefined();
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { afterData: { _warning?: string } };
    expect(call.afterData._warning).toBeUndefined();
  });

  it('countOpenAssignments lỗi (DB down) → use case REJECT, không transition, không audit', async () => {
    repo.countOpenAssignments.mockRejectedValue(new Error('db down'));
    await expect(useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId })).rejects.toThrow('db down');
    expect(repo.saveWithClient).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('audit failure → InternalServerError (tx-embedded policy)', async () => {
    (audit.logWithClient as jest.Mock).mockRejectedValueOnce(new Error('audit down'));
    await expect(useCase.execute({ contractorId: '11111111-1111-4111-8111-111111111111', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId })).rejects.toThrow('Không thể ghi nhật ký kiểm toán');
  });

  it('auditActionFor map đúng theo action', () => {
    expect(auditActionFor('ACTIVATE')).toBe('ORG_CONTRACTOR_REACTIVATED');
    expect(auditActionFor('SUSPEND')).toBe('ORG_CONTRACTOR_SUSPENDED');
    expect(auditActionFor('TERMINATE')).toBe('ORG_CONTRACTOR_TERMINATED');
  });
});
