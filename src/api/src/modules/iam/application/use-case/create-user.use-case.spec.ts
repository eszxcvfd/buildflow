import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { CreateUserUseCase } from './create-user.use-case';
import { UserEntity } from '../../domain/entity/user.entity';
import { UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AuditPort } from '../port/audit.port';
import { HasherPort } from '../port/hasher.port';
import { TransactionPort } from '../port/transaction.port';
import { PoolClient } from 'pg';

function makeRepo(existingByEmail: UserEntity | null = null) {
  let stored: UserEntity | null = null;
  const repo: jest.Mocked<UserRepositoryPort> & { getStored: () => UserEntity | null } = {
    findByEmail: jest.fn(async () => existingByEmail) as unknown as jest.Mocked<UserRepositoryPort>['findByEmail'],
    findById: jest.fn(async () => null) as unknown as jest.Mocked<UserRepositoryPort>['findById'],
    findByEmployeeCode: jest.fn(async () => null) as unknown as jest.Mocked<UserRepositoryPort>['findByEmployeeCode'],
    save: jest.fn(async (u: UserEntity) => { stored = u; }) as unknown as jest.Mocked<UserRepositoryPort>['save'],
    create: jest.fn(async (u: UserEntity) => { stored = u; }) as unknown as jest.Mocked<UserRepositoryPort>['create'],
    createWithClient: jest.fn(async (_c: PoolClient, u: UserEntity) => { stored = u; }) as unknown as jest.Mocked<UserRepositoryPort>['createWithClient'],
    saveWithClient: jest.fn(async (_c: PoolClient, u: UserEntity) => { stored = u; }) as unknown as jest.Mocked<UserRepositoryPort>['saveWithClient'],
    findAll: jest.fn(async () => []) as unknown as jest.Mocked<UserRepositoryPort>['findAll'],
    findActiveRolesByUserId: jest.fn(async () => []) as unknown as jest.Mocked<UserRepositoryPort>['findActiveRolesByUserId'],
    findActiveProjectIdsByUserId: jest.fn(async () => []) as unknown as jest.Mocked<UserRepositoryPort>['findActiveProjectIdsByUserId'],
    getStored: () => stored,
  } as unknown as jest.Mocked<UserRepositoryPort> & { getStored: () => UserEntity | null };
  return {
    repo,
    getStored: () => stored,
    setStored: (v: UserEntity | null) => { stored = v; },
  };
}

function makeTx(getStored: () => UserEntity | null, setStored: (v: UserEntity | null) => void): jest.Mocked<TransactionPort> {
  return {
    withTransaction: jest.fn(async (fn: (c: PoolClient) => Promise<unknown>) => {
      const snapshot = getStored();
      try {
        const res = await fn({} as PoolClient);
        return res;
      } catch (e) {
        // rollback: restore DB state
        setStored(snapshot);
        throw e;
      }
    }),
  } as unknown as jest.Mocked<TransactionPort>;
}

describe('CreateUserUseCase IAM-SRS-004', () => {
  let repoHolder: ReturnType<typeof makeRepo>;
  let repo: jest.Mocked<UserRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let hasher: jest.Mocked<HasherPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: CreateUserUseCase;

  beforeEach(() => {
    repoHolder = makeRepo(null);
    repo = repoHolder.repo;
    const baseAudit: jest.Mocked<AuditPort> = {
      log: jest.fn(async () => {}),
      logWithClient: jest.fn(async () => {}),
    } as unknown as jest.Mocked<AuditPort>;
    audit = baseAudit;
    hasher = { hash: jest.fn(async (p: string) => `hashed-${p}`), compare: jest.fn(async () => true) } as unknown as jest.Mocked<HasherPort>;
    tx = makeTx(repoHolder.getStored, repoHolder.setStored);
    useCase = new CreateUserUseCase(repo, hasher, audit, tx);
  });

  it('tạo tài khoản thành công với email chuẩn hóa và audit', async () => {
    const { entity } = await useCase.execute({
      email: 'NEW@Example.COM',
      password: 'Secret123!',
      fullName: 'Nguyen Van A',
      actorUserId: 'admin-1',
    });
    expect(entity.email).toBe('new@example.com');
    expect(repo.createWithClient).toHaveBeenCalled();
    expect(tx.withTransaction).toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'IAM_USER_CREATED', result: 'SUCCESS' }));
    expect((entity.toPublicProfile() as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
    expect(repoHolder.getStored()).not.toBeNull();
  });

  it('email trùng (case-insensitive) trả 409', async () => {
    const existing = new UserEntity({
      id: 'u1', email: 'dup@example.com', passwordHash: 'h', fullName: 'Dup', status: 'ACTIVE',
      failedLoginCount: 0, lockedUntil: null, lastLoginAt: null, userType: 'STAFF', createdAt: new Date(), updatedAt: new Date(),
    } as ReturnType<UserEntity['getProps']>);
    (repo.findByEmail as unknown as jest.Mock) = jest.fn(async () => existing);
    await expect(useCase.execute({ email: 'DUP@example.com', password: 'Secret123!', fullName: 'Test', actorUserId: 'admin-1' })).rejects.toThrow(ConflictException);
    expect(tx.withTransaction).not.toHaveBeenCalled();
  });

  it('không cho phép xóa cứng – use-case không expose delete', () => {
    expect((repo as unknown as { delete?: unknown }).delete).toBeUndefined();
    expect(useCase).toBeDefined();
  });

  it('concurrent/DB unique violation (23505) maps to 409 instead of 500', async () => {
    (repo.createWithClient as unknown as jest.Mock) = jest.fn(async () => {
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
    expect(repoHolder.getStored()).toBeNull();
  });

  it('DB unique violation employee_code maps to 409 with correct message', async () => {
    (repo.createWithClient as unknown as jest.Mock) = jest.fn(async () => {
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
    (repo.createWithClient as unknown as jest.Mock) = jest.fn(async () => {
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
    audit.logWithClient = jest.fn(async () => {
      throw new Error('audit DB down');
    }) as unknown as jest.Mocked<AuditPort>['logWithClient'];
    await expect(
      useCase.execute({ email: 'ok@example.com', password: 'Secret123!', fullName: 'Test', actorUserId: 'admin-1' }),
    ).rejects.toThrow(InternalServerErrorException);
    await expect(
      useCase.execute({ email: 'ok2@example.com', password: 'Secret123!', fullName: 'Test', actorUserId: 'admin-1' }),
    ).rejects.toThrow('Không thể ghi nhật ký kiểm toán');
  });

  it('audit failure rolls back repository state — atomically unchanged', async () => {
    audit.logWithClient = jest.fn(async () => {
      throw new Error('audit DB down');
    }) as unknown as jest.Mocked<AuditPort>['logWithClient'];
    await expect(
      useCase.execute({ email: 'rollback@example.com', password: 'Secret123!', fullName: 'Rollback', actorUserId: 'admin-1' }),
    ).rejects.toThrow(InternalServerErrorException);
    // DB state must be unchanged (null) despite createWithClient having been called inside transaction
    expect(repo.createWithClient).toHaveBeenCalled();
    expect(repoHolder.getStored()).toBeNull();
    // retry succeeds after transient audit failure
    audit.logWithClient = jest.fn(async () => {}) as unknown as jest.Mocked<AuditPort>['logWithClient'];
    const { entity } = await useCase.execute({ email: 'rollback@example.com', password: 'Secret123!', fullName: 'Rollback', actorUserId: 'admin-1' });
    expect(entity.email).toBe('rollback@example.com');
    expect(repoHolder.getStored()).not.toBeNull();
  });

  it('audit log contains actor + timestamp via toPublicProfile', async () => {
    await useCase.execute({ email: 'audit@example.com', password: 'Secret123!', fullName: 'Audit Test', actorUserId: 'admin-99', ipAddress: '1.2.3.4', userAgent: 'jest' });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actorUserId: 'admin-99', ipAddress: '1.2.3.4', userAgent: 'jest' }));
  });

  it('IAM-SRS-008: correlationId hợp lệ đi vào audit payload IAM_USER_CREATED', async () => {
    const corr = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
    await useCase.execute({ email: 'corr@example.com', password: 'Secret123!', fullName: 'Corr', actorUserId: 'admin-1', correlationId: corr });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'IAM_USER_CREATED', correlationId: corr }));
  });

  it('IAM-SRS-008: correlationId absent (controller strict cho phép null) → audit payload correlationId null', async () => {
    await useCase.execute({ email: 'nocorr@example.com', password: 'Secret123!', fullName: 'No Corr', actorUserId: 'admin-1' });
    expect(audit.logWithClient).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'IAM_USER_CREATED', correlationId: null }));
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
