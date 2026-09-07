import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { CreateProjectUseCase } from './create-project.use-case';
import { ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectEntity } from '../../domain/entity/project.entity';

const MANAGER = '22222222-2222-4222-8222-222222222222';
const ACTOR = '33333333-3333-4333-8333-333333333333';

function makeInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    code: 'PRJ-001',
    name: 'Dự án A',
    description: null,
    address: '123 Đường Láng',
    timezone: null,
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2026-12-31',
    managerId: MANAGER,
    actorUserId: ACTOR,
    ipAddress: null,
    userAgent: null,
    correlationId: null,
    ...overrides,
  };
}

function activeUser(): Record<string, unknown> {
  return { id: MANAGER, status: 'ACTIVE', userType: 'STAFF', fullName: 'Nguyen Van A' };
}

describe('CreateProjectUseCase PRJ-SRS-001 (issue #32)', () => {
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let userRepo: jest.Mocked<UserRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: CreateProjectUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(),
      findByCode: jest.fn(async () => null),
      findForUpdateWithClient: jest.fn(),
      findManagerNameWithClient: jest.fn(async () => 'Nguyen Van A'),
      createWithClient: jest.fn(),
      saveWithClient: jest.fn(),
      insertManagerMembershipWithClient: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;
    userRepo = { findById: jest.fn(async () => activeUser() as never) } as unknown as jest.Mocked<UserRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn() } as unknown as jest.Mocked<AuditPort>;
    tx = {
      withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({})),
    } as unknown as jest.Mocked<TransactionPort>;
    useCase = new CreateProjectUseCase(projectRepo, userRepo, audit, tx);
  });

  it('happy: status luôn DRAFT + audit PRJ_PROJECT_CREATED entityType PROJECT', async () => {
    const { entity, managerName } = await useCase.execute(makeInput() as never);
    expect(entity.status).toBe('DRAFT');
    expect(entity.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(managerName).toBe('Nguyen Van A');
    expect(projectRepo.createWithClient).toHaveBeenCalled();
    expect(audit.logWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: ACTOR,
        action: 'PRJ_PROJECT_CREATED',
        entityType: 'PROJECT',
        entityId: entity.id,
        result: 'SUCCESS',
      }),
    );
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect((payload['afterData'] as Record<string, unknown>)['status']).toBe('DRAFT');
    expect((payload['afterData'] as Record<string, unknown>)['code']).toBe('PRJ-001');
  });

  it('P9: manager auto-added ACTIVE member MANAGER trong cùng tx', async () => {
    const { entity } = await useCase.execute(makeInput() as never);
    expect(projectRepo.insertManagerMembershipWithClient).toHaveBeenCalledTimes(1);
    // cùng client tx với create + audit (tx mock truyền cùng object client)
    const txClient = (projectRepo.createWithClient as jest.Mock).mock.calls[0][0];
    expect(projectRepo.insertManagerMembershipWithClient).toHaveBeenCalledWith(txClient, {
      projectId: entity.id,
      userId: MANAGER,
      addedBy: ACTOR,
    });
    expect((audit.logWithClient as jest.Mock).mock.calls[0][0]).toBe(txClient);
  });

  it('DRAFT forced: input không có kênh set status (DTO whitelist) — entity luôn DRAFT', async () => {
    // input type không có `status`; ép field lạ cũng bị entity ép DRAFT
    const { entity } = await useCase.execute({ ...makeInput(), status: 'ACTIVE' } as never);
    expect(entity.status).toBe('DRAFT');
  });

  it('duplicate pre-check (case-insensitive) → 409 PROJECT_CODE_DUPLICATE', async () => {
    projectRepo.findByCode.mockResolvedValue(
      new ProjectEntity({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        code: 'prj-001',
        name: 'Cũ',
        address: 'X',
        timezone: 'Asia/Ho_Chi_Minh',
        plannedStartDate: '2026-01-01',
        plannedEndDate: '2026-02-01',
        managerId: MANAGER,
        status: 'DRAFT',
        createdBy: ACTOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    const err = await useCase.execute(makeInput() as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toEqual({
      statusCode: 409,
      message: 'Mã dự án đã tồn tại',
      code: 'PROJECT_CODE_DUPLICATE',
    });
    expect(projectRepo.createWithClient).not.toHaveBeenCalled();
  });

  it('race 23505/ux_projects_code trong tx → 409 PROJECT_CODE_DUPLICATE (constraint-order)', async () => {
    projectRepo.createWithClient.mockRejectedValue({ code: '23505', constraint: 'ux_projects_code' });
    const err = await useCase.execute(makeInput() as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toEqual(
      expect.objectContaining({ statusCode: 409, code: 'PROJECT_CODE_DUPLICATE' }),
    );
  });

  it('race 23505 generic (không tên constraint) → 409 (id là randomUUID)', async () => {
    projectRepo.createWithClient.mockRejectedValue({ code: '23505', constraint: '' });
    const err = await useCase.execute(makeInput() as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
  });

  it('lỗi DB khác → 500 (rethrow, rollback)', async () => {
    projectRepo.createWithClient.mockRejectedValue({ code: '40001' });
    const err = await useCase.execute(makeInput() as never).catch((e: unknown) => e);
    expect(err).toEqual(expect.objectContaining({ code: '40001' }));
  });

  it('manager không tồn tại / INACTIVE / sai uuid → 400 fieldErrors {managerId}', async () => {
    userRepo.findById.mockResolvedValue(null);
    let err = (await useCase.execute(makeInput() as never).catch((e: unknown) => e)) as BadRequestException;
    expect(err.getResponse()).toEqual({
      statusCode: 400,
      message: 'Quản lý dự án không tồn tại',
      fieldErrors: { managerId: ['Quản lý dự án không tồn tại'] },
    });

    userRepo.findById.mockResolvedValue({ ...activeUser(), status: 'INACTIVE' } as never);
    err = (await useCase.execute(makeInput() as never).catch((e: unknown) => e)) as BadRequestException;
    expect((err.getResponse() as Record<string, unknown>)['fieldErrors']).toEqual({
      managerId: ['Quản lý dự án phải đang hoạt động'],
    });

    err = (await useCase
      .execute(makeInput({ managerId: 'not-a-uuid' }) as never)
      .catch((e: unknown) => e)) as BadRequestException;
    expect((err.getResponse() as Record<string, unknown>)['fieldErrors']).toEqual({
      managerId: ['Quản lý dự án không hợp lệ'],
    });
  });

  it('dates violation (end < start) → 400 fieldErrors TRƯỚC DB (không gọi repo.create)', async () => {
    const err = (await useCase
      .execute(makeInput({ plannedStartDate: '2026-12-31', plannedEndDate: '2026-01-01' }) as never)
      .catch((e: unknown) => e)) as BadRequestException;
    expect((err.getResponse() as Record<string, unknown>)['fieldErrors']).toHaveProperty('plannedEndDate');
    expect(projectRepo.findByCode).not.toHaveBeenCalled();
    expect(projectRepo.createWithClient).not.toHaveBeenCalled();
  });

  it('code sai format → 400 fieldErrors {code}', async () => {
    const err = (await useCase
      .execute(makeInput({ code: 'PRJ 001!' }) as never)
      .catch((e: unknown) => e)) as BadRequestException;
    expect((err.getResponse() as Record<string, unknown>)['fieldErrors']).toHaveProperty('code');
  });

  it('audit thất bại → 500 rollback (catch-all)', async () => {
    (audit.logWithClient as unknown as jest.Mock).mockRejectedValue(new Error('audit down'));
    const err = await useCase.execute(makeInput() as never).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
  });
});
