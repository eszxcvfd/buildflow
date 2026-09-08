import { CrewEntity } from '../../../../domain/entity/crew.entity';
import { toCrewResponse, toCrewListResponse } from './crew.mapper';

const ACTOR = '22222222-2222-4222-8222-222222222222';
const LEADER = '33333333-3333-4333-8333-333333333333';

function makeCrew(id: string): CrewEntity {
  return new CrewEntity({
    id,
    code: `CREW-${id.slice(0, 3)}`,
    name: `Đội ${id}`,
    status: 'ACTIVE',
    leaderUserId: LEADER,
    createdBy: ACTOR,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

describe('crew.mapper ORG-05 (crews list enrichment)', () => {
  it('toCrewResponse giữ nguyên — không có leaderName/memberCount (detail/create/update)', () => {
    const res = toCrewResponse(makeCrew('11111111-1111-4111-8111-111111111111'));
    expect(res).not.toHaveProperty('leaderName');
    expect(res).not.toHaveProperty('memberCount');
    expect(res.leaderUserId).toBe(LEADER);
  });

  it('toCrewListResponse merge leaderName/memberCount theo crew id', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const res = toCrewListResponse(
      [makeCrew(id)],
      new Map([[id, { leaderName: 'Nguyen Van A', memberCount: 4 }]]),
    );
    expect(res[0]).toEqual(expect.objectContaining({ leaderName: 'Nguyen Van A', memberCount: 4 }));
  });

  it('thiếu enrichment → leaderName null, memberCount 0 (kể cả không truyền map)', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(toCrewListResponse([makeCrew(id)], new Map())[0]).toEqual(
      expect.objectContaining({ leaderName: null, memberCount: 0 }),
    );
    expect(toCrewListResponse([makeCrew(id)])[0]).toEqual(
      expect.objectContaining({ leaderName: null, memberCount: 0 }),
    );
  });
});
