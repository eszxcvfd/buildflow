import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StatusTransitionCrewUseCase, auditActionFor } from './status-transition-crew.use-case';
import { CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { CrewEntity } from '../../domain/entity/crew.entity';
import { AuditLogEntity } from '../../../iam/domain/entity/audit-log.entity';
import { REASON_REQUIRED_MESSAGE, openWorkWarningText } from '../../domain/service/resource-status.policy';

const CREW_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR = '22222222-2222-4222-8222-222222222222';
const CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

function makeCrew(status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'): CrewEntity {
  return new CrewEntity({
    id: CREW_ID,
    code: 'CREW-001',
    name: 'Đội Alpha',
    status,
    createdBy: ACTOR,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

describe('StatusTransitionCrewUseCase ORG-SRS-006 (issue #29)', () => {
  let repo: jest.Mocked<CrewRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: StatusTransitionCrewUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn(async () => makeCrew()),
      findByCode: jest.fn(),
      findMany: jest.fn(async () => ({ entities: [], total: 0 })),
      countOpenAssignments: jest.fn(async () => 0),
      save: jest.fn(async () => {}),
      saveWithClient: jest.fn(async () => {}),
      create: jest.fn(async () => {}),
      insertLeadWithClient: jest.fn(async () => {}),
      deactivateActiveLeadWithClient: jest.fn(async () => {}),
    } as unknown as jest.Mocked<CrewRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new StatusTransitionCrewUseCase(repo, audit, tx);
  });

  it('ACTIVATE (INACTIVE -> ACTIVE): audit ORG_CREW_REACTIVATED, không đếm open work', async () => {
    repo.findById.mockResolvedValue(makeCrew('INACTIVE'));
    const out = await useCase.execute({ crewId: CREW_ID, action: 'ACTIVATE', actorUserId: ACTOR, correlationId: CORR });
    expect(out.entity.status).toBe('ACTIVE');
    expect(out.alreadyInState).toBe(false);
    expect(out.warning).toBeUndefined();
    expect(repo.countOpenAssignments).not.toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'ORG_CREW_REACTIVATED', correlationId: CORR }),
    );
  });

  it('SUSPEND (ACTIVE -> INACTIVE): audit ORG_CREW_SUSPENDED, reason vào cột reason KHÔNG vào afterData', async () => {
    const out = await useCase.execute({ crewId: CREW_ID, action: 'SUSPEND', reason: 'Vi phạm an toàn', actorUserId: ACTOR });
    expect(out.entity.status).toBe('INACTIVE');
    expect(out.alreadyInState).toBe(false);
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as {
      action: string; reason: string | null; beforeData: { status: string }; afterData: Record<string, unknown>;
    };
    expect(call.action).toBe('ORG_CREW_SUSPENDED');
    expect(call.reason).toBe('Vi phạm an toàn');
    expect(call.beforeData.status).toBe('ACTIVE');
    expect(call.afterData.status).toBe('INACTIVE');
    expect(call.afterData.reason).toBeUndefined();
    expect(AuditLogEntity.isSanitized(call.beforeData)).toBe(true);
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('TERMINATE: audit ORG_CREW_TERMINATED', async () => {
    const out = await useCase.execute({ crewId: CREW_ID, action: 'TERMINATE', reason: 'Giải thể đội', actorUserId: ACTOR });
    expect(out.entity.status).toBe('INACTIVE');
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'ORG_CREW_TERMINATED' }));
  });

  it('SUSPEND/TERMINATE thiếu reason → 400, KHÔNG save/audit', async () => {
    await expect(useCase.execute({ crewId: CREW_ID, action: 'SUSPEND', actorUserId: ACTOR })).rejects.toThrow(REASON_REQUIRED_MESSAGE);
    await expect(useCase.execute({ crewId: CREW_ID, action: 'TERMINATE', reason: '  ', actorUserId: ACTOR })).rejects.toThrow(REASON_REQUIRED_MESSAGE);
    expect(audit.logWithClient).not.toHaveBeenCalled();
    expect(repo.saveWithClient).not.toHaveBeenCalled();
  });

  it('action không hợp lệ → 400; không tìm thấy đội → 404', async () => {
    await expect(useCase.execute({ crewId: CREW_ID, action: 'FOO' as never, actorUserId: ACTOR })).rejects.toThrow(BadRequestException);
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ crewId: CREW_ID, action: 'SUSPEND', reason: 'x', actorUserId: ACTOR })).rejects.toThrow(NotFoundException);
  });

  it('idempotent repeat → alreadyInState, KHÔNG audit', async () => {
    repo.findById.mockResolvedValue(makeCrew('INACTIVE'));
    const out2 = await useCase.execute({ crewId: CREW_ID, action: 'SUSPEND', reason: 'x', actorUserId: ACTOR });
    expect(out2.alreadyInState).toBe(true);
    expect(audit.logWithClient).not.toHaveBeenCalled();
    expect(repo.saveWithClient).not.toHaveBeenCalled();
    repo.findById.mockResolvedValue(makeCrew('ACTIVE'));
    const out3 = await useCase.execute({ crewId: CREW_ID, action: 'ACTIVATE', actorUserId: ACTOR });
    expect(out3.alreadyInState).toBe(true);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('open > 0 → warning response + _warning audit (sanitize pass)', async () => {
    repo.countOpenAssignments.mockResolvedValue(3);
    const out = await useCase.execute({ crewId: CREW_ID, action: 'SUSPEND', reason: 'Tạm dừng', actorUserId: ACTOR });
    expect(out.warning).toEqual({ openAssignments: 3 });
    const call = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { afterData: Record<string, unknown> };
    expect(call.afterData._warning).toBe(openWorkWarningText(3));
    expect(AuditLogEntity.isSanitized(call.afterData)).toBe(true);
  });

  it('count thất bại → fail-closed (lỗi lan ra, không transition thiếu cảnh báo)', async () => {
    repo.countOpenAssignments.mockRejectedValue(new Error('db down'));
    await expect(useCase.execute({ crewId: CREW_ID, action: 'SUSPEND', reason: 'x', actorUserId: ACTOR })).rejects.toThrow('db down');
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('auditActionFor mapping đủ 3 action', () => {
    expect(auditActionFor('ACTIVATE')).toBe('ORG_CREW_REACTIVATED');
    expect(auditActionFor('SUSPEND')).toBe('ORG_CREW_SUSPENDED');
    expect(auditActionFor('TERMINATE')).toBe('ORG_CREW_TERMINATED');
  });
});
