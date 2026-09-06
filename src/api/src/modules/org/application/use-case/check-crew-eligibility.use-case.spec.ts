import { NotFoundException } from '@nestjs/common';
import { CheckCrewEligibilityUseCase } from './check-crew-eligibility.use-case';
import { CrewRepositoryPort, CrewMemberRow } from '../../domain/repository/crew-repository.port';
import { CrewEntity } from '../../domain/entity/crew.entity';

const CID = '11111111-1111-4111-8111-111111111111';
const ACTOR = '22222222-2222-4222-8222-222222222222';
const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';

function makeCrew(status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE'): CrewEntity {
  return new CrewEntity({
    id: CID,
    code: 'CREW-A',
    name: 'Đội A',
    status,
    leaderUserId: '33333333-3333-4333-8333-333333333333',
    createdBy: ACTOR,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

function makeMember(id: string, role: 'LEAD' | 'MEMBER' = 'MEMBER'): CrewMemberRow {
  return {
    id,
    crewId: CID,
    userId: '33333333-3333-4333-8333-333333333333',
    memberRole: role,
    effectiveFrom: '2026-09-01',
    effectiveTo: null,
    isActive: true,
    addedBy: ACTOR,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    userName: 'Nguyen Van A',
    userCode: 'EMP-1',
  };
}

describe('CheckCrewEligibilityUseCase ORG-SRS-008 (issue #31)', () => {
  let repo: jest.Mocked<CrewRepositoryPort>;
  let useCase: CheckCrewEligibilityUseCase;

  beforeEach(() => {
    repo = {
      findById: jest.fn(async () => makeCrew()),
      findActiveTradesByCrewId: jest.fn(async () => [
        { tradeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', skillLevel: 2 },
      ]),
      countOpenAssignments: jest.fn(async () => 0),
      listMembers: jest.fn(async () => [
        makeMember('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'LEAD'),
        makeMember('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'MEMBER'),
      ]),
    } as unknown as jest.Mocked<CrewRepositoryPort>;
    useCase = new CheckCrewEligibilityUseCase(repo);
  });

  it('crew chuẩn → eligible=true, đủ 5 conditions + members', async () => {
    const out = await useCase.execute({ crewId: CID, correlationId: VALID_CORR });
    expect(out.resourceType).toBe('CREW');
    expect(out.resourceId).toBe(CID);
    expect(out.eligible).toBe(true);
    expect(out.conditions).toHaveLength(5);
    expect(out.correlationId).toBe(VALID_CORR);
    expect(out.members).toHaveLength(2);
    expect(out.members[0]).toEqual(expect.objectContaining({ memberRole: 'LEAD' }));
  });

  it('crew không tồn tại → 404 RESOURCE_NOT_FOUND', async () => {
    repo.findById.mockResolvedValue(null);
    const err = await useCase.execute({ crewId: CID }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundException);
    expect((err as NotFoundException).getResponse()).toEqual(expect.objectContaining({
      statusCode: 404,
      code: 'RESOURCE_NOT_FOUND',
    }));
    expect(repo.countOpenAssignments).not.toHaveBeenCalled();
  });

  it('0 member hiệu lực → MEMBER_COVERAGE false (NO_ACTIVE_MEMBERS), eligible=false', async () => {
    repo.listMembers.mockResolvedValue([]);
    const out = await useCase.execute({ crewId: CID });
    expect(out.eligible).toBe(false);
    expect(out.conditions.find((c) => c.code === 'MEMBER_COVERAGE')).toEqual(
      expect.objectContaining({ passed: false, reasonCode: 'NO_ACTIVE_MEMBERS' }),
    );
    expect(out.members).toEqual([]);
  });

  it('crew INACTIVE / 0 trade → eligible=false', async () => {
    repo.findById.mockResolvedValue(makeCrew('INACTIVE'));
    const inactive = await useCase.execute({ crewId: CID });
    expect(inactive.eligible).toBe(false);
    repo.findById.mockResolvedValue(makeCrew());
    repo.findActiveTradesByCrewId.mockResolvedValue([]);
    const noTrade = await useCase.execute({ crewId: CID });
    expect(noTrade.eligible).toBe(false);
    expect(noTrade.conditions.find((c) => c.code === 'TRADE_CAPABILITY_DATA')).toEqual(
      expect.objectContaining({ passed: false, reasonCode: 'CAPABILITY_DATA_MISSING' }),
    );
  });

  it('correlationId sai → generate mới; listMembers chỉ lấy active (không at/includeInactive)', async () => {
    const out = await useCase.execute({ crewId: CID, correlationId: 'bad' });
    expect(out.correlationId).not.toBe('bad');
    expect(out.correlationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(repo.listMembers).toHaveBeenCalledWith({ crewId: CID });
  });
});
