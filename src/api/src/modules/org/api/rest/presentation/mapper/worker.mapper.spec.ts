import { WorkerEntity } from '../../../../domain/entity/worker.entity';
import { UserEntity } from '../../../../../iam/domain/entity/user.entity';
import {
  toWorkerResponse,
  toWorkerDetailResponse,
  toWorkerListResponse,
  toWorkerCrewMembershipListResponse,
} from './worker.mapper';

function makeWorker(id: string): WorkerEntity {
  const user = new UserEntity({
    id,
    email: `${id}@example.com`,
    passwordHash: '$hash',
    fullName: `Worker ${id}`,
    phone: null,
    avatarUrl: null,
    employeeCode: `EMP-${id}`,
    userType: 'WORKER',
    contractorId: null,
    status: 'ACTIVE',
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
  return new WorkerEntity({ user, trades: [] });
}

describe('worker.mapper ORG-05 (Worker ↔ Crew link)', () => {
  it('toWorkerResponse giữ nguyên — không có key crews (create/update/status)', () => {
    const res = toWorkerResponse(makeWorker('w1'));
    expect(res).not.toHaveProperty('crews');
  });

  it('toWorkerDetailResponse kèm crews[] vào profile', () => {
    const crews = [{ crewId: 'c1', crewCode: 'CREW-A', crewName: 'Đội A', memberRole: 'LEAD' as const }];
    const res = toWorkerDetailResponse(makeWorker('w1'), crews);
    expect(res.crews).toEqual(crews);
    expect(res.email).toBe('w1@example.com');
  });

  it('toWorkerListResponse merge theo userId; thiếu map → []', () => {
    const map = new Map([['w1', [{ crewId: 'c1', crewCode: 'CREW-A', crewName: 'Đội A', memberRole: 'MEMBER' as const }]]]);
    const res = toWorkerListResponse([makeWorker('w1'), makeWorker('w2')], map);
    expect(res[0].crews).toHaveLength(1);
    expect(res[1].crews).toEqual([]);
    expect(toWorkerListResponse([makeWorker('w1')])[0].crews).toEqual([]);
  });

  it('toWorkerCrewMembershipListResponse giữ nguyên shape endpoint (kèm crewStatus/dates)', () => {
    const res = toWorkerCrewMembershipListResponse([{
      crewId: 'c1', crewCode: 'CREW-A', crewName: 'Đội A', crewStatus: 'ACTIVE',
      memberRole: 'MEMBER', effectiveFrom: '2026-09-01', effectiveTo: null,
    }]);
    expect(res).toEqual([{
      crewId: 'c1', crewCode: 'CREW-A', crewName: 'Đội A', crewStatus: 'ACTIVE',
      memberRole: 'MEMBER', effectiveFrom: '2026-09-01', effectiveTo: null,
    }]);
  });
});
