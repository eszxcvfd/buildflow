import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StatusTransitionWorkerUseCase, auditActionFor } from './status-transition-worker.use-case';
import { WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { WorkerEntity } from '../../domain/entity/worker.entity';
import { UserEntity } from '../../../iam/domain/entity/user.entity';
import { AuditLogEntity } from '../../../iam/domain/entity/audit-log.entity';
import { REASON_REQUIRED_MESSAGE, openWorkWarningText } from '../../domain/service/resource-status.policy';

function makeWorker(id: string = 'w1', status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE', lockedUntil: Date | null = null): WorkerEntity {
  const user = new UserEntity({
    id,
    email: 'w@example.com',
    passwordHash: '$hash',
    fullName: 'Worker One',
    phone: null,
    avatarUrl: null,
    employeeCode: 'EMP-001',
    userType: 'WORKER',
    contractorId: null,
    status,
    failedLoginCount: 0,
    lockedUntil,
    lastLoginAt: null,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
  return new WorkerEntity({
    user,
    trades: [{ tradeId: '11111111-1111-4111-8111-111111111111', skillLevel: 3, effectiveFrom: new Date(), isActive: true }],
  });
}

describe('StatusTransitionWorkerUseCase ORG-SRS-004 (issue #27)', () => {
  let repo: jest.Mocked<WorkerRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: StatusTransitionWorkerUseCase;
  const actorUserId = '22222222-2222-4222-8222-222222222222';
  const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

  beforeEach(() => {
    repo = {
      findById: jest.fn(async () => makeWorker()),
      findMany: jest.fn(async () => ({ entities: [], total: 0 })),
      findByEmployeeCode: jest.fn(),
      countOpenAssignments: jest.fn(async () => 0),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      findActiveTradesByUserId: jest.fn(async () => []),
    } as unknown as jest.Mocked<WorkerRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new StatusTransitionWorkerUseCase(repo, audit, tx);
  });

  it('ACTIVATE (INACTIVE -> ACTIVE): reason optional, status ACTIVE, audit ORG_WORKER_REACTIVATED, không gọi countOpenAssignments', async () => {
    repo.findById.mockResolvedValue(makeWorker('w1', 'INACTIVE'));
    const out = await useCase.execute({ workerId: 'w1', action: 'ACTIVATE', actorUserId: actorUserId, correlationId: corr });
    expect(out.entity.status).toBe('ACTIVE');
    expect(out.alreadyInState).toBe(false);
    expect(out.warning).toBeUndefined();
    expect(repo.countOpenAssignments).not.toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'ORG_WORKER_REACTIVATED', reason: null, correlationId: corr }),
    );
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { afterData: { status: string } };
    expect(call.afterData.status).toBe('ACTIVE');
  });

  it('SUSPEND (ACTIVE -> INACTIVE) với reason: audit ORG_WORKER_SUSPENDED, reason vào payload, KHÔNG vào afterData', async () => {
    const out = await useCase.execute({ workerId: 'w1', action: 'SUSPEND', reason: 'Vắng mặt dài hạn', actorUserId: actorUserId });
    expect(out.entity.status).toBe('INACTIVE');
    expect(out.alreadyInState).toBe(false);
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as {
      action: string; reason: string | null; beforeData: { status: string }; afterData: Record<string, unknown>;
    };
    expect(call.action).toBe('ORG_WORKER_SUSPENDED');
    expect(call.reason).toBe('Vắng mặt dài hạn');
    expect(call.beforeData.status).toBe('ACTIVE');
    expect(call.afterData.status).toBe('INACTIVE');
    // KHÔNG đưa reason vào before/afterData (tránh lệch sanitize/leak guard)
    expect(call.afterData.reason).toBeUndefined();
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('TERMINATE (ACTIVE -> INACTIVE) với reason: audit ORG_WORKER_TERMINATED', async () => {
    const out = await useCase.execute({ workerId: 'w1', action: 'TERMINATE', reason: 'Hết hợp đồng', actorUserId: actorUserId });
    expect(out.entity.status).toBe('INACTIVE');
    expect(out.alreadyInState).toBe(false);
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_WORKER_TERMINATED' }));
  });

  it('SUSPEND/TERMINATE thiếu reason → 400 và KHÔNG gọi repository/audit', async () => {
    await expect(useCase.execute({ workerId: 'w1', action: 'SUSPEND', actorUserId: actorUserId })).rejects.toThrow(REASON_REQUIRED_MESSAGE);
    await expect(useCase.execute({ workerId: 'w1', action: 'TERMINATE', actorUserId: actorUserId })).rejects.toThrow(REASON_REQUIRED_MESSAGE);
    expect(audit.logWithClient).not.toHaveBeenCalled();
    expect(repo.saveWithClient).not.toHaveBeenCalled();
  });

  it('reason chỉ gồm khoảng trắng cũng bị coi là thiếu → 400', async () => {
    await expect(useCase.execute({ workerId: 'w1', action: 'SUSPEND', reason: '   ', actorUserId: actorUserId })).rejects.toThrow(REASON_REQUIRED_MESSAGE);
  });

  it('action không hợp lệ → 400', async () => {
    await expect(useCase.execute({ workerId: 'w1', action: 'FOO' as never, actorUserId: actorUserId })).rejects.toThrow(BadRequestException);
  });

  it('không tìm thấy worker → NotFound', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ workerId: 'missing', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId })).rejects.toThrow(NotFoundException);
  });

  it('idempotent repeat: SUSPEND khi đã INACTIVE → 200 alreadyInState=true, KHÔNG audit, KHÔNG changeStatus/save', async () => {
    repo.findById.mockResolvedValue(makeWorker('w1', 'INACTIVE'));
    const out = await useCase.execute({ workerId: 'w1', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId });
    expect(out.alreadyInState).toBe(true);
    expect(out.entity.status).toBe('INACTIVE');
    expect(audit.logWithClient).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(repo.saveWithClient).not.toHaveBeenCalled();
  });

  it('idempotent repeat: TERMINATE khi đã INACTIVE → alreadyInState=true không audit', async () => {
    repo.findById.mockResolvedValue(makeWorker('w1', 'INACTIVE'));
    const out = await useCase.execute({ workerId: 'w1', action: 'TERMINATE', reason: 'x', actorUserId: actorUserId });
    expect(out.alreadyInState).toBe(true);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('idempotent repeat: ACTIVATE khi đã ACTIVE → alreadyInState=true không audit', async () => {
    const out = await useCase.execute({ workerId: 'w1', action: 'ACTIVATE', actorUserId: actorUserId });
    expect(out.alreadyInState).toBe(true);
    expect(out.entity.status).toBe('ACTIVE');
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('SUSPEND khi có open work: warning trả về + countOpenAssignments được gọi + _warning trong afterData pass sanitize', async () => {
    repo.countOpenAssignments.mockResolvedValue(3);
    const out = await useCase.execute({ workerId: 'w1', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId });
    expect(repo.countOpenAssignments).toHaveBeenCalledWith('w1');
    expect(out.warning).toEqual({ openAssignments: 3 });
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { afterData: { _warning?: string } };
    expect(call.afterData._warning).toBe(openWorkWarningText(3));
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('SUSPEND khi không open work: không warning, không _warning', async () => {
    const out = await useCase.execute({ workerId: 'w1', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId });
    expect(out.warning).toBeUndefined();
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { afterData: { _warning?: string } };
    expect(call.afterData._warning).toBeUndefined();
  });

  it('ACTIVATE xóa locked_until nếu có (giữ hành vi changeStatus hiện có của UserEntity)', async () => {
    // worker đang INACTIVE nhưng còn locked_until trong quá khứ/future (dữ liệu lệch):
    // ACTIVATE qua changeStatus phải xóa locked_until + reset failedLoginCount.
    repo.findById.mockResolvedValue(makeWorker('w1', 'INACTIVE', new Date('2030-01-01T00:00:00.000Z')));
    const out = await useCase.execute({ workerId: 'w1', action: 'ACTIVATE', actorUserId: actorUserId });
    expect(out.entity.status).toBe('ACTIVE');
    expect(out.entity.user.lockedUntil).toBeNull();
    expect(out.entity.user.failedLoginCount).toBe(0);
  });

  it('audit failure → InternalServerError (tx-embedded policy), mutation KHÔNG commit', async () => {
    (audit.logWithClient as jest.Mock).mockRejectedValueOnce(new Error('audit down'));
    await expect(useCase.execute({ workerId: 'w1', action: 'SUSPEND', reason: 'x', actorUserId: actorUserId })).rejects.toThrow('Không thể ghi nhật ký kiểm toán');
  });

  it('auditActionFor map đúng theo action', () => {
    expect(auditActionFor('ACTIVATE')).toBe('ORG_WORKER_REACTIVATED');
    expect(auditActionFor('SUSPEND')).toBe('ORG_WORKER_SUSPENDED');
    expect(auditActionFor('TERMINATE')).toBe('ORG_WORKER_TERMINATED');
  });
});
