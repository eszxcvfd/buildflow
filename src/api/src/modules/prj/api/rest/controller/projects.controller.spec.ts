import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PrjProjectsController } from './projects.controller';
import { CreateProjectUseCase } from '../../../application/use-case/create-project.use-case';
import { UpdateProjectUseCase } from '../../../application/use-case/update-project.use-case';
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
  let controller: PrjProjectsController;

  beforeEach(() => {
    createMock = {
      execute: jest.fn(async () => ({ entity: makeEntity(), managerName: 'Nguyen Van A' })),
    } as unknown as jest.Mocked<CreateProjectUseCase>;
    updateMock = {
      execute: jest.fn(async () => ({ entity: makeEntity(), managerName: 'Nguyen Van A' })),
    } as unknown as jest.Mocked<UpdateProjectUseCase>;
    controller = new PrjProjectsController(createMock, updateMock);
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

    it('STAFF/WORKER mọi write → 403, không gọi use case', async () => {
      await expect(controller.create(createBody() as never, staffReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.create(createBody() as never, workerReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.update(PID, { name: 'X' } as never, staffReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.update(PID, { name: 'X' } as never, workerReq() as never)).rejects.toThrow(ForbiddenException);
      expect(createMock.execute).not.toHaveBeenCalled();
      expect(updateMock.execute).not.toHaveBeenCalled();
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
});
