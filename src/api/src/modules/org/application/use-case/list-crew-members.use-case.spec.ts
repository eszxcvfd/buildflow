import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ListCrewMembersUseCase } from './list-crew-members.use-case';
import { CrewRepositoryPort, CrewMemberRow } from '../../domain/repository/crew-repository.port';
import { CrewEntity } from '../../domain/entity/crew.entity';

const CREW_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR = '22222222-2222-4222-8222-222222222222';

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

function makeMember(id: string): CrewMemberRow {
  return {
    id,
    crewId: CREW_ID,
    userId: '33333333-3333-4333-8333-333333333333',
    memberRole: 'MEMBER',
    effectiveFrom: '2026-09-01',
    effectiveTo: null,
    isActive: true,
    addedBy: ACTOR,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    userName: 'Nguyen Van A',
    userCode: 'EMP-1',
  };
}

describe('ListCrewMembersUseCase ORG-SRS-007 (issue #30)', () => {
  let crewRepo: jest.Mocked<CrewRepositoryPort>;
  let useCase: ListCrewMembersUseCase;

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
      listMembers: jest.fn(async () => [makeMember('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')]),
      listMembersWithClient: jest.fn(),
      findMemberByIdWithClient: jest.fn(),
      findActiveMemberWithClient: jest.fn(),
      findActiveMembershipsOfUserWithClient: jest.fn(async () => []),
      insertMemberWithClient: jest.fn(),
      deactivateMemberWithClient: jest.fn(),
      findCrewForUpdateWithClient: jest.fn(),
      findCrewByIdWithClient: jest.fn(),
    } as unknown as jest.Mocked<CrewRepositoryPort>;
    // Fix F7: thuần SELECT → pool read, không inject TransactionPort.
    useCase = new ListCrewMembersUseCase(crewRepo);
  });

  it('default: forward crewId, không at/includeInactive (pool read, không tx)', async () => {
    const out = await useCase.execute({ crewId: CREW_ID });
    expect(out.members).toHaveLength(1);
    expect(crewRepo.listMembers).toHaveBeenCalledWith(
      { crewId: CREW_ID, at: undefined, includeInactive: undefined },
    );
    expect(crewRepo.listMembersWithClient).not.toHaveBeenCalled();
  });

  it('forward at + includeInactive cho point-in-time và lịch sử', async () => {
    await useCase.execute({ crewId: CREW_ID, at: '2026-09-03', includeInactive: true });
    expect(crewRepo.listMembers).toHaveBeenCalledWith(
      { crewId: CREW_ID, at: '2026-09-03', includeInactive: true },
    );
  });

  it('F1: `at` pass-through nguyên vẹn xuống port (không chuẩn hóa/mặc định)', async () => {
    await useCase.execute({ crewId: CREW_ID, at: '2026-09-06' });
    const filter = (crewRepo.listMembers as jest.Mock).mock.calls[0][0] as { at?: string };
    expect(filter.at).toBe('2026-09-06');
    // at == effective_to vẫn bao phủ (inclusive) — SQL giữ `effective_to >= $2`.
  });

  it('at sai → 400 fieldErrors; đội không tồn tại → 404', async () => {
    const err = await useCase.execute({ crewId: CREW_ID, at: '03-09-2026' }).catch((e: unknown) => e);
    expect((err as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      message: 'Ngày tra cứu không hợp lệ (YYYY-MM-DD)',
      fieldErrors: { at: ['Ngày tra cứu không hợp lệ (YYYY-MM-DD)'] },
    });
    expect(crewRepo.listMembers).not.toHaveBeenCalled();
    crewRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ crewId: CREW_ID })).rejects.toThrow(NotFoundException);
  });
});
