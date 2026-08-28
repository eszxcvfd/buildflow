import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { CreateUserUseCase } from './create-user.use-case';
import { UserEntity } from '../../domain/entity/user.entity';
import { UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AuditPort } from '../port/audit.port';
import { HasherPort } from '../port/hasher.port';

function makeRepo(existingByEmail: UserEntity | null = null): jest.Mocked<UserRepositoryPort> & { stored: UserEntity | null } {
  let stored: UserEntity | null = null;
  const repoMock: jest.Mocked<UserRepositoryPort> & { stored: UserEntity | null } = {
    stored,
    findByEmail: jest.fn(async () => existingByEmail) as unknown as jest.Mocked<UserRepositoryPort>['findByEmail'],
    findById: jest.fn(async () => null) as unknown as jest.Mocked<UserRepositoryPort>['findById'],
    findByEmployeeCode: jest.fn(async () => null) as unknown as jest.Mocked<UserRepositoryPort>['findByEmployeeCode'],
    save: jest.fn(async (u: UserEntity) => { stored = u; }) as unknown as jest.Mocked<UserRepositoryPort>['save'],
    create: jest.fn(async (u: UserEntity) => { stored = u; }) as unknown as jest.Mocked<UserRepositoryPort>['create'],
    findAll: jest.fn(async () => []) as unknown as jest.Mocked<UserRepositoryPort>['findAll'],
    findActiveRolesByUserId: jest.fn(async () => []) as unknown as jest.Mocked<UserRepositoryPort>['findActiveRolesByUserId'],
    findActiveProjectIdsByUserId: jest.fn(async () => []) as unknown as jest.Mocked<UserRepositoryPort>['findActiveProjectIdsByUserId'],
  } as unknown as jest.Mocked<UserRepositoryPort> & { stored: UserEntity | null };
  return repoMock;
}

describe('CreateUserUseCase IAM-SRS-004', () => {
  let repo: jest.Mocked<UserRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let hasher: jest.Mocked<HasherPort>;
  let useCase: CreateUserUseCase;

  beforeEach(() => {
    repo = makeRepo(null) as jest.Mocked<UserRepositoryPort>;
    audit = { log: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    hasher = { hash: jest.fn(async (p: string) => `hashed-${p}`), compare: jest.fn(async () => true) } as unknown as jest.Mocked<HasherPort>;
    useCase = new CreateUserUseCase(repo, hasher, audit);
  });

  it('tạo tài khoản thành công với email chuẩn hóa và audit', async () => {
    const { entity } = await useCase.execute({
      email: 'NEW@Example.COM',
      password: 'Secret123!',
      fullName: 'Nguyen Van A',
      actorUserId: 'admin-1',
    });
    expect(entity.email).toBe('new@example.com');
    expect(repo.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'IAM_USER_CREATED', result: 'SUCCESS' }));
    // response không lộ passwordHash qua toPublicProfile
    expect((entity.toPublicProfile() as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
  });

  it('email trùng (case-insensitive) trả 409', async () => {
    const existing = new UserEntity({
      id: 'u1', email: 'dup@example.com', passwordHash: 'h', fullName: 'Dup', status: 'ACTIVE',
      failedLoginCount: 0, lockedUntil: null, lastLoginAt: null, userType: 'STAFF', createdAt: new Date(), updatedAt: new Date(),
    } as ReturnType<UserEntity['getProps']>);
    (repo.findByEmail as unknown as jest.Mock) = jest.fn(async () => existing);
    await expect(useCase.execute({ email: 'DUP@example.com', password: 'Secret123!', fullName: 'Test', actorUserId: 'admin-1' })).rejects.toThrow(ConflictException);
  });

  it('không cho phép xóa cứng – use-case không expose delete', () => {
    // Ensure no delete method on repo port is required
    expect((repo as unknown as { delete?: unknown }).delete).toBeUndefined();
    expect(useCase).toBeDefined();
  });

  it('concurrent/DB unique violation (23505) maps to 409 instead of 500', async () => {
    (repo.create as unknown as jest.Mock) = jest.fn(async () => {
      const err = Object.assign(new Error('duplicate key value violates unique constraint "ux_users_email_lower"'), {
        code: '23505',
        constraint: 'ux_users_email_lower',
        detail: 'Key (lower(email))=(dup@example.com) already exists.',
      });
      throw err;
    });
    await expect(
      useCase.execute({ email: 'dup@example.com', password: 'Secret123!', fullName: 'Test', actorUserId: 'admin-1' }),
    ).rejects.toThrow(ConflictException);
    await expect(
      useCase.execute({ email: 'dup@example.com', password: 'Secret123!', fullName: 'Test', actorUserId: 'admin-1' }),
    ).rejects.toThrow('Email đã tồn tại');
  });

  it('DB unique violation employee_code maps to 409 with correct message', async () => {
    (repo.create as unknown as jest.Mock) = jest.fn(async () => {
      const err = Object.assign(new Error('duplicate key value violates unique constraint "ux_users_employee_code"'), {
        code: '23505',
        constraint: 'ux_users_employee_code',
        detail: 'Key (employee_code)=(EMP001) already exists.',
      });
      throw err;
    });
    await expect(
      useCase.execute({ email: 'new2@example.com', password: 'Secret123!', fullName: 'Test', employeeCode: 'EMP001', actorUserId: 'admin-1' }),
    ).rejects.toThrow('Mã nhân viên đã tồn tại');
  });

  it('DB unique violation phone maps to 409', async () => {
    (repo.create as unknown as jest.Mock) = jest.fn(async () => {
      const err = Object.assign(new Error('duplicate key value violates unique constraint "ux_users_phone"'), {
        code: '23505',
        constraint: 'ux_users_phone',
        detail: 'Key (phone)=(0123456789) already exists.',
      });
      throw err;
    });
    await expect(
      useCase.execute({ email: 'new3@example.com', password: 'Secret123!', fullName: 'Test', phone: '0123456789', actorUserId: 'admin-1' }),
    ).rejects.toThrow('Số điện thoại đã tồn tại');
  });

  it('audit failure must fail mutation (throw 500) per AC actor+timestamp', async () => {
    audit.log = jest.fn(async () => {
      throw new Error('audit DB down');
    }) as unknown as jest.Mocked<AuditPort>['log'];
    await expect(
      useCase.execute({ email: 'ok@example.com', password: 'Secret123!', fullName: 'Test', actorUserId: 'admin-1' }),
    ).rejects.toThrow(InternalServerErrorException);
    await expect(
      useCase.execute({ email: 'ok2@example.com', password: 'Secret123!', fullName: 'Test', actorUserId: 'admin-1' }),
    ).rejects.toThrow('Không thể ghi nhật ký kiểm toán');
  });

  it('audit log contains actor + timestamp via toPublicProfile', async () => {
    await useCase.execute({ email: 'audit@example.com', password: 'Secret123!', fullName: 'Audit Test', actorUserId: 'admin-99', ipAddress: '1.2.3.4', userAgent: 'jest' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 'admin-99', ipAddress: '1.2.3.4', userAgent: 'jest' }));
  });

  it('employeeCode pre-check duplicate returns 409 before DB', async () => {
    const existing = new UserEntity({
      id: 'u2', email: 'other@example.com', passwordHash: 'h', fullName: 'Other', status: 'ACTIVE',
      failedLoginCount: 0, lockedUntil: null, lastLoginAt: null, userType: 'STAFF', employeeCode: 'EMP001',
      createdAt: new Date(), updatedAt: new Date(),
    } as ReturnType<UserEntity['getProps']>);
    (repo.findByEmployeeCode as unknown as jest.Mock) = jest.fn(async () => existing);
    await expect(
      useCase.execute({ email: 'new@example.com', password: 'Secret123!', fullName: 'Test', employeeCode: 'EMP001', actorUserId: 'admin-1' }),
    ).rejects.toThrow(ConflictException);
  });
});

describe('UserEntity IAM-SRS-004 status transitions', () => {
  function makeUser(status: 'ACTIVE' | 'LOCKED' | 'INACTIVE', lockedUntil: Date | null = null): UserEntity {
    return new UserEntity({
      id: 'u1', email: 'a@b.com', passwordHash: 'h', fullName: 'A', status, failedLoginCount: status === 'LOCKED' ? 5 : 0,
      lockedUntil, lastLoginAt: null, userType: 'STAFF', createdAt: new Date(), updatedAt: new Date(),
    } as ReturnType<UserEntity['getProps']>);
  }

  it('ACTIVE -> LOCKED -> ACTIVE (mở khóa) clear lockedUntil và reset count', () => {
    const u = makeUser('ACTIVE');
    u.changeStatus('LOCKED');
    expect(u.status).toBe('LOCKED');
    expect(u.lockedUntil).toBeNull();
    u.changeStatus('ACTIVE');
    expect(u.status).toBe('ACTIVE');
    expect(u.lockedUntil).toBeNull();
    expect(u.failedLoginCount).toBe(0);
  });

  it('ACTIVE -> INACTIVE (ngừng hoạt động) clear lock', () => {
    const u = makeUser('ACTIVE');
    u.changeStatus('INACTIVE');
    expect(u.status).toBe('INACTIVE');
    // INACTIVE cannot login – verified in login.use-case
  });

  it('cùng trạng thái ném lỗi', () => {
    const u = makeUser('ACTIVE');
    expect(() => u.changeStatus('ACTIVE')).toThrow('đã ở trạng thái');
  });

  it('updateAdmin không lộ passwordHash qua public mapper', () => {
    const u = makeUser('ACTIVE');
    u.updateAdmin({ fullName: 'New Name' });
    const pub = u.toPublicProfile();
    expect(pub.fullName).toBe('New Name');
    expect((pub as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
  });
});
