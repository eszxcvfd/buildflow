import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { CreateUserUseCase } from '../../../application/use-case/create-user.use-case';
import { UpdateUserUseCase } from '../../../application/use-case/update-user.use-case';
import { ChangeUserStatusUseCase } from '../../../application/use-case/change-user-status.use-case';
import { GetUserUseCase, ListUsersUseCase } from '../../../application/use-case/list-users.use-case';
import { UserEntity } from '../../../domain/entity/user.entity';

function makeUser(overrides: Partial<ReturnType<UserEntity['getProps']>> = {}): UserEntity {
  return new UserEntity({
    id: 'user-1',
    email: 'alice@example.com',
    passwordHash: '$2b$10$hash',
    fullName: 'Alice Nguyen',
    phone: null,
    avatarUrl: null,
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    userType: 'STAFF',
    contractorId: null,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
    ...overrides,
  } as ReturnType<UserEntity['getProps']>);
}

function adminReq(userRoles: string[] = ['ADMIN'], userId = 'admin-1'): unknown {
  return {
    user: { sub: userId, email: 'admin@example.com', roles: userRoles },
    headers: { 'user-agent': 'jest' },
    ip: '127.0.0.1',
  } as unknown as never;
}

function nonAdminReq(): unknown {
  return {
    user: { sub: 'user-2', email: 'bob@example.com', roles: ['WORKER'] },
    headers: {},
    ip: '127.0.0.1',
  } as unknown as never;
}

function noUserReq(): unknown {
  return { headers: {}, ip: '127.0.0.1' } as unknown as never;
}

describe('AdminController IAM-SRS-004 contract', () => {
  let createMock: jest.Mocked<CreateUserUseCase>;
  let updateMock: jest.Mocked<UpdateUserUseCase>;
  let statusMock: jest.Mocked<ChangeUserStatusUseCase>;
  let listMock: jest.Mocked<ListUsersUseCase>;
  let getMock: jest.Mocked<GetUserUseCase>;
  let controller: AdminController;

  beforeEach(() => {
    createMock = { execute: jest.fn(async () => ({ entity: makeUser() })) } as unknown as jest.Mocked<CreateUserUseCase>;
    updateMock = { execute: jest.fn(async () => ({ entity: makeUser({ fullName: 'Updated' }) })) } as unknown as jest.Mocked<UpdateUserUseCase>;
    statusMock = { execute: jest.fn(async () => ({ entity: makeUser({ status: 'LOCKED' }) })) } as unknown as jest.Mocked<ChangeUserStatusUseCase>;
    listMock = { execute: jest.fn(async () => ({ entities: [makeUser(), makeUser({ id: 'user-2' })] })) } as unknown as jest.Mocked<ListUsersUseCase>;
    getMock = { execute: jest.fn(async () => ({ entity: makeUser() })) } as unknown as jest.Mocked<GetUserUseCase>;
    controller = new AdminController(createMock, updateMock, statusMock, listMock, getMock);
  });

  describe('ADMIN-only guard', () => {
    it('POST create forbids non-ADMIN', async () => {
      await expect(controller.create({ email: 'a@b.com', password: 'Secret123!', fullName: 'Test' } as never, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
      await expect(controller.create({ email: 'a@b.com', password: 'Secret123!', fullName: 'Test' } as never, noUserReq() as never)).rejects.toThrow(ForbiddenException);
    });

    it('GET list forbids non-ADMIN', async () => {
      await expect(controller.list(nonAdminReq() as never, undefined, undefined, undefined)).rejects.toThrow(ForbiddenException);
    });

    it('GET :id forbids non-ADMIN', async () => {
      await expect(controller.getOne('user-1', nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
    });

    it('PATCH :id forbids non-ADMIN', async () => {
      await expect(controller.update('user-1', { fullName: 'X' } as never, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
    });

    it('PATCH :id/status forbids non-ADMIN', async () => {
      await expect(controller.updateStatus('user-1', { status: 'LOCKED' } as never, nonAdminReq() as never)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('GET /api/v1/admin/users validation', () => {
    it('invalid status returns 400 not 500', async () => {
      await expect(controller.list(adminReq() as never, 'FOO', undefined, undefined)).rejects.toThrow(BadRequestException);
      await expect(controller.list(adminReq() as never, 'invalid', undefined, undefined)).rejects.toThrow('Trạng thái không hợp lệ');
    });

    it('invalid limit returns 400', async () => {
      await expect(controller.list(adminReq() as never, undefined, '0', undefined)).rejects.toThrow(BadRequestException);
      await expect(controller.list(adminReq() as never, undefined, '101', undefined)).rejects.toThrow(BadRequestException);
      await expect(controller.list(adminReq() as never, undefined, '-5', undefined)).rejects.toThrow(BadRequestException);
      await expect(controller.list(adminReq() as never, undefined, 'abc', undefined)).rejects.toThrow(BadRequestException);
      await expect(controller.list(adminReq() as never, undefined, '1.5', undefined)).rejects.toThrow(BadRequestException);
    });

    it('invalid offset returns 400', async () => {
      await expect(controller.list(adminReq() as never, undefined, undefined, '-1')).rejects.toThrow(BadRequestException);
      await expect(controller.list(adminReq() as never, undefined, undefined, 'abc')).rejects.toThrow(BadRequestException);
      await expect(controller.list(adminReq() as never, undefined, undefined, '1.5')).rejects.toThrow(BadRequestException);
    });

    it('valid status/limit/offset passes and returns redacted list', async () => {
      const result = await controller.list(adminReq() as never, 'ACTIVE', '10', '0');
      expect(listMock.execute).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE', limit: 10, offset: 0 }));
      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown as Array<Record<string, unknown>>)[0].passwordHash).toBeUndefined();
    });

    it('defaults limit 20 offset 0 when not provided', async () => {
      await controller.list(adminReq() as never, undefined, undefined, undefined);
      expect(listMock.execute).toHaveBeenCalledWith(expect.objectContaining({ limit: 20, offset: 0 }));
    });

    it('response does not expose passwordHash/failedLoginCount/lockedUntil', async () => {
      const result = await controller.list(adminReq() as never, undefined, undefined, undefined);
      const first = (result as unknown as Array<Record<string, unknown>>)[0];
      expect(first.passwordHash).toBeUndefined();
      expect(first.failedLoginCount).toBeUndefined();
      expect(first.lockedUntil).toBeUndefined();
    });
  });

  describe('POST / and PATCH response contract', () => {
    it('create returns redacted AdminUserResponse', async () => {
      const dto = { email: 'new@example.com', password: 'Secret123!', fullName: 'New User' } as never;
      const result = await controller.create(dto, adminReq() as never);
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result.email).toBe('alice@example.com');
      expect(result.fullName).toBe('Alice Nguyen');
      expect(createMock.execute).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@example.com', actorUserId: 'admin-1' }));
    });

    it('update returns redacted', async () => {
      const result = await controller.update('user-1', { fullName: 'Updated' } as never, adminReq() as never);
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result.fullName).toBe('Updated');
    });

    it('updateStatus returns redacted', async () => {
      const result = await controller.updateStatus('user-1', { status: 'LOCKED' } as never, adminReq() as never);
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(result.status).toBe('LOCKED');
    });

    it('getOne returns redacted and uses actor from token', async () => {
      const result = await controller.getOne('user-1', adminReq() as never);
      expect((result as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
      expect(getMock.execute).toHaveBeenCalledWith({ userId: 'user-1' });
    });
  });

  describe('no hard delete', () => {
    it('controller does not expose DELETE method', () => {
      const proto = Object.getOwnPropertyNames(AdminController.prototype);
      // Ensure no delete/remove/destroy method exists
      expect(proto.some((m) => /delete|remove|destroy/i.test(m))).toBe(false);
      // Also check that controller instance has no delete handler
      expect((controller as unknown as { delete?: unknown }).delete).toBeUndefined();
    });
  });
});
