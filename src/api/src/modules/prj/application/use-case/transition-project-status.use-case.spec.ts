import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { TransitionProjectStatusUseCase } from './transition-project-status.use-case';
import { ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { ProjectEntity } from '../../domain/entity/project.entity';
import { ProjectStatus } from '../../domain/service/project.policy';

const PID = '11111111-1111-4111-8111-111111111111';
const MANAGER = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';

function makeEntity(status: ProjectStatus = 'DRAFT'): ProjectEntity {
  return new ProjectEntity({
    id: PID,
    code: 'PRJ-001',
    name: 'Dự án A',
    description: null,
    address: '123 Đường Láng',
    timezone: 'Asia/Ho_Chi_Minh',
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2026-12-31',
    managerId: MANAGER,
    status,
    createdBy: ACTOR,
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
    updatedAt: new Date('2026-09-07T00:00:00.000Z'),
  });
}

function profile(status: ProjectStatus = 'DRAFT'): { entity: ProjectEntity; managerName: string | null } {
  return { entity: makeEntity(status), managerName: 'Nguyen Van A' };
}

describe('TransitionProjectStatusUseCase PRJ-SRS-002 (issue #33)', () => {
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let scope: jest.Mocked<ProjectScopeService>;
  let useCase: TransitionProjectStatusUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(),
      findProfileById: jest.fn(async () => profile('DRAFT')),
      findByCode: jest.fn(),
      findForUpdateWithClient: jest.fn(async () => profile('DRAFT')),
      findManagerNameWithClient: jest.fn(),
      createWithClient: jest.fn(),
      saveWithClient: jest.fn(),
      insertManagerMembershipWithClient: jest.fn(),
      findActiveMemberWithClient: jest.fn(async () => null),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn() } as unknown as jest.Mocked<AuditPort>;
    tx = {
      withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({})),
    } as unknown as jest.Mocked<TransactionPort>;
    scope = {
      assertProjectWriteScope: jest.fn(async () => ({ isAdminBypass: false })),
      assertWriteScopeTxCheck: jest.fn(),
    } as unknown as jest.Mocked<ProjectScopeService>;
    useCase = new TransitionProjectStatusUseCase(projectRepo, audit, tx, scope);
  });

  function setStatuses(pre: ProjectStatus, fresh: ProjectStatus): void {
    projectRepo.findProfileById.mockResolvedValue(profile(pre));
    projectRepo.findForUpdateWithClient.mockResolvedValue(profile(fresh));
  }

  describe.each([
    ['ACTIVATE', 'DRAFT', 'ACTIVE', undefined],
    ['PAUSE', 'ACTIVE', 'PAUSED', 'Tạm dừng chờ vật tư'],
    ['RESUME', 'PAUSED', 'ACTIVE', undefined],
    ['COMPLETE', 'ACTIVE', 'COMPLETED', undefined],
    ['CLOSE', 'COMPLETED', 'CLOSED', 'Nghiệm thu xong'],
    ['CLOSE', 'DRAFT', 'CLOSED', 'Hủy nháp'],
    ['REOPEN', 'CLOSED', 'ACTIVE', 'Mở lại theo yêu cầu CĐT'],
  ] as Array<[string, ProjectStatus, ProjectStatus, string | undefined]>)(
    'transition %s: %s → %s',
    (action, from, to, reason) => {
      it('FOR UPDATE → changeStatus → save → audit PRJ_PROJECT_STATUS_CHANGED', async () => {
        setStatuses(from, from);
        const out = await useCase.execute({ projectId: PID, action, reason: reason ?? null, actorUserId: ACTOR });
        expect(out.alreadyInState).toBe(false);
        expect(out.entity.status).toBe(to);
        expect(out.managerName).toBe('Nguyen Van A');
        expect(projectRepo.findForUpdateWithClient).toHaveBeenCalled();
        expect(projectRepo.saveWithClient).toHaveBeenCalled();
        expect(audit.logWithClient).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            actorUserId: ACTOR,
            action: 'PRJ_PROJECT_STATUS_CHANGED',
            entityType: 'PROJECT',
            entityId: PID,
            reason: reason ?? null,
            result: 'SUCCESS',
          }),
        );
        const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
        expect((payload['beforeData'] as Record<string, unknown>)['status']).toBe(from);
        expect((payload['afterData'] as Record<string, unknown>)['status']).toBe(to);
      });
    },
  );

  it('alreadyInState (L3): PAUSE khi đã PAUSED → 200, không mutation, không audit', async () => {
    setStatuses('PAUSED', 'PAUSED');
    const out = await useCase.execute({ projectId: PID, action: 'PAUSE', reason: 'lý do', actorUserId: ACTOR });
    expect(out).toEqual(expect.objectContaining({ alreadyInState: true }));
    expect(out.entity.status).toBe('PAUSED');
    expect(projectRepo.saveWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('alreadyInState không cần reason: ACTIVATE khi đã ACTIVE (không audit)', async () => {
    setStatuses('ACTIVE', 'ACTIVE');
    const out = await useCase.execute({ projectId: PID, action: 'ACTIVATE', actorUserId: ACTOR });
    expect(out.alreadyInState).toBe(true);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('alreadyInState miễn reason bắt buộc: PAUSE khi đã PAUSED, thiếu reason → 200, không audit', async () => {
    setStatuses('PAUSED', 'PAUSED');
    const out = await useCase.execute({ projectId: PID, action: 'PAUSE', actorUserId: ACTOR });
    expect(out).toEqual(expect.objectContaining({ alreadyInState: true }));
    expect(out.entity.status).toBe('PAUSED');
    expect(projectRepo.saveWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('invalid jump → 409 INVALID_TRANSITION kèm allowedTransitions', async () => {
    setStatuses('DRAFT', 'DRAFT');
    const err = (await useCase
      .execute({ projectId: PID, action: 'PAUSE', reason: 'có lý do', actorUserId: ACTOR })
      .catch((e: unknown) => e)) as ConflictException;
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toEqual({
      statusCode: 409,
      message: expect.stringContaining('DRAFT'),
      code: 'INVALID_TRANSITION',
      allowedTransitions: ['ACTIVATE', 'CLOSE'],
    });
    expect(projectRepo.saveWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('action chưa biết → 400 (không phải 409)', async () => {
    const err = (await useCase
      .execute({ projectId: PID, action: 'SUSPEND', actorUserId: ACTOR })
      .catch((e: unknown) => e)) as BadRequestException;
    expect(err).toBeInstanceOf(BadRequestException);
    expect(projectRepo.findProfileById).not.toHaveBeenCalled();
  });

  it.each(['PAUSE', 'CLOSE', 'REOPEN'] as const)(
    'thiếu reason cho %s → 400 fieldErrors {reason}',
    async (action) => {
      const from: ProjectStatus = action === 'PAUSE' ? 'ACTIVE' : action === 'CLOSE' ? 'COMPLETED' : 'CLOSED';
      setStatuses(from, from);
      const err = (await useCase
        .execute({ projectId: PID, action, actorUserId: ACTOR })
        .catch((e: unknown) => e)) as BadRequestException;
      expect(err.getResponse()).toEqual({
        statusCode: 400,
        message: expect.stringContaining('Lý do'),
        fieldErrors: { reason: [expect.stringContaining('Lý do')] },
      });
      expect(projectRepo.saveWithClient).not.toHaveBeenCalled();
    },
  );

  it('reason >500 ký tự → 400 fieldErrors {reason}', async () => {
    setStatuses('ACTIVE', 'ACTIVE');
    const err = (await useCase
      .execute({ projectId: PID, action: 'PAUSE', reason: 'x'.repeat(501), actorUserId: ACTOR })
      .catch((e: unknown) => e)) as BadRequestException;
    expect((err.getResponse() as Record<string, unknown>)['fieldErrors']).toHaveProperty('reason');
  });

  it('không tìm thấy → 404 (cả pre-read lẫn FOR UPDATE trong tx)', async () => {
    projectRepo.findProfileById.mockResolvedValue(null);
    let err = (await useCase.execute({ projectId: PID, action: 'ACTIVATE', actorUserId: ACTOR }).catch((e: unknown) => e)) as NotFoundException;
    expect(err).toBeInstanceOf(NotFoundException);

    projectRepo.findProfileById.mockResolvedValue(profile('DRAFT'));
    projectRepo.findForUpdateWithClient.mockResolvedValue(null);
    err = (await useCase.execute({ projectId: PID, action: 'ACTIVATE', actorUserId: ACTOR }).catch((e: unknown) => e)) as NotFoundException;
    expect(err).toBeInstanceOf(NotFoundException);
  });

  it('race (L4): pre-read ACTIVE, FOR UPDATE đã PAUSED, PAUSE → alreadyInState, không audit', async () => {
    setStatuses('ACTIVE', 'PAUSED');
    const out = await useCase.execute({ projectId: PID, action: 'PAUSE', reason: 'lý do', actorUserId: ACTOR });
    expect(out.alreadyInState).toBe(true);
    expect(projectRepo.saveWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('race (L4): pre-read ACTIVE, FOR UPDATE đã COMPLETED, PAUSE → 409 map trên trạng thái mới', async () => {
    setStatuses('ACTIVE', 'COMPLETED');
    const err = (await useCase
      .execute({ projectId: PID, action: 'PAUSE', reason: 'lý do', actorUserId: ACTOR })
      .catch((e: unknown) => e)) as ConflictException;
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toEqual(expect.objectContaining({ code: 'INVALID_TRANSITION', allowedTransitions: ['CLOSE'] }));
  });

  it('audit thất bại → 500 rollback (catch-all)', async () => {
    setStatuses('DRAFT', 'DRAFT');
    (audit.logWithClient as unknown as jest.Mock).mockRejectedValue(new Error('audit down'));
    const err = await useCase.execute({ projectId: PID, action: 'ACTIVATE', actorUserId: ACTOR }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
  });

  it('PRJ-SRS-006: guard write-scope trước pre-read 404 (revoked replay alreadyInState vẫn 403)', async () => {
    setStatuses('PAUSED', 'PAUSED');
    (scope.assertProjectWriteScope as jest.Mock).mockRejectedValueOnce(
      new ForbiddenException('Không có quyền truy cập dự án này'),
    );
    const err = await useCase
      .execute({ projectId: PID, action: 'PAUSE', reason: 'lý do', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(projectRepo.findProfileById).not.toHaveBeenCalled();
    expect(projectRepo.saveWithClient).not.toHaveBeenCalled();
  });

  it('PRJ-SRS-006: re-check trong cùng tx sau lock, trước mutation', async () => {
    setStatuses('DRAFT', 'DRAFT');
    await useCase.execute({ projectId: PID, action: 'ACTIVATE', actorUserId: ACTOR, actorRoles: ['PROJECT_MANAGER'] });
    expect(scope.assertProjectWriteScope).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ACTOR, projectId: PID }),
    );
    expect(scope.assertWriteScopeTxCheck).toHaveBeenCalledWith(false, null);
  });
});
