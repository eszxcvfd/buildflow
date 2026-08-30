import { UserEntity } from '../../../iam/domain/entity/user.entity';
import { WorkerEntity } from '../entity/worker.entity';
import { isWorkerEligible, validateTradeAssignment } from './worker-eligibility.policy';

function makeWorker(status: 'ACTIVE' | 'INACTIVE' | 'LOCKED', lockedUntil: Date | null = null): WorkerEntity {
  const user = new UserEntity({
    id: 'worker-1',
    email: 'worker@example.com',
    passwordHash: '$2b$hash',
    fullName: 'Worker One',
    phone: null,
    avatarUrl: null,
    employeeCode: 'EMP001',
    userType: 'WORKER',
    contractorId: null,
    status,
    failedLoginCount: 0,
    lockedUntil,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return new WorkerEntity({ user, trades: [{ tradeId: '11111111-1111-4111-8111-111111111111', skillLevel: 3, effectiveFrom: new Date(), isActive: true }] });
}

describe('WorkerEligibility ORG-SRS-001', () => {
  it('ACTIVE worker eligible', () => {
    expect(isWorkerEligible(makeWorker('ACTIVE'))).toBe(true);
  });

  it('INACTIVE worker không được phân công', () => {
    expect(isWorkerEligible(makeWorker('INACTIVE'))).toBe(false);
  });

  it('LOCKED worker không eligible', () => {
    expect(isWorkerEligible(makeWorker('LOCKED'))).toBe(false);
    expect(isWorkerEligible(makeWorker('ACTIVE', new Date(Date.now() + 10000)))).toBe(false);
  });

  it('history sau status change vẫn giữ (entity still exists, isActive false)', () => {
    const w = makeWorker('ACTIVE');
    expect(w.isActive()).toBe(true);
    w.user.changeStatus('INACTIVE');
    expect(w.isActive()).toBe(false);
    expect(w.isInactive()).toBe(true);
    // History still viewable via entity (not hard deleted)
    expect(w.id).toBe('worker-1');
  });

  it('validateTradeAssignment - trùng trade bị reject', () => {
    expect(() => validateTradeAssignment(['11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'])).toThrow(/Trade ID trùng lặp/);
  });

  it('validateTradeAssignment - skill level 1-5', () => {
    expect(() => validateTradeAssignment(['11111111-1111-4111-8111-111111111111'], [6])).toThrow('Skill level');
    expect(() => validateTradeAssignment(['11111111-1111-4111-8111-111111111111'], [0])).toThrow('Skill level');
    expect(() => validateTradeAssignment(['11111111-1111-4111-8111-111111111111'], [3])).not.toThrow();
  });

  it('validateTradeAssignment - invalid UUID', () => {
    expect(() => validateTradeAssignment(['not-uuid'])).toThrow('Trade ID không hợp lệ');
  });
});
