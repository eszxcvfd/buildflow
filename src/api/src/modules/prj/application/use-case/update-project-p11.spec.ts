import { UpdateProjectUseCase } from './update-project.use-case';
import { ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { ProjectEntity } from '../../domain/entity/project.entity';

const PID = '11111111-1111-4111-8111-111111111111';
const MANAGER = '22222222-2222-4222-8222-222222222222';
const NEW_MANAGER = '44444444-4444-4444-8444-444444444444';
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

function activeUser(id: string): Record<string, unknown> {
  return { id, status: 'ACTIVE', userType: 'STAFF', fullName: `User ${id.slice(0, 4)}` };
}

/**
 * P11/M4 (issue #36, PRJ-SRS-005) — UPDATE đổi `managerId` auto-insert
 * membership MANAGER cho manager mới trong CÙNG tx (đối xứng P9 khi CREATE).
 */
describe('UpdateProjectUseCase P11 manager-change membership (issue #36)', () => {
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let userRepo: jest.Mocked<UserRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
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
      listMembers: jest.fn(),
      listMembersWithClient: jest.fn(),
      findMemberByIdWithClient: jest.fn(),
      findActiveMemberWithClient: jest.fn(async () => null),
      insertMemberWithClient: jest.fn(),
      deactivateMemberWithClient: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;
    userRepo = { findById: jest.fn(async () => activeUser(NEW_MANAGER) as never) } as unknown as jest.Mocked<UserRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn() } as unknown as jest.Mocked<AuditPort>;
    tx = {
      withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({})),
    } as unknown as jest.Mocked<TransactionPort>;
    useCase = new UpdateProjectUseCase(projectRepo, userRepo, audit, tx);
  });

  it('manager đổi + chưa member → insert MANAGER membership cùng client (sau save, trước audit)', async () => {
    const { entity } = await useCase.execute({ projectId: PID, managerId: NEW_MANAGER, actorUserId: ACTOR });
    expect(entity.managerId).toBe(NEW_MANAGER);
    expect(projectRepo.findActiveMemberWithClient).toHaveBeenCalledWith(expect.anything(), PID, NEW_MANAGER);
    expect(projectRepo.insertManagerMembershipWithClient).toHaveBeenCalledTimes(1);
    expect(projectRepo.insertManagerMembershipWithClient).toHaveBeenCalledWith(
      expect.anything(),
      { projectId: PID, userId: NEW_MANAGER, addedBy: ACTOR },
    );
    // Cùng tx client với save + audit.
    const txClient = (projectRepo.saveWithClient as jest.Mock).mock.calls[0][0];
    expect((projectRepo.insertManagerMembershipWithClient as jest.Mock).mock.calls[0][0]).toBe(txClient);
    expect((audit.logWithClient as jest.Mock).mock.calls[0][0]).toBe(txClient);
    // Audit PRJ_PROJECT_UPDATED vẫn 1 lần với after manager mới.
    expect(audit.logWithClient).toHaveBeenCalledTimes(1);
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload['action']).toBe('PRJ_PROJECT_UPDATED');
    expect((payload['afterData'] as Record<string, unknown>)['managerId']).toBe(NEW_MANAGER);
    expect((payload['afterData'] as Record<string, unknown>)['managerMembership']).toEqual({
      userId: NEW_MANAGER,
      autoInserted: true,
    });
  });

  it('manager mới đã là active member → không insert (idempotent), afterData.managerMembership.autoInserted=false', async () => {
    projectRepo.findActiveMemberWithClient.mockResolvedValue({ userId: NEW_MANAGER, isActive: true } as never);
    await useCase.execute({ projectId: PID, managerId: NEW_MANAGER, actorUserId: ACTOR });
    expect(projectRepo.insertManagerMembershipWithClient).not.toHaveBeenCalled();
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect((payload['afterData'] as Record<string, unknown>)['managerMembership']).toEqual({
      userId: NEW_MANAGER,
      autoInserted: false,
    });
  });

  it('manager không đổi (không gửi / gửi đúng id cũ) → không đụng memberships', async () => {
    userRepo.findById.mockResolvedValue(activeUser(MANAGER) as never);
    await useCase.execute({ projectId: PID, name: 'Dự án B', actorUserId: ACTOR });
    expect(projectRepo.findActiveMemberWithClient).not.toHaveBeenCalled();
    expect(projectRepo.insertManagerMembershipWithClient).not.toHaveBeenCalled();

    await useCase.execute({ projectId: PID, managerId: MANAGER, actorUserId: ACTOR });
    expect(projectRepo.findActiveMemberWithClient).not.toHaveBeenCalled();
    expect(projectRepo.insertManagerMembershipWithClient).not.toHaveBeenCalled();
  });

  it('membership manager cũ giữ nguyên: insert chỉ cho manager mới, không deactivate', async () => {
    await useCase.execute({ projectId: PID, managerId: NEW_MANAGER, actorUserId: ACTOR });
    const calls = (projectRepo.insertManagerMembershipWithClient as jest.Mock).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toEqual({ projectId: PID, userId: NEW_MANAGER, addedBy: ACTOR });
    expect(calls[0][1]['userId']).not.toBe(MANAGER);
    // Không có method deactivate nào trên membership trong update path.
    expect(projectRepo.deactivateMemberWithClient).not.toHaveBeenCalled();
  });

  it('race insert 23505 ux_project_members_active → swallow (coi như đã member), update vẫn thành công', async () => {
    (projectRepo.insertManagerMembershipWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_project_members_active' }),
    );
    const { entity } = await useCase.execute({ projectId: PID, managerId: NEW_MANAGER, actorUserId: ACTOR });
    expect(entity.managerId).toBe(NEW_MANAGER);
    expect(audit.logWithClient).toHaveBeenCalledTimes(1);
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect((payload['afterData'] as Record<string, unknown>)['managerMembership']).toEqual({
      userId: NEW_MANAGER,
      autoInserted: false,
    });
  });

  it('race insert bare 23505 (không constraint) → rethrow, KHÔNG silent success', async () => {
    (projectRepo.insertManagerMembershipWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505' }),
    );
    const err = await useCase
      .execute({ projectId: PID, managerId: NEW_MANAGER, actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((err as Record<string, unknown>)['code']).toBe('23505');
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });
});
