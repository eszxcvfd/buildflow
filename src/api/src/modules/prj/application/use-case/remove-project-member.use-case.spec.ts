import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { RemoveProjectMemberUseCase } from './remove-project-member.use-case';
import { ProjectRepositoryPort, ProjectMemberRow } from '../../domain/repository/project-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { ProjectEntity } from '../../domain/entity/project.entity';

const PID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const MANAGER = '22222222-2222-4222-8222-222222222222';
const ACTOR = '44444444-4444-4444-8444-444444444444';

function makeProject(managerId: string = MANAGER): ProjectEntity {
  return new ProjectEntity({
    id: PID,
    code: 'PRJ-001',
    name: 'Dự án A',
    description: null,
    address: '123 Đường Láng',
    timezone: 'Asia/Ho_Chi_Minh',
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2026-12-31',
    managerId,
    status: 'ACTIVE',
    createdBy: ACTOR,
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
    updatedAt: new Date('2026-09-07T00:00:00.000Z'),
  });
}

function makeMember(overrides: Partial<ProjectMemberRow> = {}): ProjectMemberRow {
  const joinedAt = new Date('2026-09-07T01:00:00.000Z');
  return {
    id: MEMBER_ID,
    projectId: PID,
    userId: USER_ID,
    projectRole: 'WORKER',
    joinedAt,
    leftAt: null,
    isActive: true,
    addedBy: ACTOR,
    createdAt: joinedAt,
    userName: 'Nguyen Van A',
    userCode: 'EMP-1',
    ...overrides,
  };
}

describe('RemoveProjectMemberUseCase PRJ-SRS-005 (issue #36)', () => {
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let scope: jest.Mocked<ProjectScopeService>;
  let useCase: RemoveProjectMemberUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(async () => makeProject()),
      findByCode: jest.fn(),
      findProfileById: jest.fn(),
      findForUpdateWithClient: jest.fn(async () => ({ entity: makeProject(), managerName: 'Tran Manager' })),
      findManagerNameWithClient: jest.fn(),
      createWithClient: jest.fn(),
      saveWithClient: jest.fn(),
      insertManagerMembershipWithClient: jest.fn(),
      listMembers: jest.fn(),
      listMembersWithClient: jest.fn(),
      findMemberByIdWithClient: jest.fn(async () => makeMember()),
      findActiveMemberWithClient: jest.fn(),
      insertMemberWithClient: jest.fn(),
      deactivateMemberWithClient: jest.fn(async (_c, id) =>
        makeMember({ id, isActive: false, leftAt: new Date('2026-09-08T01:00:00.000Z') }),
      ),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = {
      withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)),
    } as unknown as jest.Mocked<TransactionPort>;
    scope = {
      assertProjectWriteScope: jest.fn(async () => ({ isAdminBypass: false })),
      assertWriteScopeTxCheck: jest.fn(),
    } as unknown as jest.Mocked<ProjectScopeService>;
    useCase = new RemoveProjectMemberUseCase(projectRepo, audit, tx, scope);
  });

  it('happy: deactivate + audit PRJ_PROJECT_MEMBER_REMOVED (before/after + projectCode, reason ở cột audit)', async () => {
    const out = await useCase.execute({ projectId: PID, memberId: MEMBER_ID, reason: 'Hết việc', actorUserId: ACTOR });
    expect(out.alreadyRemoved).toBe(false);
    expect(out.member.isActive).toBe(false);
    expect(out.member.leftAt).not.toBeNull();
    expect(projectRepo.deactivateMemberWithClient).toHaveBeenCalledWith(expect.anything(), MEMBER_ID);
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        actorUserId: ACTOR,
        action: 'PRJ_PROJECT_MEMBER_REMOVED',
        entityType: 'PROJECT',
        entityId: PID,
        reason: 'Hết việc',
        result: 'SUCCESS',
      }),
    );
    expect(payload.beforeData).toEqual(expect.objectContaining({ id: MEMBER_ID, isActive: true, projectCode: 'PRJ-001' }));
    expect(payload.afterData).toEqual(expect.objectContaining({ id: MEMBER_ID, isActive: false, projectCode: 'PRJ-001' }));
  });

  it('reason optional: không gửi → null, vẫn audit', async () => {
    const out = await useCase.execute({ projectId: PID, memberId: MEMBER_ID, actorUserId: ACTOR });
    expect(out.alreadyRemoved).toBe(false);
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload['reason']).toBeNull();
  });

  it('alreadyRemoved: row đã inactive → 200 {alreadyRemoved:true}, không mutation, không audit', async () => {
    projectRepo.findMemberByIdWithClient.mockResolvedValue(makeMember({ isActive: false, leftAt: new Date() }));
    const out = await useCase.execute({ projectId: PID, memberId: MEMBER_ID, actorUserId: ACTOR });
    expect(out.alreadyRemoved).toBe(true);
    expect(out.member.isActive).toBe(false);
    expect(projectRepo.deactivateMemberWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('GUARD MANAGER_MEMBER: membership của manager hiện tại → 409 (kể cả row đã inactive)', async () => {
    // Active manager membership.
    projectRepo.findMemberByIdWithClient.mockResolvedValue(makeMember({ userId: MANAGER, projectRole: 'MANAGER' }));
    const err = await useCase.execute({ projectId: PID, memberId: MEMBER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 409, code: 'MANAGER_MEMBER' }),
    );
    expect(projectRepo.deactivateMemberWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();

    // Inactive manager membership — guard chạy trước idempotent nên vẫn 409, không alreadyRemoved.
    projectRepo.findMemberByIdWithClient.mockResolvedValue(
      makeMember({ userId: MANAGER, projectRole: 'MANAGER', isActive: false, leftAt: new Date() }),
    );
    const err2 = await useCase.execute({ projectId: PID, memberId: MEMBER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect((err2 as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'MANAGER_MEMBER' }));
  });

  it('member không tồn tại / khác project → 404; project 404 trong tx → 404', async () => {
    projectRepo.findMemberByIdWithClient.mockResolvedValue(null);
    await expect(useCase.execute({ projectId: PID, memberId: MEMBER_ID, actorUserId: ACTOR })).rejects.toThrow(
      NotFoundException,
    );
    projectRepo.findMemberByIdWithClient.mockResolvedValue(makeMember({ projectId: 'other-project' }));
    await expect(useCase.execute({ projectId: PID, memberId: MEMBER_ID, actorUserId: ACTOR })).rejects.toThrow(
      NotFoundException,
    );
    projectRepo.findMemberByIdWithClient.mockResolvedValue(makeMember());
    projectRepo.findForUpdateWithClient.mockResolvedValue(null);
    await expect(useCase.execute({ projectId: PID, memberId: MEMBER_ID, actorUserId: ACTOR })).rejects.toThrow(
      NotFoundException,
    );
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('reason > 500 → 400 fieldErrors {reason}; audit fail → 500', async () => {
    const bad = await useCase
      .execute({ projectId: PID, memberId: MEMBER_ID, reason: 'x'.repeat(501), actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((bad as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 400, fieldErrors: { reason: ['Lý do tối đa 500 ký tự'] } }),
    );
    (audit.logWithClient as jest.Mock).mockRejectedValue(new Error('db down'));
    const err = await useCase.execute({ projectId: PID, memberId: MEMBER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
  });

  it('PRJ-SRS-006: guard write-scope trước M3/reason branches; re-check trong tx', async () => {
    const out = await useCase.execute({ projectId: PID, memberId: MEMBER_ID, actorUserId: ACTOR, actorRoles: ['ADMIN'] });
    expect(scope.assertProjectWriteScope).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ACTOR, actorRoles: ['ADMIN'], projectId: PID }),
    );
    expect(scope.assertWriteScopeTxCheck).toHaveBeenCalled();
    expect(out.alreadyRemoved).toBe(false);
  });

  it('PRJ-SRS-006: ngoài scope → 403, không chạm tx mutation', async () => {
    (scope.assertProjectWriteScope as jest.Mock).mockRejectedValueOnce(
      new ForbiddenException('Không có quyền truy cập dự án này'),
    );
    await expect(
      useCase.execute({ projectId: PID, memberId: MEMBER_ID, actorUserId: ACTOR }),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.withTransaction).not.toHaveBeenCalled();
  });
});
