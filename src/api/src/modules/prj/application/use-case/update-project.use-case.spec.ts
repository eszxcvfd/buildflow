import { BadRequestException, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { UpdateProjectUseCase } from './update-project.use-case';
import { ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectEntity } from '../../domain/entity/project.entity';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';

const PID = '11111111-1111-4111-8111-111111111111';
const MANAGER = '22222222-2222-4222-8222-222222222222';
const NEW_MANAGER = '44444444-4444-4444-8444-444444444444';
const ACTOR = '33333333-3333-4333-8333-333333333333';

function makeEntity(overrides: Partial<Record<string, unknown>> = {}): ProjectEntity {
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
    status: 'DRAFT',
    createdBy: ACTOR,
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
    updatedAt: new Date('2026-09-07T00:00:00.000Z'),
    ...(overrides as Record<string, never>),
  });
}

function activeUser(id: string): Record<string, unknown> {
  return { id, status: 'ACTIVE', userType: 'STAFF', fullName: `User ${id.slice(0, 4)}` };
}

describe('UpdateProjectUseCase PRJ-SRS-001 (issue #32)', () => {
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let userRepo: jest.Mocked<UserRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let scope: jest.Mocked<ProjectScopeService>;
  let useCase: UpdateProjectUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(async () => makeEntity()),
      findByCode: jest.fn(),
      findForUpdateWithClient: jest.fn(async () => ({ entity: makeEntity(), managerName: 'Nguyen Van A' })),
      findManagerNameWithClient: jest.fn(async () => 'Tran Van B'),
      createWithClient: jest.fn(),
      saveWithClient: jest.fn(),
      insertManagerMembershipWithClient: jest.fn(),
      findActiveMemberWithClient: jest.fn(async () => null),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;
    userRepo = { findById: jest.fn(async () => activeUser(NEW_MANAGER) as never) } as unknown as jest.Mocked<UserRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn() } as unknown as jest.Mocked<AuditPort>;
    tx = {
      withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({})),
    } as unknown as jest.Mocked<TransactionPort>;
    scope = {
      assertProjectWriteScope: jest.fn(async () => ({ isAdminBypass: false })),
      assertWriteScopeTxCheck: jest.fn(),
    } as unknown as jest.Mocked<ProjectScopeService>;
    useCase = new UpdateProjectUseCase(projectRepo, userRepo, audit, tx, scope);
  });

  it('happy: SELECT FOR UPDATE → apply → save → audit before/after (full rows)', async () => {
    const { entity } = await useCase.execute({ projectId: PID, name: 'Dự án B', actorUserId: ACTOR });
    expect(entity.name).toBe('Dự án B');
    expect(projectRepo.findForUpdateWithClient).toHaveBeenCalled();
    expect(projectRepo.saveWithClient).toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: ACTOR,
        action: 'PRJ_PROJECT_UPDATED',
        entityType: 'PROJECT',
        entityId: PID,
        result: 'SUCCESS',
      }),
    );
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    const before = payload['beforeData'] as Record<string, unknown>;
    const after = payload['afterData'] as Record<string, unknown>;
    expect(before['name']).toBe('Dự án A');
    expect(after['name']).toBe('Dự án B');
    expect(before['code']).toBe('PRJ-001');
    expect(after['code']).toBe('PRJ-001');
  });

  it('code trong body → 400 fieldErrors {code} (explicit, không silent-ignore)', async () => {
    const err = (await useCase
      .execute({ projectId: PID, code: 'PRJ-002', actorUserId: ACTOR })
      .catch((e: unknown) => e)) as BadRequestException;
    expect(err.getResponse()).toEqual({
      statusCode: 400,
      message: 'Mã dự án không thể thay đổi',
      fieldErrors: { code: ['Mã dự án không thể thay đổi'] },
    });
    expect(projectRepo.findById).not.toHaveBeenCalled();
  });

  it('status trong body → 400 fieldErrors {status} (lifecycle = #33)', async () => {
    const err = (await useCase
      .execute({ projectId: PID, status: 'ACTIVE', actorUserId: ACTOR })
      .catch((e: unknown) => e)) as BadRequestException;
    expect((err.getResponse() as Record<string, unknown>)['fieldErrors']).toEqual({
      status: ['Trạng thái dự án chỉ đổi qua luồng lifecycle riêng'],
    });
  });

  it('không tìm thấy → 404 (cả pre-read lẫn FOR UPDATE trong tx)', async () => {
    projectRepo.findById.mockResolvedValue(null);
    let err = (await useCase.execute({ projectId: PID, name: 'X', actorUserId: ACTOR }).catch((e: unknown) => e)) as NotFoundException;
    expect(err).toBeInstanceOf(NotFoundException);

    projectRepo.findById.mockResolvedValue(makeEntity());
    projectRepo.findForUpdateWithClient.mockResolvedValue(null);
    err = (await useCase.execute({ projectId: PID, name: 'X', actorUserId: ACTOR }).catch((e: unknown) => e)) as NotFoundException;
    expect(err).toBeInstanceOf(NotFoundException);
  });

  it('manager INACTIVE / không tồn tại → 400 fieldErrors {managerId}', async () => {
    userRepo.findById.mockResolvedValue({ ...activeUser(NEW_MANAGER), status: 'LOCKED' } as never);
    let err = (await useCase
      .execute({ projectId: PID, managerId: NEW_MANAGER, actorUserId: ACTOR })
      .catch((e: unknown) => e)) as BadRequestException;
    expect((err.getResponse() as Record<string, unknown>)['fieldErrors']).toEqual({
      managerId: ['Quản lý dự án phải đang hoạt động'],
    });

    userRepo.findById.mockResolvedValue(null);
    err = (await useCase
      .execute({ projectId: PID, managerId: NEW_MANAGER, actorUserId: ACTOR })
      .catch((e: unknown) => e)) as BadRequestException;
    expect((err.getResponse() as Record<string, unknown>)['fieldErrors']).toEqual({
      managerId: ['Quản lý dự án không tồn tại'],
    });
  });

  it('dates hiệu lực vi phạm (chỉ đổi end về trước start) → 400 fieldErrors', async () => {
    const err = (await useCase
      .execute({ projectId: PID, plannedEndDate: '2026-01-01', actorUserId: ACTOR })
      .catch((e: unknown) => e)) as BadRequestException;
    expect((err.getResponse() as Record<string, unknown>)['fieldErrors']).toHaveProperty('plannedEndDate');
    expect(projectRepo.saveWithClient).not.toHaveBeenCalled();
  });

  it('P11/M4 (#36, đóng asymmetry P9): đổi manager → insert MANAGER membership cùng tx', async () => {
    await useCase.execute({ projectId: PID, managerId: NEW_MANAGER, actorUserId: ACTOR });
    expect(projectRepo.saveWithClient).toHaveBeenCalled();
    expect(projectRepo.insertManagerMembershipWithClient).toHaveBeenCalledWith(expect.anything(), {
      projectId: PID,
      userId: NEW_MANAGER,
      addedBy: ACTOR,
    });
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect((payload['afterData'] as Record<string, unknown>)['managerMembership']).toEqual({
      userId: NEW_MANAGER,
      autoInserted: true,
    });
  });

  it('P11/M4: manager mới đã là member → afterData.managerMembership.autoInserted=false', async () => {
    projectRepo.findActiveMemberWithClient.mockResolvedValue({ userId: NEW_MANAGER, isActive: true } as never);
    await useCase.execute({ projectId: PID, managerId: NEW_MANAGER, actorUserId: ACTOR });
    expect(projectRepo.insertManagerMembershipWithClient).not.toHaveBeenCalled();
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect((payload['afterData'] as Record<string, unknown>)['managerMembership']).toEqual({
      userId: NEW_MANAGER,
      autoInserted: false,
    });
  });

  it('audit thất bại → 500 rollback', async () => {
    (audit.logWithClient as unknown as jest.Mock).mockRejectedValue(new Error('audit down'));
    const err = await useCase.execute({ projectId: PID, name: 'X', actorUserId: ACTOR }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
  });

  it('PRJ-SRS-006: guard write-scope trước 404/validation, actor roles server-derived', async () => {
    await useCase.execute({ projectId: PID, name: 'X', actorUserId: ACTOR, actorRoles: ['PROJECT_MANAGER'] });
    expect(scope.assertProjectWriteScope).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ACTOR, actorRoles: ['PROJECT_MANAGER'], projectId: PID }),
    );
    // Re-check trong cùng tx sau lock, trước mutation.
    expect(scope.assertWriteScopeTxCheck).toHaveBeenCalledWith(false, null);
    expect(projectRepo.saveWithClient).toHaveBeenCalled();
  });

  it('PRJ-SRS-006: ngoài scope → 403 từ guard, không chạm mutation/audit', async () => {
    (scope.assertProjectWriteScope as jest.Mock).mockRejectedValueOnce(
      new ForbiddenException('Không có quyền truy cập dự án này'),
    );
    const err = await useCase.execute({ projectId: PID, name: 'X', actorUserId: ACTOR }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(projectRepo.findById).not.toHaveBeenCalled();
    expect(projectRepo.saveWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });
});
