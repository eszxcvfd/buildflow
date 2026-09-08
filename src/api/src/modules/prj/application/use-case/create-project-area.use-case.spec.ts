import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { CreateProjectAreaUseCase } from './create-project-area.use-case';
import { ProjectRepositoryPort, ProjectAreaRepositoryPort, ProjectAreaRow } from '../../domain/repository/project-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { ProjectEntity } from '../../domain/entity/project.entity';

const PID = '11111111-1111-4111-8111-111111111111';
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

function makeArea(overrides: Partial<ProjectAreaRow> = {}): ProjectAreaRow {
  const now = new Date('2026-09-07T01:00:00.000Z');
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    projectId: PID,
    code: 'KV-01',
    name: 'Khu A',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('CreateProjectAreaUseCase PRJ-SRS-003 (issue #34)', () => {
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let areaRepo: jest.Mocked<ProjectAreaRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let scope: jest.Mocked<ProjectScopeService>;
  let useCase: CreateProjectAreaUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(async () => makeProject()),
      findForUpdateWithClient: jest.fn(async () => ({ entity: makeProject(), managerName: 'Tran Manager' })),
      findActiveMemberWithClient: jest.fn(async () => null),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;
    areaRepo = {
      isActiveProjectMember: jest.fn(async () => true),
      findActiveAreaByNameWithClient: jest.fn(async () => null),
      findAreaByCodeWithClient: jest.fn(async () => null),
      insertAreaWithClient: jest.fn(async (_c, input) =>
        makeArea({ projectId: input.projectId, code: input.code, name: input.name }),
      ),
    } as unknown as jest.Mocked<ProjectAreaRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = {
      withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)),
    } as unknown as jest.Mocked<TransactionPort>;
    scope = {
      assertProjectMemberScope: jest.fn(async () => ({ isAdminBypass: false })),
      assertMemberScopeTxCheck: jest.fn(),
    } as unknown as jest.Mocked<ProjectScopeService>;
    useCase = new CreateProjectAreaUseCase(projectRepo, areaRepo, audit, tx, scope);
  });

  it('happy (ADMIN bypass): FOR UPDATE project → insert → audit PRJ_PROJECT_AREA_ADDED (before null, after + projectCode)', async () => {
    (scope.assertProjectMemberScope as jest.Mock).mockResolvedValueOnce({ isAdminBypass: true });
    const out = await useCase.execute({
      projectId: PID, code: 'KV-01', name: 'Khu A', actorUserId: ACTOR, actorRoles: ['ADMIN'],
    });
    expect(out.area.name).toBe('Khu A');
    expect(out.area.code).toBe('KV-01');
    expect(scope.assertProjectMemberScope).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ACTOR, actorRoles: ['ADMIN'], projectId: PID }),
    );
    expect(scope.assertMemberScopeTxCheck).toHaveBeenCalledWith(true, null);
    expect(projectRepo.findForUpdateWithClient).toHaveBeenCalledWith(expect.anything(), PID);
    expect(areaRepo.insertAreaWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ projectId: PID, code: 'KV-01', name: 'Khu A' }),
    );
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        actorUserId: ACTOR,
        action: 'PRJ_PROJECT_AREA_ADDED',
        entityType: 'PROJECT',
        entityId: PID,
        result: 'SUCCESS',
      }),
    );
    expect(payload.beforeData).toBeNull();
    expect(payload.afterData).toEqual(expect.objectContaining({ name: 'Khu A', projectCode: 'PRJ-001' }));
  });

  it('member PM: scope check qua ProjectScopeService; non-member PM → 403', async () => {
    await useCase.execute({
      projectId: PID, name: 'Khu A', actorUserId: ACTOR, actorRoles: ['PROJECT_MANAGER'],
    });
    expect(scope.assertProjectMemberScope).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ACTOR, actorRoles: ['PROJECT_MANAGER'], projectId: PID }),
    );
    (scope.assertProjectMemberScope as jest.Mock).mockRejectedValueOnce(
      new ForbiddenException('Không có quyền truy cập dự án này'),
    );
    (areaRepo.insertAreaWithClient as jest.Mock).mockClear();
    (audit.logWithClient as jest.Mock).mockClear();
    const err = await useCase
      .execute({ projectId: PID, name: 'Khu B', actorUserId: ACTOR, actorRoles: ['PROJECT_MANAGER'] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(areaRepo.insertAreaWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('duplicate tên active (pre-check) → 409 AREA_DUPLICATE, không insert/audit', async () => {
    areaRepo.findActiveAreaByNameWithClient.mockResolvedValue(makeArea());
    const err = await useCase
      .execute({ projectId: PID, name: 'Khu A', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toEqual({
      statusCode: 409, message: 'Tên khu vực đã tồn tại trong dự án', code: 'AREA_DUPLICATE',
    });
    expect(areaRepo.insertAreaWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('race duplicate (23505 ux_project_areas_active_name_ci) → 409 AREA_DUPLICATE (constraint cụ thể)', async () => {
    (areaRepo.insertAreaWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_project_areas_active_name_ci' }),
    );
    const err = await useCase
      .execute({ projectId: PID, name: 'Khu A', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'AREA_DUPLICATE' }));
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('race duplicate mã (23505 ux_project_areas_project_code) → 409 AREA_CODE_DUPLICATE', async () => {
    (areaRepo.insertAreaWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_project_areas_project_code' }),
    );
    const err = await useCase
      .execute({ projectId: PID, code: 'KV-01', name: 'Khu A', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'AREA_CODE_DUPLICATE' }));
  });

  it('bare 23505 (không tên constraint) → rethrow, KHÔNG swallow thành 409', async () => {
    const bare = Object.assign(new Error('dup'), { code: '23505' });
    (areaRepo.insertAreaWithClient as jest.Mock).mockRejectedValue(bare);
    const err = await useCase
      .execute({ projectId: PID, name: 'Khu A', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect(err).toBe(bare);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('tên trống/quá dài → 400 fieldErrors {name}; mã sai format → 400 {code}; project 404', async () => {
    const badName = await useCase
      .execute({ projectId: PID, name: '   ', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect((badName as BadRequestException).getResponse()).toEqual({
      statusCode: 400, message: 'Tên khu vực không được để trống', fieldErrors: { name: ['Tên khu vực không được để trống'] },
    });
    const badCode = await useCase
      .execute({ projectId: PID, code: 'KV 01!', name: 'Khu A', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect((badCode as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 400, fieldErrors: { code: ['Mã khu vực chỉ cho phép chữ, số, _ và -'] } }),
    );
    projectRepo.findById.mockResolvedValue(null);
    const missing = await useCase
      .execute({ projectId: PID, name: 'Khu A', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(NotFoundException);
  });

  it('audit thất bại → 500 rollback (catch-all); thiếu logWithClient → 500', async () => {
    (audit.logWithClient as jest.Mock).mockRejectedValue(new Error('db down'));
    const err = await useCase
      .execute({ projectId: PID, name: 'Khu A', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
    const noTxAudit = new CreateProjectAreaUseCase(
      projectRepo, areaRepo, { log: jest.fn() } as unknown as AuditPort, tx, scope,
    );
    const err2 = await noTxAudit
      .execute({ projectId: PID, name: 'Khu A', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect(err2).toBeInstanceOf(InternalServerErrorException);
  });
});
