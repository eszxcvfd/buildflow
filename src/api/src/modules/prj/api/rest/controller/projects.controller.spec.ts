import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrjProjectsController } from './projects.controller';
import { CreateProjectUseCase } from '../../../application/use-case/create-project.use-case';
import { UpdateProjectUseCase } from '../../../application/use-case/update-project.use-case';
import { TransitionProjectStatusUseCase } from '../../../application/use-case/transition-project-status.use-case';
import { AddProjectMemberUseCase } from '../../../application/use-case/add-project-member.use-case';
import { RemoveProjectMemberUseCase } from '../../../application/use-case/remove-project-member.use-case';
import { ListProjectMembersUseCase } from '../../../application/use-case/list-project-members.use-case';
import { CreateProjectAreaUseCase } from '../../../application/use-case/create-project-area.use-case';
import { UpdateProjectAreaUseCase } from '../../../application/use-case/update-project-area.use-case';
import { ListProjectAreasUseCase } from '../../../application/use-case/list-project-areas.use-case';
import { ProjectEntity } from '../../../domain/entity/project.entity';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';

const PID = '11111111-1111-4111-8111-111111111111';
const MANAGER = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';

function makeEntity(): ProjectEntity {
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
  });
}

function reqWithRoles(roles: string[], headers: Record<string, string> = {}): unknown {
  return { user: { sub: 'u-1', roles }, headers: { 'user-agent': 'jest', ...headers }, ip: '127.0.0.1' } as unknown;
}
const adminReq = (): unknown => reqWithRoles(['ADMIN']);
const pmReq = (): unknown => reqWithRoles(['PROJECT_MANAGER']);
const staffReq = (): unknown => reqWithRoles(['STAFF']);
const workerReq = (): unknown => reqWithRoles(['WORKER']);

const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

function createBody(): Record<string, unknown> {
  return {
    code: 'PRJ-001',
    name: 'Dự án A',
    address: '123 Đường Láng',
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2026-12-31',
    managerId: MANAGER,
  };
}

describe('PrjProjectsController PRJ-SRS-001 (issue #32)', () => {
  let createMock: jest.Mocked<CreateProjectUseCase>;
  let updateMock: jest.Mocked<UpdateProjectUseCase>;
  let transitionMock: jest.Mocked<TransitionProjectStatusUseCase>;
  let addMemberMock: jest.Mocked<AddProjectMemberUseCase>;
  let removeMemberMock: jest.Mocked<RemoveProjectMemberUseCase>;
  let listMembersMock: jest.Mocked<ListProjectMembersUseCase>;
  let createAreaMock: jest.Mocked<CreateProjectAreaUseCase>;
  let updateAreaMock: jest.Mocked<UpdateProjectAreaUseCase>;
  let listAreasMock: jest.Mocked<ListProjectAreasUseCase>;
  let controller: PrjProjectsController;

  const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const USER_ID = '55555555-5555-4555-8555-555555555555';
  const AREA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  function makeAreaRow(): Record<string, unknown> {
    const now = new Date('2026-09-07T01:00:00.000Z');
    return {
      id: AREA_ID,
      projectId: PID,
      code: 'KV-01',
      name: 'Khu A',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  }
  function makeMemberRow(): Record<string, unknown> {
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
    };
  }

  beforeEach(() => {
    createMock = {
      execute: jest.fn(async () => ({ entity: makeEntity(), managerName: 'Nguyen Van A' })),
    } as unknown as jest.Mocked<CreateProjectUseCase>;
    updateMock = {
      execute: jest.fn(async () => ({ entity: makeEntity(), managerName: 'Nguyen Van A' })),
    } as unknown as jest.Mocked<UpdateProjectUseCase>;
    transitionMock = {
      execute: jest.fn(async () => ({ entity: makeEntity(), managerName: 'Nguyen Van A', alreadyInState: false })),
    } as unknown as jest.Mocked<TransitionProjectStatusUseCase>;
    addMemberMock = {
      execute: jest.fn(async () => ({ member: makeMemberRow() })),
    } as unknown as jest.Mocked<AddProjectMemberUseCase>;
    removeMemberMock = {
      execute: jest.fn(async () => ({ member: makeMemberRow(), alreadyRemoved: false })),
    } as unknown as jest.Mocked<RemoveProjectMemberUseCase>;
    listMembersMock = {
      execute: jest.fn(async () => ({ members: [makeMemberRow()] })),
    } as unknown as jest.Mocked<ListProjectMembersUseCase>;
    createAreaMock = {
      execute: jest.fn(async () => ({ area: makeAreaRow() })),
    } as unknown as jest.Mocked<CreateProjectAreaUseCase>;
    updateAreaMock = {
      execute: jest.fn(async () => ({ area: makeAreaRow(), alreadyInactive: false })),
    } as unknown as jest.Mocked<UpdateProjectAreaUseCase>;
    listAreasMock = {
      execute: jest.fn(async () => ({ areas: [makeAreaRow()] })),
    } as unknown as jest.Mocked<ListProjectAreasUseCase>;
    controller = new PrjProjectsController(
      createMock,
      updateMock,
      transitionMock,
      addMemberMock,
      removeMemberMock,
      listMembersMock,
      createAreaMock,
      updateAreaMock,
      listAreasMock,
    );
  });

  describe('role matrix: ADMIN + PROJECT_MANAGER write; STAFF/WORKER 403; anon 401', () => {
    it('ADMIN tạo + cập nhật ok, response đủ ProjectProfileDto', async () => {
      const created = await controller.create(createBody() as never, adminReq() as never);
      expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ code: 'PRJ-001', actorUserId: 'u-1' }));
      expect(created).toEqual(
        expect.objectContaining({
          id: PID,
          code: 'PRJ-001',
          status: 'DRAFT',
          managerId: MANAGER,
          managerName: 'Nguyen Van A',
          plannedStartDate: '2026-09-01',
          updatedBy: 'u-1',
        }),
      );
      const updated = await controller.update(PID, { name: 'Dự án B' } as never, adminReq() as never);
      expect(updateMock.execute).toHaveBeenCalledWith(expect.objectContaining({ projectId: PID, name: 'Dự án B' }));
      expect(updated.id).toBe(PID);
    });

    it('PROJECT_MANAGER tạo + cập nhật ok (crews precedent, khác write admin-only)', async () => {
      await controller.create(createBody() as never, pmReq() as never);
      await controller.update(PID, { address: 'Mới' } as never, pmReq() as never);
      expect(createMock.execute).toHaveBeenCalled();
      expect(updateMock.execute).toHaveBeenCalled();
    });

    it('STAFF/WORKER create → 403 (create chua co project-scope); update → chuyen actor xuong use case (scope #37)', async () => {
      await expect(controller.create(createBody() as never, staffReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.create(createBody() as never, workerReq() as never)).rejects.toThrow(ForbiddenException);
      expect(createMock.execute).not.toHaveBeenCalled();
      // PRJ-SRS-006: controller khong gate global role cho update — use case enforce project-scope.
      await controller.update(PID, { name: 'X' } as never, staffReq() as never);
      await controller.update(PID, { name: 'X' } as never, workerReq() as never);
      expect(updateMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, name: 'X', actorUserId: 'u-1', actorRoles: ['STAFF'] }),
      );
      expect(updateMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, name: 'X', actorUserId: 'u-1', actorRoles: ['WORKER'] }),
      );
    });

    it('anon → 401: controller gắn JwtAuthGuard; guard thiếu Bearer → Unauthorized', async () => {
      const guards = Reflect.getMetadata('__guards__', PrjProjectsController) as unknown[];
      expect(guards.map((g) => (g as { name?: string }).name ?? String(g))).toContain('JwtAuthGuard');
      const guard = new JwtAuthGuard({ verify: jest.fn() } as never, { isRevoked: jest.fn() } as never, {} as never);
      const ctx = { switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }) } as never;
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('error shapes', () => {
    it('409 duplicate từ use case → giữ code PROJECT_CODE_DUPLICATE', async () => {
      createMock.execute.mockRejectedValue(
        new ConflictException({ statusCode: 409, message: 'Mã dự án đã tồn tại', code: 'PROJECT_CODE_DUPLICATE' }),
      );
      const err = (await controller.create(createBody() as never, adminReq() as never).catch((e: unknown) => e)) as ConflictException;
      expect(err.getResponse()).toEqual(
        expect.objectContaining({ statusCode: 409, code: 'PROJECT_CODE_DUPLICATE' }),
      );
    });

    it('400 fieldErrors từ use case (manager/dates) → truyền nguyên shape', async () => {
      createMock.execute.mockRejectedValue(
        new BadRequestException({
          statusCode: 400,
          message: 'Quản lý dự án phải đang hoạt động',
          fieldErrors: { managerId: ['Quản lý dự án phải đang hoạt động'] },
        }),
      );
      const err = (await controller.create(createBody() as never, adminReq() as never).catch((e: unknown) => e)) as BadRequestException;
      expect(err.getResponse()).toEqual({
        statusCode: 400,
        message: 'Quản lý dự án phải đang hoạt động',
        fieldErrors: { managerId: ['Quản lý dự án phải đang hoạt động'] },
      });
    });

    it('X-Correlation-Id sai UUID → 400 strict, không gọi use case', async () => {
      await expect(
        controller.create(createBody() as never, reqWithRoles(['ADMIN'], { 'x-correlation-id': 'not-a-uuid' }) as never),
      ).rejects.toThrow(BadRequestException);
      await expect(
        controller.update(PID, { name: 'X' } as never, reqWithRoles(['ADMIN'], { 'x-correlation-id': 'not-a-uuid' }) as never),
      ).rejects.toThrow(BadRequestException);
      expect(createMock.execute).not.toHaveBeenCalled();
      expect(updateMock.execute).not.toHaveBeenCalled();
    });

    it('X-Correlation-Id UUID hợp lệ → đi qua, truyền xuống use case', async () => {
      await controller.create(createBody() as never, reqWithRoles(['ADMIN'], { 'x-correlation-id': VALID_CORR }) as never);
      expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ correlationId: VALID_CORR }));
    });

    it('PATCH code/status trong body → use case reject 400 fieldErrors (explicit)', async () => {
      updateMock.execute.mockRejectedValue(
        new BadRequestException({
          statusCode: 400,
          message: 'Mã dự án không thể thay đổi',
          fieldErrors: { code: ['Mã dự án không thể thay đổi'] },
        }),
      );
      const err = (await controller
        .update(PID, { code: 'PRJ-002' } as never, adminReq() as never)
        .catch((e: unknown) => e)) as BadRequestException;
      expect((err.getResponse() as Record<string, unknown>)['fieldErrors']).toEqual({
        code: ['Mã dự án không thể thay đổi'],
      });
      expect(updateMock.execute).toHaveBeenCalledWith(expect.objectContaining({ code: 'PRJ-002' }));
    });

    it('contract: prefix api/v1/projects + :id validate UUID (400 khi sai)', async () => {
      // Controller đăng ký đúng prefix; :id dùng ParseUUIDPipe errorHttpStatusCode 400
      // (pipe chạy ở framework layer — khóa contract qua metadata khai báo trên class).
      const { ROUTE_ARGS_METADATA } = jest.requireActual('@nestjs/common/constants') as {
        ROUTE_ARGS_METADATA: string;
      };
      expect(Reflect.getMetadata('path', PrjProjectsController)).toBe('api/v1/projects');
      const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, PrjProjectsController, 'update') as Record<
        string,
        { pipes?: Array<{ options?: { errorHttpStatusCode?: number } }> }
      >;
      const idParam = Object.values(args).find((a) => (a.pipes ?? []).length > 0);
      expect(idParam).toBeDefined();
      expect(idParam?.pipes?.[0]?.options?.errorHttpStatusCode).toBe(400);
    });
  });

  describe('PATCH :id/status PRJ-SRS-002 (issue #33, L1-L3)', () => {
    it('ADMIN + PROJECT_MANAGER ok, response ProjectProfileDto + alreadyInState', async () => {
      const created = await controller.transition(PID, { action: 'ACTIVATE' } as never, adminReq() as never);
      expect(transitionMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, action: 'ACTIVATE', actorUserId: 'u-1' }),
      );
      expect(created).toEqual(expect.objectContaining({ id: PID, status: 'DRAFT', alreadyInState: false }));

      await controller.transition(PID, { action: 'PAUSE', reason: 'Chờ vật tư' } as never, pmReq() as never);
      expect(transitionMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PAUSE', reason: 'Chờ vật tư' }),
      );
    });

    it('alreadyInState từ use case → truyền nguyên ra response', async () => {
      transitionMock.execute.mockResolvedValue({ entity: makeEntity(), managerName: 'Nguyen Van A', alreadyInState: true });
      const out = await controller.transition(PID, { action: 'ACTIVATE' } as never, adminReq() as never);
      expect(out).toEqual(expect.objectContaining({ alreadyInState: true }));
    });

    it('STAFF/WORKER → chuyen actor xuong use case (scope #37 enforce 403 khi ngoai scope)', async () => {
      await controller.transition(PID, { action: 'ACTIVATE' } as never, staffReq() as never);
      await controller.transition(PID, { action: 'ACTIVATE' } as never, workerReq() as never);
      expect(transitionMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, action: 'ACTIVATE', actorUserId: 'u-1', actorRoles: ['STAFF'] }),
      );
      expect(transitionMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, action: 'ACTIVATE', actorUserId: 'u-1', actorRoles: ['WORKER'] }),
      );
    });

    it('X-Correlation-Id sai UUID → 400 strict, không gọi use case', async () => {
      await expect(
        controller.transition(
          PID,
          { action: 'ACTIVATE' } as never,
          reqWithRoles(['ADMIN'], { 'x-correlation-id': 'not-a-uuid' }) as never,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(transitionMock.execute).not.toHaveBeenCalled();
    });

    it('409 INVALID_TRANSITION từ use case → giữ code + allowedTransitions', async () => {
      transitionMock.execute.mockRejectedValue(
        new ConflictException({
          statusCode: 409,
          message: 'Không thể chuyển dự án từ DRAFT với action PAUSE',
          code: 'INVALID_TRANSITION',
          allowedTransitions: ['ACTIVATE', 'CLOSE'],
        }),
      );
      const err = (await controller
        .transition(PID, { action: 'PAUSE', reason: 'x' } as never, adminReq() as never)
        .catch((e: unknown) => e)) as ConflictException;
      expect(err.getResponse()).toEqual(
        expect.objectContaining({ statusCode: 409, code: 'INVALID_TRANSITION', allowedTransitions: ['ACTIVATE', 'CLOSE'] }),
      );
    });
  });

  describe('members PRJ-SRS-005 (issue #36, M1/M5)', () => {
    it('ADMIN + PROJECT_MANAGER list/add/remove ok; response đủ ProjectMemberDto', async () => {
      const listed = await controller.listMembers(PID, adminReq() as never, undefined);
      expect(listMembersMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, includeInactive: false, actorUserId: 'u-1', actorRoles: ['ADMIN'] }),
      );
      expect(listed).toEqual({
        data: [
          expect.objectContaining({
            id: MEMBER_ID,
            userId: USER_ID,
            userName: 'Nguyen Van A',
            userCode: 'EMP-1',
            projectRole: 'WORKER',
            isActive: true,
            addedBy: ACTOR,
          }),
        ],
        total: 1,
      });

      const added = await controller.addMember(PID, { userId: USER_ID, projectRole: 'QC' } as never, pmReq() as never);
      expect(addMemberMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, userId: USER_ID, projectRole: 'QC', actorUserId: 'u-1' }),
      );
      expect(added).toEqual(expect.objectContaining({ id: MEMBER_ID, projectRole: 'WORKER' }));

      const removed = await controller.removeMember(PID, MEMBER_ID, adminReq() as never, { reason: 'Hết việc' } as never);
      expect(removeMemberMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, memberId: MEMBER_ID, reason: 'Hết việc', actorUserId: 'u-1' }),
      );
      expect(removed).toEqual(expect.objectContaining({ id: MEMBER_ID, alreadyRemoved: false }));
    });

    it('includeInactive=true/1 → true; thiếu/khác → false', async () => {
      await controller.listMembers(PID, adminReq() as never, 'true');
      expect(listMembersMock.execute).toHaveBeenCalledWith(expect.objectContaining({ projectId: PID, includeInactive: true }));
      await controller.listMembers(PID, adminReq() as never, '1');
      expect(listMembersMock.execute).toHaveBeenCalledWith(expect.objectContaining({ projectId: PID, includeInactive: true }));
      await controller.listMembers(PID, adminReq() as never, '0');
      expect(listMembersMock.execute).toHaveBeenCalledWith(expect.objectContaining({ projectId: PID, includeInactive: false }));
    });

    it('STAFF/WORKER → chuyen actor xuong use case (scope #37: member moi role duoc read, write can MANAGER/COORDINATOR)', async () => {
      await controller.listMembers(PID, staffReq() as never, undefined);
      expect(listMembersMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, actorUserId: 'u-1', actorRoles: ['STAFF'] }),
      );
      await controller.addMember(PID, { userId: USER_ID, projectRole: 'WORKER' } as never, staffReq() as never);
      await controller.addMember(PID, { userId: USER_ID, projectRole: 'WORKER' } as never, workerReq() as never);
      expect(addMemberMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, actorUserId: 'u-1', actorRoles: ['WORKER'] }),
      );
      await controller.removeMember(PID, MEMBER_ID, workerReq() as never, undefined as never);
      expect(removeMemberMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, memberId: MEMBER_ID, actorUserId: 'u-1', actorRoles: ['WORKER'] }),
      );
    });

    it('X-Correlation-Id sai UUID trên writes → 400 strict, không gọi use case (GET list miễn)', async () => {
      const bad = reqWithRoles(['ADMIN'], { 'x-correlation-id': 'not-a-uuid' });
      await expect(
        controller.addMember(PID, { userId: USER_ID, projectRole: 'WORKER' } as never, bad as never),
      ).rejects.toThrow(BadRequestException);
      await expect(controller.removeMember(PID, MEMBER_ID, bad as never, undefined as never)).rejects.toThrow(
        BadRequestException,
      );
      expect(addMemberMock.execute).not.toHaveBeenCalled();
      expect(removeMemberMock.execute).not.toHaveBeenCalled();
      await controller.listMembers(PID, bad as never, undefined);
      expect(listMembersMock.execute).toHaveBeenCalled();
    });

    it('alreadyRemoved từ use case → truyền nguyên; 409 MEMBER_DUPLICATE/MANAGER_MEMBER giữ code', async () => {
      removeMemberMock.execute.mockResolvedValue({ member: makeMemberRow() as never, alreadyRemoved: true });
      const out = await controller.removeMember(PID, MEMBER_ID, adminReq() as never, undefined as never);
      expect(out).toEqual(expect.objectContaining({ alreadyRemoved: true }));

      addMemberMock.execute.mockRejectedValue(
        new ConflictException({ statusCode: 409, message: 'Thành viên đã thuộc dự án', code: 'MEMBER_DUPLICATE' }),
      );
      const dup = (await controller
        .addMember(PID, { userId: USER_ID, projectRole: 'WORKER' } as never, adminReq() as never)
        .catch((e: unknown) => e)) as ConflictException;
      expect(dup.getResponse()).toEqual(expect.objectContaining({ code: 'MEMBER_DUPLICATE' }));

      removeMemberMock.execute.mockRejectedValue(
        new ConflictException({ statusCode: 409, message: 'Quản lý dự án không thể xóa', code: 'MANAGER_MEMBER' }),
      );
      const guard = (await controller
        .removeMember(PID, MEMBER_ID, adminReq() as never, undefined as never)
        .catch((e: unknown) => e)) as ConflictException;
      expect(guard.getResponse()).toEqual(expect.objectContaining({ code: 'MANAGER_MEMBER' }));
    });
  });

  describe('areas PRJ-SRS-003 (issue #34, A1/A4)', () => {
    const AREA_BODY = { code: 'KV-01', name: 'Khu A' };

    it('ADMIN + PROJECT_MANAGER create/update ok; response đủ ProjectAreaDto', async () => {
      const created = await controller.createArea(PID, AREA_BODY as never, adminReq() as never);
      expect(createAreaMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, code: 'KV-01', name: 'Khu A', actorUserId: 'u-1' }),
      );
      expect(created).toEqual(
        expect.objectContaining({ id: AREA_ID, projectId: PID, code: 'KV-01', name: 'Khu A', isActive: true }),
      );

      await controller.createArea(PID, { name: 'Khu B' } as never, pmReq() as never);
      expect(createAreaMock.execute).toHaveBeenCalledWith(expect.objectContaining({ code: null }));

      const updated = await controller.updateArea(PID, AREA_ID, { name: 'Khu B' } as never, pmReq() as never);
      expect(updateAreaMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, areaId: AREA_ID, name: 'Khu B', actorUserId: 'u-1' }),
      );
      expect(updated).toEqual(expect.objectContaining({ id: AREA_ID, alreadyInactive: false }));
    });

    it('STAFF/WORKER mọi area write → 403, không gọi use case (scope sâu hơn do use case enforce)', async () => {
      await expect(controller.createArea(PID, AREA_BODY as never, staffReq() as never)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(controller.createArea(PID, AREA_BODY as never, workerReq() as never)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        controller.updateArea(PID, AREA_ID, { name: 'X' } as never, workerReq() as never),
      ).rejects.toThrow(ForbiddenException);
      expect(createAreaMock.execute).not.toHaveBeenCalled();
      expect(updateAreaMock.execute).not.toHaveBeenCalled();
    });

    it('GET list mở mọi role (scope membership do use case enforce); activeOnly=true/1 → true', async () => {
      const listed = await controller.listAreas(PID, workerReq() as never, undefined);
      expect(listAreasMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, activeOnly: false, actorUserId: 'u-1' }),
      );
      expect(listed).toEqual({
        data: [expect.objectContaining({ id: AREA_ID, name: 'Khu A', isActive: true })],
        total: 1,
      });
      await controller.listAreas(PID, adminReq() as never, 'true');
      expect(listAreasMock.execute).toHaveBeenCalledWith(expect.objectContaining({ activeOnly: true }));
      await controller.listAreas(PID, adminReq() as never, '1');
      expect(listAreasMock.execute).toHaveBeenCalledWith(expect.objectContaining({ activeOnly: true }));
      await controller.listAreas(PID, adminReq() as never, '0');
      expect(listAreasMock.execute).toHaveBeenCalledWith(expect.objectContaining({ activeOnly: false }));
    });

    it('X-Correlation-Id sai UUID trên area writes → 400 strict (GET list miễn)', async () => {
      const bad = reqWithRoles(['ADMIN'], { 'x-correlation-id': 'not-a-uuid' });
      await expect(controller.createArea(PID, AREA_BODY as never, bad as never)).rejects.toThrow(BadRequestException);
      await expect(controller.updateArea(PID, AREA_ID, { name: 'X' } as never, bad as never)).rejects.toThrow(
        BadRequestException,
      );
      expect(createAreaMock.execute).not.toHaveBeenCalled();
      expect(updateAreaMock.execute).not.toHaveBeenCalled();
      await controller.listAreas(PID, bad as never, undefined);
      expect(listAreasMock.execute).toHaveBeenCalled();
    });

    it('alreadyInactive + 409 AREA_DUPLICATE từ use case → truyền nguyên', async () => {
      updateAreaMock.execute.mockResolvedValue({ area: makeAreaRow() as never, alreadyInactive: true });
      const out = await controller.updateArea(PID, AREA_ID, { isActive: false } as never, adminReq() as never);
      expect(out).toEqual(expect.objectContaining({ alreadyInactive: true }));

      createAreaMock.execute.mockRejectedValue(
        new ConflictException({ statusCode: 409, message: 'Tên khu vực đã tồn tại trong dự án', code: 'AREA_DUPLICATE' }),
      );
      const dup = (await controller
        .createArea(PID, AREA_BODY as never, adminReq() as never)
        .catch((e: unknown) => e)) as ConflictException;
      expect(dup.getResponse()).toEqual(expect.objectContaining({ code: 'AREA_DUPLICATE' }));
    });

    it('GET /areas/active picker: gọi list use case với activeOnly=true, mở mọi role', async () => {
      const picker = await controller.listActiveAreas(PID, workerReq() as never);
      expect(listAreasMock.execute).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PID, activeOnly: true, actorUserId: 'u-1' }),
      );
      expect(picker).toEqual({
        data: [expect.objectContaining({ id: AREA_ID, name: 'Khu A', isActive: true })],
        total: 1,
      });
      await controller.listActiveAreas(PID, adminReq() as never);
      expect(listAreasMock.execute).toHaveBeenCalledWith(expect.objectContaining({ activeOnly: true }));
    });

    it('PATCH retire kèm usage/warning → truyền nguyên ra response (mirror work-types)', async () => {
      updateAreaMock.execute.mockResolvedValue({
        area: makeAreaRow() as never,
        alreadyInactive: false,
        usage: { workOrders: 2 },
        warning: 'Khu vực đang được tham chiếu bởi Work Order đang hiệu lực',
      });
      const out = await controller.updateArea(PID, AREA_ID, { isActive: false } as never, adminReq() as never);
      expect(out).toEqual(
        expect.objectContaining({
          alreadyInactive: false,
          usage: { workOrders: 2 },
          warning: 'Khu vực đang được tham chiếu bởi Work Order đang hiệu lực',
        }),
      );
    });
    it('contract: :projectId/:areaId validate UUID (400 khi sai)', async () => {
      const { ROUTE_ARGS_METADATA } = jest.requireActual('@nestjs/common/constants') as {
        ROUTE_ARGS_METADATA: string;
      };
      const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, PrjProjectsController, 'updateArea') as Record<
        string,
        { pipes?: Array<{ options?: { errorHttpStatusCode?: number } }> }
      >;
      const piped = Object.values(args).filter((a) => (a.pipes ?? []).length > 0);
      expect(piped).toHaveLength(2);
      for (const p of piped) expect(p.pipes?.[0]?.options?.errorHttpStatusCode).toBe(400);
    });
  });
});
