import { BadRequestException, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { AddCrewMemberUseCase } from './add-crew-member.use-case';
import { CrewRepositoryPort, CrewMemberRow } from '../../domain/repository/crew-repository.port';
import { UserRepositoryPort } from '../../../iam/domain/repository/user-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { CrewEntity } from '../../domain/entity/crew.entity';

const CREW_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR = '22222222-2222-4222-8222-222222222222';

function makeCrew(status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'): CrewEntity {
  return new CrewEntity({
    id: CREW_ID,
    code: 'CREW-001',
    name: 'Đội Alpha',
    status,
    leaderUserId: null,
    createdBy: ACTOR,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

function makeMember(overrides: Partial<CrewMemberRow> = {}): CrewMemberRow {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    crewId: CREW_ID,
    userId: USER_ID,
    memberRole: 'MEMBER',
    effectiveFrom: '2026-09-01',
    effectiveTo: null,
    isActive: true,
    addedBy: ACTOR,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    userName: 'Nguyen Van A',
    userCode: 'EMP-1',
    ...overrides,
  };
}

function activeUser(status = 'ACTIVE', userType = 'WORKER'): never {
  return { userType, status } as never;
}

describe('AddCrewMemberUseCase ORG-SRS-007 (issue #30)', () => {
  let crewRepo: jest.Mocked<CrewRepositoryPort>;
  let userRepo: jest.Mocked<UserRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: AddCrewMemberUseCase;

  beforeEach(() => {
    crewRepo = {
      findById: jest.fn(async () => makeCrew()),
      findByCode: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      insertLeadWithClient: jest.fn(),
      deactivateActiveLeadWithClient: jest.fn(),
      countOpenAssignments: jest.fn(async () => 0),
      listMembersWithClient: jest.fn(),
      findMemberByIdWithClient: jest.fn(),
      findActiveMemberWithClient: jest.fn(async () => null),
      findActiveMembershipsOfUserWithClient: jest.fn(async () => []),
      insertMemberWithClient: jest.fn(async (_c, input) => makeMember({ userId: input.userId, effectiveFrom: input.effectiveFrom })),
      deactivateMemberWithClient: jest.fn(),
      findCrewForUpdateWithClient: jest.fn(async (_c, id) => ({ id, code: 'CREW-001', name: 'Đội Alpha', status: 'ACTIVE' })),
    } as unknown as jest.Mocked<CrewRepositoryPort>;
    userRepo = {
      findById: jest.fn(async () => activeUser()),
    } as unknown as jest.Mocked<UserRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new AddCrewMemberUseCase(crewRepo, userRepo, audit, tx);
  });

  it('happy path: insert MEMBER + audit ORG_CREW_MEMBER_ADDED (entityType CREW, crew code, không warning)', async () => {
    const out = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, effectiveFrom: '2026-09-01', actorUserId: ACTOR });
    expect(out.member.memberRole).toBe('MEMBER');
    expect(out.member.effectiveFrom).toBe('2026-09-01');
    expect(out.warning).toBeUndefined();
    expect(crewRepo.insertMemberWithClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ crewId: CREW_ID, userId: USER_ID, effectiveFrom: '2026-09-01', addedBy: ACTOR }),
    );
    expect(crewRepo.findCrewForUpdateWithClient).toHaveBeenCalledWith(expect.anything(), CREW_ID);
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toEqual(expect.objectContaining({
      actorUserId: ACTOR,
      action: 'ORG_CREW_MEMBER_ADDED',
      entityType: 'CREW',
      entityId: CREW_ID,
      result: 'SUCCESS',
    }));
    expect(payload.beforeData).toBeNull();
    expect(payload.afterData).toEqual(expect.objectContaining({ userId: USER_ID, crewCode: 'CREW-001' }));
    expect(payload.afterData).not.toHaveProperty('_warning');
  });

  it('duplicate trong cùng đội (pre-check) → 409 MEMBER_DUPLICATE, không insert/audit', async () => {
    crewRepo.findActiveMemberWithClient.mockResolvedValue(makeMember());
    const err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toEqual({
      statusCode: 409, message: 'Thành viên đã thuộc đội', code: 'MEMBER_DUPLICATE',
    });
    expect(crewRepo.insertMemberWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('race duplicate (23505 ux_crew_member_active) → 409 MEMBER_DUPLICATE (constraint-order trước generic)', async () => {
    (crewRepo.insertMemberWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505', constraint: 'ux_crew_member_active' }),
    );
    const err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'MEMBER_DUPLICATE' }));
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('generic 23505 không constraint → 409 MEMBER_DUPLICATE; lỗi DB lạ → rethrow (500, không 400)', async () => {
    (crewRepo.insertMemberWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505', constraint: '' }),
    );
    await expect(useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR })).rejects.toThrow(ConflictException);
    const dbErr = new Error('connection terminated');
    (crewRepo.insertMemberWithClient as jest.Mock).mockRejectedValue(dbErr);
    const err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect(err).toBe(dbErr);
    expect(err).not.toBeInstanceOf(BadRequestException);
  });

  it('overlap đội khác → vẫn 201 kèm warning MEMBER_IN_OTHER_CREW + _warning audit', async () => {
    const others = [{ crewId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', crewCode: 'CREW-B', crewName: 'Đội B' }];
    crewRepo.findActiveMembershipsOfUserWithClient.mockResolvedValue(others);
    const out = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR });
    expect(out.warning).toEqual({ code: 'MEMBER_IN_OTHER_CREW', otherCrews: others });
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as { afterData: Record<string, unknown> };
    expect(payload.afterData['_warning']).toContain('CREW-B');
  });

  it('đội INACTIVE (pre-check) → 409 CREW_INACTIVE, không insert', async () => {
    crewRepo.findById.mockResolvedValue(makeCrew('INACTIVE'));
    const err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'CREW_INACTIVE' }));
    expect(crewRepo.insertMemberWithClient).not.toHaveBeenCalled();
  });

  it('đội đổi INACTIVE giữa chừng (re-check FOR UPDATE trong tx) → 409 CREW_INACTIVE', async () => {
    crewRepo.findCrewForUpdateWithClient.mockResolvedValue({ id: CREW_ID, code: 'CREW-001', name: 'Đội Alpha', status: 'INACTIVE' });
    const err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'CREW_INACTIVE' }));
    expect(crewRepo.insertMemberWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('đội không tồn tại → 404; user không tồn tại/sai type → 404 USER_NOT_FOUND', async () => {
    crewRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR })).rejects.toThrow(NotFoundException);
    crewRepo.findById.mockResolvedValue(makeCrew());
    userRepo.findById.mockResolvedValue(null);
    let err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect((err as NotFoundException).getResponse()).toEqual(expect.objectContaining({ code: 'USER_NOT_FOUND' }));
    userRepo.findById.mockResolvedValue({ userType: 'ADMIN', status: 'ACTIVE' } as never);
    err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect((err as NotFoundException).getResponse()).toEqual(expect.objectContaining({ code: 'USER_NOT_FOUND' }));
  });

  it('user INACTIVE → 409 USER_INACTIVE; STAFF active OK', async () => {
    userRepo.findById.mockResolvedValue(activeUser('INACTIVE'));
    const err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect((err as ConflictException).getResponse()).toEqual(expect.objectContaining({ code: 'USER_INACTIVE' }));
    userRepo.findById.mockResolvedValue(activeUser('ACTIVE', 'STAFF'));
    const out = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR });
    expect(out.member.userId).toBe(USER_ID);
  });

  it('effectiveFrom sai → 400 fieldErrors, không chạm DB', async () => {
    const err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, effectiveFrom: '2026-02-30', actorUserId: ACTOR }).catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Ngày hiệu lực không hợp lệ (YYYY-MM-DD)',
      fieldErrors: { effectiveFrom: ['Ngày hiệu lực không hợp lệ (YYYY-MM-DD)'] },
    });
    expect(crewRepo.findById).not.toHaveBeenCalled();
    await expect(useCase.execute({ crewId: CREW_ID, userId: 'bad', actorUserId: ACTOR })).rejects.toThrow(BadRequestException);
  });

  it('audit thất bại → 500 rollback (bất kể kiểu lỗi gốc, kể cả HttpException)', async () => {
    (audit.logWithClient as jest.Mock).mockRejectedValue(new Error('audit down'));
    await expect(useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR })).rejects.toThrow(InternalServerErrorException);
    (audit.logWithClient as jest.Mock).mockRejectedValue(
      new ConflictException({ statusCode: 409, message: 'conflict trong audit', code: 'AUDIT_CONFLICT' }),
    );
    const err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
    expect((err as InternalServerErrorException).getResponse()).toEqual(expect.objectContaining({ statusCode: 500 }));
  });

  it('audit fail closed: adapter không có logWithClient → 500, không ghi non-tx', async () => {
    const noTxAudit = { log: jest.fn(async () => {}) } as unknown as AuditPort;
    const uc = new AddCrewMemberUseCase(crewRepo, userRepo, noTxAudit, tx);
    const err = await uc.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
    expect(noTxAudit.log).not.toHaveBeenCalled();
  });

  it('23514 trần (không constraint name) → 400 fieldErrors effectiveFrom', async () => {
    (crewRepo.insertMemberWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('check failed'), { code: '23514' }),
    );
    const err = await useCase.execute({ crewId: CREW_ID, userId: USER_ID, actorUserId: ACTOR }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'khoảng thời gian hiệu lực không hợp lệ',
      fieldErrors: { effectiveFrom: ['khoảng thời gian hiệu lực không hợp lệ'] },
    });
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });
});
