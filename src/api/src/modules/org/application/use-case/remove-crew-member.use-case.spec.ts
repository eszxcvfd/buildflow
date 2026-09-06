import { BadRequestException, ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { RemoveCrewMemberUseCase } from './remove-crew-member.use-case';
import { CrewRepositoryPort, CrewMemberRow } from '../../domain/repository/crew-repository.port';
import { AuditPort } from '../../../iam/application/port/audit.port';
import { TransactionPort } from '../../../iam/application/port/transaction.port';
import { CrewEntity } from '../../domain/entity/crew.entity';

const CREW_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const ACTOR = '22222222-2222-4222-8222-222222222222';

function makeMember(overrides: Partial<CrewMemberRow> = {}): CrewMemberRow {
  return {
    id: MEMBER_ID,
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

function makeCrew(): CrewEntity {
  return new CrewEntity({
    id: CREW_ID,
    code: 'CREW-001',
    name: 'Đội Alpha',
    status: 'ACTIVE',
    leaderUserId: null,
    createdBy: ACTOR,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

describe('RemoveCrewMemberUseCase ORG-SRS-007 (issue #30)', () => {
  let crewRepo: jest.Mocked<CrewRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let tx: jest.Mocked<TransactionPort>;
  let useCase: RemoveCrewMemberUseCase;

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
      findMemberByIdWithClient: jest.fn(async () => makeMember()),
      findActiveMemberWithClient: jest.fn(),
      findActiveMembershipsOfUserWithClient: jest.fn(async () => []),
      insertMemberWithClient: jest.fn(),
      deactivateMemberWithClient: jest.fn(async (_c, id) => makeMember({ id, isActive: false, effectiveTo: '2026-09-06' })),
      findCrewForUpdateWithClient: jest.fn(),
      findCrewByIdWithClient: jest.fn(async (_c, id) => ({ id, code: 'CREW-001', name: 'Đội Alpha', status: 'ACTIVE' })),
    } as unknown as jest.Mocked<CrewRepositoryPort>;
    audit = { log: jest.fn(), logWithClient: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;
    tx = { withTransaction: jest.fn(async (fn: (c: unknown) => Promise<unknown>) => fn({} as never)) } as unknown as jest.Mocked<TransactionPort>;
    useCase = new RemoveCrewMemberUseCase(crewRepo, audit, tx);
  });

  it('happy path: soft-deactivate + audit ORG_CREW_MEMBER_REMOVED (reason ở cột reason, before/after + crewCode)', async () => {
    const out = await useCase.execute({ crewId: CREW_ID, memberId: MEMBER_ID, effectiveTo: '2026-09-06', reason: 'Nghỉ việc', actorUserId: ACTOR });
    expect(out.alreadyRemoved).toBe(false);
    expect(out.member.isActive).toBe(false);
    expect(out.member.effectiveTo).toBe('2026-09-06');
    expect(crewRepo.deactivateMemberWithClient).toHaveBeenCalledWith(expect.anything(), MEMBER_ID, '2026-09-06');
    const payload = (audit.logWithClient as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toEqual(expect.objectContaining({
      actorUserId: ACTOR,
      action: 'ORG_CREW_MEMBER_REMOVED',
      entityType: 'CREW',
      entityId: CREW_ID,
      reason: 'Nghỉ việc',
      result: 'SUCCESS',
    }));
    expect(payload.beforeData).toEqual(expect.objectContaining({ id: MEMBER_ID, isActive: true, crewCode: 'CREW-001' }));
    expect(payload.afterData).toEqual(expect.objectContaining({ id: MEMBER_ID, isActive: false, crewCode: 'CREW-001' }));
  });

  it('member là LEAD → 409 MEMBER_IS_LEAD, không deactivate/audit', async () => {
    crewRepo.findMemberByIdWithClient.mockResolvedValue(makeMember({ memberRole: 'LEAD' }));
    const err = await useCase
      .execute({ crewId: CREW_ID, memberId: MEMBER_ID, actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toEqual({
      statusCode: 409,
      message: 'Trưởng nhóm không thể xóa qua đây — đổi trưởng nhóm qua sửa hồ sơ đội (leaderUserId)',
      code: 'MEMBER_IS_LEAD',
    });
    expect(crewRepo.deactivateMemberWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('LEAD đã inactive cũng bị chặn (guard trước idempotent branch) → 409 MEMBER_IS_LEAD', async () => {
    crewRepo.findMemberByIdWithClient.mockResolvedValue(makeMember({ memberRole: 'LEAD', isActive: false }));
    const err = await useCase
      .execute({ crewId: CREW_ID, memberId: MEMBER_ID, actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toHaveProperty('code', 'MEMBER_IS_LEAD');
    expect(crewRepo.deactivateMemberWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('audit đọc crew trong tx (findCrewByIdWithClient), không pool findById', async () => {
    await useCase.execute({ crewId: CREW_ID, memberId: MEMBER_ID, actorUserId: ACTOR });
    expect(crewRepo.findCrewByIdWithClient).toHaveBeenCalledWith(expect.anything(), CREW_ID);
    expect(crewRepo.findById).not.toHaveBeenCalled();
  });
  it('alreadyRemoved idempotent: 200, không mutation, không audit', async () => {
    crewRepo.findMemberByIdWithClient.mockResolvedValue(makeMember({ isActive: false, effectiveTo: '2026-09-02' }));
    const out = await useCase.execute({ crewId: CREW_ID, memberId: MEMBER_ID, actorUserId: ACTOR });
    expect(out.alreadyRemoved).toBe(true);
    expect(out.member.isActive).toBe(false);
    expect(crewRepo.deactivateMemberWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('member không tồn tại / khác đội → 404', async () => {
    crewRepo.findMemberByIdWithClient.mockResolvedValue(null);
    await expect(useCase.execute({ crewId: CREW_ID, memberId: MEMBER_ID, actorUserId: ACTOR })).rejects.toThrow(NotFoundException);
    crewRepo.findMemberByIdWithClient.mockResolvedValue(makeMember({ crewId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }));
    await expect(useCase.execute({ crewId: CREW_ID, memberId: MEMBER_ID, actorUserId: ACTOR })).rejects.toThrow(NotFoundException);
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('effectiveTo < effectiveFrom → 400 fieldErrors, không deactivate', async () => {
    const err = await useCase
      .execute({ crewId: CREW_ID, memberId: MEMBER_ID, effectiveTo: '2026-08-01', actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Ngày kết thúc phải từ ngày hiệu lực trở đi',
      fieldErrors: { effectiveTo: ['Ngày kết thúc phải từ ngày hiệu lực trở đi'] },
    });
    expect(crewRepo.deactivateMemberWithClient).not.toHaveBeenCalled();
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('effectiveTo sai format / reason >500 → 400 fieldErrors', async () => {
    await expect(
      useCase.execute({ crewId: CREW_ID, memberId: MEMBER_ID, effectiveTo: 'not-a-date', actorUserId: ACTOR }),
    ).rejects.toThrow(BadRequestException);
    const err = await useCase
      .execute({ crewId: CREW_ID, memberId: MEMBER_ID, reason: 'x'.repeat(501), actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toEqual(expect.objectContaining({
      statusCode: 400,
      fieldErrors: { reason: ['Lý do tối đa 500 ký tự'] },
    }));
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });

  it('audit thất bại → 500 (bất kể kiểu lỗi gốc, kể cả HttpException)', async () => {
    (audit.logWithClient as jest.Mock).mockRejectedValue(new Error('audit down'));
    await expect(
      useCase.execute({ crewId: CREW_ID, memberId: MEMBER_ID, actorUserId: ACTOR }),
    ).rejects.toThrow(InternalServerErrorException);
    (audit.logWithClient as jest.Mock).mockRejectedValue(
      new ConflictException({ statusCode: 409, message: 'conflict trong audit', code: 'AUDIT_CONFLICT' }),
    );
    const err = await useCase
      .execute({ crewId: CREW_ID, memberId: MEMBER_ID, actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
  });

  it('audit fail closed: adapter không có logWithClient → 500, không ghi non-tx', async () => {
    const noTxAudit = { log: jest.fn(async () => {}) } as unknown as AuditPort;
    const uc = new RemoveCrewMemberUseCase(crewRepo, noTxAudit, tx);
    const err = await uc
      .execute({ crewId: CREW_ID, memberId: MEMBER_ID, actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
    expect(noTxAudit.log).not.toHaveBeenCalled();
  });

  it('23514 trần (không constraint name) → 400 fieldErrors effectiveTo', async () => {
    (crewRepo.deactivateMemberWithClient as jest.Mock).mockRejectedValue(
      Object.assign(new Error('check failed'), { code: '23514' }),
    );
    const err = await useCase
      .execute({ crewId: CREW_ID, memberId: MEMBER_ID, actorUserId: ACTOR })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'khoảng thời gian hiệu lực không hợp lệ',
      fieldErrors: { effectiveTo: ['khoảng thời gian hiệu lực không hợp lệ'] },
    });
    expect(audit.logWithClient).not.toHaveBeenCalled();
  });
});
