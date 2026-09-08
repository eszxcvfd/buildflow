import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { UpdateProjectAreaUseCase } from './update-project-area.use-case';
import { ProjectRepositoryPort, ProjectAreaRepositoryPort, ProjectAreaRow } from '../../domain/repository/project-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { ProjectEntity } from '../../domain/entity/project.entity';

const PID = '11111111-1111-4111-8111-111111111111';
const AID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MANAGER = '22222222-2222-4222-8222-222222222222';
const ACTOR = '44444444-4444-4444-8444-444444444444';

function makeProject(status = 'ACTIVE'): ProjectEntity {
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
    status: status as never,
    createdBy: ACTOR,
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
    updatedAt: new Date('2026-09-07T00:00:00.000Z'),
  });
}

function makeArea(overrides: Partial<ProjectAreaRow> = {}): ProjectAreaRow {
  const now = new Date('2026-09-07T01:00:00.000Z');
  return {
    id: AID,
    projectId: PID,
    code: 'KV-01',
    name: 'Khu A',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('UpdateProjectAreaUseCase PRJ-SRS-003 (issue #34)', () => {
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let areaRepo: jest.Mocked<ProjectAreaRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let scope: jest.Mocked<ProjectScopeService>;
  let useCase: UpdateProjectAreaUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(async () => makeProject()),
      findActiveMemberWithClient: jest.fn(async () => null),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;
    areaRepo = {
      findAreaById: jest.fn(async () => makeArea()),
      isActiveProjectMember: jest.fn(async () => true),
      findAreaForUpdateWithClient: jest.fn(async () => makeArea()),
      findActiveAreaByNameWithClient: jest.fn(async () => null),
      findAreaByCodeWithClient: jest.fn(async () => null),
      saveAreaWithClient: jest.fn(async (_c, input) =>
        makeArea({ code: input.code, name: input.name, isActive: input.isActive }),
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
    useCase = new UpdateProjectAreaUseCase(projectRepo, areaRepo, audit, tx, scope);
  });

  it('happy rename: before/after tại chỗ + projectCode, reason vào cột audit và afterData', async () => {
    const out = await useCase.execute({
      projectId: PID, areaId: AID, name: 'Khu B', reason: 'Đổi tên', actorUserId: ACTOR, actorRoles: ['ADMIN'],
    });
    expect(out.area.name).toBe('Khu B');
    expect(out.alreadyInactive).toBe(false);
    expect(areaRepo.saveAreaWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: AID, name: 'Khu B', code: 'KV-01', isActive: true }),
    );
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        actorUserId: ACTOR,
        action: 'PRJ_PROJECT_AREA_UPDATED',
        entityType: 'PROJECT',
        entityId: PID,
        reason: 'Đổi tên',
        result: 'SUCCESS',
      }),
    );
    expect(payload.beforeData).toEqual(expect.objectContaining({ name: 'Khu A', projectCode: 'PRJ-001' }));
    expect(payload.afterData).toEqual(
      expect.objectContaining({ name: 'Khu B', projectCode: 'PRJ-001', reason: 'Đổi tên' }),
    );
  });

  it('deactivate: isActive=false → save + audit; double-deactivate → alreadyInactive, không mutation/audit', async () => {
    const out = await useCase.execute({
      projectId: PID, areaId: AID, isActive: false, actorUserId: ACTOR, actorRoles: ['ADMIN'],
    });
    expect(out.area.isActive).toBe(false);
    expect(out.alreadyInactive).toBe(false);
    expect(audit.logWithClient).toHaveBeenCalledTimes(1);

    areaRepo.findAreaById.mockResolvedValue(makeArea({ isActive: false }));
    areaRepo.findAreaForUpdateWithClient.mockResolvedValue(makeArea({ isActive: false }));
    (areaRepo.saveAreaWithClient as jest.Mock).mockClear();
    const again = await useCase.execute({
      projectId: PID, areaId: AID, isActive: false, actorUserId: ACTOR, actorRoles: ['ADMIN'],
    });
    expect(again.alreadyInactive).toBe(true);
    expect(again.area.isActive).toBe(false);
    expect(areaRepo.saveAreaWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledTimes(1);
  });

  it('rename trùng tên active (trừ self) → 409 AREA_DUPLICATE; trùng mã → 409 AREA_CODE_DUPLICATE', async () => {
    areaRepo.findActiveAreaByNameWithClient.mockResolvedValue(makeArea({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Khu B' }));
    const dupName = await useCase
      .execute({ projectId: PID, areaId: AID, name: 'Khu B', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect((dupName as ConflictException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 409, code: 'AREA_DUPLICATE' }),
    );
    areaRepo.findActiveAreaByNameWithClient.mockResolvedValue(null);
    areaRepo.findAreaByCodeWithClient.mockResolvedValue(makeArea({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', code: 'KV-02' }));
    const dupCode = await useCase
      .execute({ projectId: PID, areaId: AID, code: 'KV-02', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect((dupCode as ConflictException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 409, code: 'AREA_CODE_DUPLICATE' }),
    );
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('race rename (23505 ux_project_areas_active_name_ci) → 409; bare 23505 rethrow', async () => {
    (areaRepo.saveAreaWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_project_areas_active_name_ci' }),
    );
    const err = await useCase
      .execute({ projectId: PID, areaId: AID, name: 'Khu B', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'AREA_DUPLICATE' }));
    const bare = Object.assign(new Error('dup'), { code: '23505' });
    (areaRepo.saveAreaWithClient as jest.Mock).mockRejectedValue(bare);
    const err2 = await useCase
      .execute({ projectId: PID, areaId: AID, name: 'Khu C', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect(err2).toBe(bare);
  });

  it('scope: non-member PM → 403; area sai project → 404; project 404', async () => {
    (scope.assertProjectMemberScope as jest.Mock).mockRejectedValueOnce(
      new ForbiddenException('Không có quyền truy cập dự án này'),
    );
    const forbidden = await useCase
      .execute({ projectId: PID, areaId: AID, name: 'Khu B', actorUserId: ACTOR, actorRoles: ['PROJECT_MANAGER'] })
      .catch((e: unknown) => e);
    expect(forbidden).toBeInstanceOf(ForbiddenException);
    expect(areaRepo.saveAreaWithClient).not.toHaveBeenCalled();

    areaRepo.findAreaById.mockResolvedValue(makeArea({ projectId: '99999999-9999-4999-8999-999999999999' }));
    const tampered = await useCase
      .execute({ projectId: PID, areaId: AID, name: 'Khu B', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect(tampered).toBeInstanceOf(NotFoundException);

    projectRepo.findById.mockResolvedValue(null);
    const missing = await useCase
      .execute({ projectId: PID, areaId: AID, name: 'Khu B', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(NotFoundException);
  });

  it('closed project vẫn cho update (A5 — không check status)', async () => {
    projectRepo.findById.mockResolvedValue(makeProject('CLOSED'));
    const out = await useCase.execute({
      projectId: PID, areaId: AID, name: 'Khu B', actorUserId: ACTOR, actorRoles: ['ADMIN'],
    });
    expect(out.area.name).toBe('Khu B');
    expect(audit.logWithClient).toHaveBeenCalled();
  });

  it('tên trống → 400 fieldErrors {name}; reason quá dài → 400 {reason}; audit fail → 500', async () => {
    const badName = await useCase
      .execute({ projectId: PID, areaId: AID, name: '  ', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect((badName as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 400, fieldErrors: { name: ['Tên khu vực không được để trống'] } }),
    );
    const badReason = await useCase
      .execute({ projectId: PID, areaId: AID, isActive: false, reason: 'x'.repeat(501), actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect((badReason as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 400, fieldErrors: { reason: ['Lý do tối đa 500 ký tự'] } }),
    );
    (audit.logWithClient as jest.Mock).mockRejectedValue(new Error('db down'));
    const err = await useCase
      .execute({ projectId: PID, areaId: AID, name: 'Khu B', actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
  });
});
