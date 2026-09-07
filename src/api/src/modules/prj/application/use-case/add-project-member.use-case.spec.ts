import { BadRequestException, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { AddProjectMemberUseCase } from './add-project-member.use-case';
import { ProjectRepositoryPort, ProjectMemberRow } from '../../domain/repository/project-repository.port';
import { UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectEntity } from '../../domain/entity/project.entity';

const PID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const MANAGER = '22222222-2222-4222-8222-222222222222';
const ACTOR = '44444444-4444-4444-8444-444444444444';

function makeProject(): ProjectEntity {
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
    status: 'ACTIVE',
    createdBy: ACTOR,
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
    updatedAt: new Date('2026-09-07T00:00:00.000Z'),
  });
}

function makeMember(overrides: Partial<ProjectMemberRow> = {}): ProjectMemberRow {
  const joinedAt = new Date('2026-09-07T01:00:00.000Z');
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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

describe('AddProjectMemberUseCase PRJ-SRS-005 (issue #36)', () => {
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let userRepo: jest.Mocked<UserRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: AddProjectMemberUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(async () => makeProject()),
      findByCode: jest.fn(),
      findProfileById: jest.fn(),
      findForUpdateWithClient: jest.fn(async () => {
        const e = makeProject();
        return { entity: e, managerName: 'Tran Manager' };
      }),
      findManagerNameWithClient: jest.fn(),
      createWithClient: jest.fn(),
      saveWithClient: jest.fn(),
      insertManagerMembershipWithClient: jest.fn(),
      listMembers: jest.fn(),
      listMembersWithClient: jest.fn(),
      findMemberByIdWithClient: jest.fn(),
      findActiveMemberWithClient: jest.fn(async () => null),
      insertMemberWithClient: jest.fn(async (_c, input) =>
        makeMember({ userId: input.userId, projectRole: input.projectRole as ProjectMemberRow['projectRole'] }),
      ),
      deactivateMemberWithClient: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;
    userRepo = {
      findById: jest.fn(async () => ({ status: 'ACTIVE', userType: 'STAFF' }) as never),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = {
      withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)),
    } as unknown as jest.Mocked<TransactionPort>;
    useCase = new AddProjectMemberUseCase(projectRepo, userRepo, audit, tx);
  });

  it('happy: FOR UPDATE project → insert → audit PRJ_PROJECT_MEMBER_ADDED (entityType PROJECT, after + projectCode)', async () => {
    const out = await useCase.execute({ projectId: PID, userId: USER_ID, projectRole: 'WORKER', actorUserId: ACTOR });
    expect(out.member.projectRole).toBe('WORKER');
    expect(out.member.userId).toBe(USER_ID);
    expect(projectRepo.findForUpdateWithClient).toHaveBeenCalledWith(expect.anything(), PID);
    expect(projectRepo.insertMemberWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: PID, userId: USER_ID, projectRole: 'WORKER', addedBy: ACTOR }),
    );
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        actorUserId: ACTOR,
        action: 'PRJ_PROJECT_MEMBER_ADDED',
        entityType: 'PROJECT',
        entityId: PID,
        result: 'SUCCESS',
      }),
    );
    expect(payload.beforeData).toBeNull();
    expect(payload.afterData).toEqual(expect.objectContaining({ userId: USER_ID, projectRole: 'WORKER', projectCode: 'PRJ-001' }));
    expect(payload.afterData).not.toHaveProperty('_warning');
  });

  it('duplicate ACTIVE (pre-check) → 409 MEMBER_DUPLICATE, không insert/audit', async () => {
    projectRepo.findActiveMemberWithClient.mockResolvedValue(makeMember());
    const err = await useCase
      .execute({ projectId: PID, userId: USER_ID, projectRole: 'QC', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toEqual({
      statusCode: 409, message: 'Thành viên đã thuộc dự án', code: 'MEMBER_DUPLICATE',
    });
    expect(projectRepo.insertMemberWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('race duplicate (23505 ux_project_members_active) → 409 MEMBER_DUPLICATE (constraint-order trước generic)', async () => {
    (projectRepo.insertMemberWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_project_members_active' }),
    );
    const err = await useCase
      .execute({ projectId: PID, userId: USER_ID, projectRole: 'QC', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'MEMBER_DUPLICATE' }));
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('race duplicate (23505 trần, không tên constraint) → 409 MEMBER_DUPLICATE (generic sau cụ-thể)', async () => {
    (projectRepo.insertMemberWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505' }),
    );
    const err = await useCase
      .execute({ projectId: PID, userId: USER_ID, projectRole: 'QC', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'MEMBER_DUPLICATE' }));
  });

  it('user không tồn tại → 400 fieldErrors {userId}', async () => {
    userRepo.findById.mockResolvedValue(null as never);
    const err = await useCase
      .execute({ projectId: PID, userId: USER_ID, projectRole: 'WORKER', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400, message: 'Người dùng không tồn tại', fieldErrors: { userId: ['Người dùng không tồn tại'] },
    });
  });

  it('user INACTIVE/LOCKED → 400 fieldErrors {userId}', async () => {
    userRepo.findById.mockResolvedValue({ status: 'INACTIVE', userType: 'STAFF' } as never);
    const err = await useCase
      .execute({ projectId: PID, userId: USER_ID, projectRole: 'WORKER', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400, message: 'Người dùng phải đang hoạt động', fieldErrors: { userId: ['Người dùng phải đang hoạt động'] },
    });
  });

  it('projectRole MANAGER → 400 fieldErrors {projectRole} (đặt qua PATCH managerId)', async () => {
    const err = await useCase
      .execute({ projectId: PID, userId: USER_ID, projectRole: 'MANAGER', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Quản lý dự án chỉ đặt qua PATCH /projects/:id managerId',
      fieldErrors: { projectRole: ['Quản lý dự án chỉ đặt qua PATCH /projects/:id managerId'] },
    });
    expect(projectRepo.insertMemberWithClient).not.toHaveBeenCalled();
  });

  it('projectRole lạ → 400 fieldErrors {projectRole}; userId sai uuid → 400 {userId}; project 404', async () => {
    const badRole = await useCase
      .execute({ projectId: PID, userId: USER_ID, projectRole: 'LEAD', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((badRole as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 400, fieldErrors: { projectRole: ['Vai trò thành viên không hợp lệ'] } }),
    );
    const badUser = await useCase
      .execute({ projectId: PID, userId: 'not-a-uuid', projectRole: 'WORKER', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((badUser as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 400, fieldErrors: { userId: ['Người dùng không hợp lệ'] } }),
    );
    projectRepo.findById.mockResolvedValue(null);
    const missing = await useCase
      .execute({ projectId: PID, userId: USER_ID, projectRole: 'WORKER', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(NotFoundException);
  });

  it('audit thất bại → 500 rollback (catch-all); thiếu logWithClient → 500', async () => {
    (audit.logWithClient as jest.Mock).mockRejectedValue(new Error('db down'));
    const err = await useCase
      .execute({ projectId: PID, userId: USER_ID, projectRole: 'WORKER', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
    const noTxAudit = new AddProjectMemberUseCase(
      projectRepo, userRepo, { log: jest.fn() } as unknown as AuditPort, tx,
    );
    const err2 = await noTxAudit
      .execute({ projectId: PID, userId: USER_ID, projectRole: 'WORKER', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err2).toBeInstanceOf(InternalServerErrorException);
  });
});
