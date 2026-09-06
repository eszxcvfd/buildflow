import {
  aggregateEligible,
  EligibilityCondition,
  evaluateCrewEligibility,
  evaluateWorkerEligibility,
  WorkerEligibilityInput,
  CrewEligibilityInput,
} from './eligibility.policy';

function workerBase(over: Partial<WorkerEligibilityInput> = {}): WorkerEligibilityInput {
  return {
    status: 'ACTIVE',
    userType: 'WORKER',
    locked: false,
    activeTrades: [{ tradeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', skillLevel: 3 }],
    requestedTradeId: null,
    requestedTradeExists: null,
    requestedSkillLevel: null,
    openAssignments: 0,
    ...over,
  };
}

function crewBase(over: Partial<CrewEligibilityInput> = {}): CrewEligibilityInput {
  return {
    status: 'ACTIVE',
    activeTrades: [{ tradeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', skillLevel: 2 }],
    openAssignments: 0,
    activeMemberCount: 2,
    hasActiveLead: true,
    ...over,
  };
}

function byCode(conds: EligibilityCondition[], code: string) {
  return conds.find((c) => c.code === code)!;
}

describe('eligibility.policy ORG-SRS-008 (issue #31)', () => {
  describe('worker — RESOURCE_ACTIVE', () => {
    it('ACTIVE + WORKER + không khóa → passed:true', () => {
      const c = byCode(evaluateWorkerEligibility(workerBase()), 'RESOURCE_ACTIVE');
      expect(c).toEqual(expect.objectContaining({ passed: true, reasonCode: 'OK' }));
    });

    it('INACTIVE → passed:false RESOURCE_INACTIVE', () => {
      const c = byCode(evaluateWorkerEligibility(workerBase({ status: 'INACTIVE' })), 'RESOURCE_ACTIVE');
      expect(c).toEqual(expect.objectContaining({ passed: false, reasonCode: 'RESOURCE_INACTIVE' }));
    });

    it('LOCKED status → RESOURCE_INACTIVE; locked flag → RESOURCE_LOCKED', () => {
      const byStatus = byCode(evaluateWorkerEligibility(workerBase({ status: 'LOCKED' })), 'RESOURCE_ACTIVE');
      expect(byStatus).toEqual(expect.objectContaining({ passed: false, reasonCode: 'RESOURCE_INACTIVE' }));
      const byFlag = byCode(evaluateWorkerEligibility(workerBase({ locked: true })), 'RESOURCE_ACTIVE');
      expect(byFlag).toEqual(expect.objectContaining({ passed: false, reasonCode: 'RESOURCE_LOCKED' }));
    });
  });

  describe('worker — TRADE_SKILL_MATCH', () => {
    it('không yêu cầu trade/skill → passed:null NOT_REQUESTED', () => {
      const c = byCode(evaluateWorkerEligibility(workerBase()), 'TRADE_SKILL_MATCH');
      expect(c).toEqual(expect.objectContaining({ passed: null, reasonCode: 'NOT_REQUESTED' }));
    });

    it('tradeId tồn tại + worker có row hiệu lực → true', () => {
      const c = byCode(
        evaluateWorkerEligibility(workerBase({
          requestedTradeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          requestedTradeExists: true,
        })),
        'TRADE_SKILL_MATCH',
      );
      expect(c).toEqual(expect.objectContaining({ passed: true, reasonCode: 'OK' }));
    });

    it('tradeId không có trong catalog → TRADE_NOT_FOUND', () => {
      const c = byCode(
        evaluateWorkerEligibility(workerBase({
          requestedTradeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          requestedTradeExists: false,
        })),
        'TRADE_SKILL_MATCH',
      );
      expect(c).toEqual(expect.objectContaining({ passed: false, reasonCode: 'TRADE_NOT_FOUND' }));
    });

    it('trade tồn tại nhưng worker không có row hiệu lực → TRADE_INACTIVE', () => {
      const c = byCode(
        evaluateWorkerEligibility(workerBase({
          activeTrades: [],
          requestedTradeId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          requestedTradeExists: true,
        })),
        'TRADE_SKILL_MATCH',
      );
      expect(c).toEqual(expect.objectContaining({ passed: false, reasonCode: 'TRADE_INACTIVE' }));
    });

    it('skill yêu cầu cao hơn cấp worker có → SKILL_LEVEL_TOO_LOW; đủ cấp → true', () => {
      const low = byCode(
        evaluateWorkerEligibility(workerBase({
          requestedTradeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          requestedTradeExists: true,
          requestedSkillLevel: 5,
        })),
        'TRADE_SKILL_MATCH',
      );
      expect(low).toEqual(expect.objectContaining({ passed: false, reasonCode: 'SKILL_LEVEL_TOO_LOW' }));
      const ok = byCode(
        evaluateWorkerEligibility(workerBase({
          requestedTradeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          requestedTradeExists: true,
          requestedSkillLevel: 2,
        })),
        'TRADE_SKILL_MATCH',
      );
      expect(ok).toEqual(expect.objectContaining({ passed: true, reasonCode: 'OK' }));
    });

    it('chỉ skillLevel: có trade đạt cấp → true; không → SKILL_LEVEL_TOO_LOW', () => {
      const ok = byCode(evaluateWorkerEligibility(workerBase({ requestedSkillLevel: 3 })), 'TRADE_SKILL_MATCH');
      expect(ok).toEqual(expect.objectContaining({ passed: true, reasonCode: 'OK' }));
      const low = byCode(
        evaluateWorkerEligibility(workerBase({ activeTrades: [], requestedSkillLevel: 2 })),
        'TRADE_SKILL_MATCH',
      );
      expect(low).toEqual(expect.objectContaining({ passed: false, reasonCode: 'SKILL_LEVEL_TOO_LOW' }));
    });
  });

  describe('worker — TRADE_CAPABILITY_DATA fail closed', () => {
    it('≥1 trade hiệu lực → true; 0 trade → false CAPABILITY_DATA_MISSING', () => {
      expect(byCode(evaluateWorkerEligibility(workerBase()), 'TRADE_CAPABILITY_DATA'))
        .toEqual(expect.objectContaining({ passed: true, reasonCode: 'OK' }));
      expect(byCode(evaluateWorkerEligibility(workerBase({ activeTrades: [] })), 'TRADE_CAPABILITY_DATA'))
        .toEqual(expect.objectContaining({ passed: false, reasonCode: 'CAPABILITY_DATA_MISSING' }));
    });
  });

  describe('worker — WORKLOAD / SCHEDULE_CONFLICT', () => {
    it('WORKLOAD luôn passed:true, detail nêu số lượng + chưa cấu hình ngưỡng', () => {
      const c = byCode(evaluateWorkerEligibility(workerBase({ openAssignments: 4 })), 'WORKLOAD');
      expect(c.passed).toBe(true);
      expect(c.detail).toContain('4');
      expect(c.detail).toContain('JOB-SRS');
    });

    it('SCHEDULE_CONFLICT luôn passed:null NOT_EVALUABLE', () => {
      const c = byCode(evaluateWorkerEligibility(workerBase()), 'SCHEDULE_CONFLICT');
      expect(c).toEqual(expect.objectContaining({ passed: null, reasonCode: 'NOT_EVALUABLE' }));
    });
  });

  describe('eligible aggregation', () => {
    it('worker chuẩn → eligible=true; 0 trade → false (fail closed, null không ảnh hưởng)', () => {
      expect(aggregateEligible(evaluateWorkerEligibility(workerBase()))).toBe(true);
      expect(aggregateEligible(evaluateWorkerEligibility(workerBase({ activeTrades: [] })))).toBe(false);
    });

    it('một condition false → false; chỉ null + true → true', () => {
      expect(aggregateEligible(evaluateWorkerEligibility(workerBase({ status: 'INACTIVE' })))).toBe(false);
      expect(aggregateEligible([
        { code: 'RESOURCE_ACTIVE', passed: true, reasonCode: 'OK', detail: 'x' },
        { code: 'TRADE_SKILL_MATCH', passed: null, reasonCode: 'NOT_REQUESTED', detail: 'x' },
        { code: 'SCHEDULE_CONFLICT', passed: null, reasonCode: 'NOT_EVALUABLE', detail: 'x' },
      ])).toBe(true);
    });

    it('đúng 5 conditions theo thứ tự contract', () => {
      const codes = evaluateWorkerEligibility(workerBase()).map((c) => c.code);
      expect(codes).toEqual([
        'RESOURCE_ACTIVE',
        'TRADE_SKILL_MATCH',
        'TRADE_CAPABILITY_DATA',
        'WORKLOAD',
        'SCHEDULE_CONFLICT',
      ]);
    });
  });

  describe('crew', () => {
    it('crew chuẩn → eligible=true, đủ 5 conditions theo thứ tự', () => {
      const conds = evaluateCrewEligibility(crewBase());
      expect(conds.map((c) => c.code)).toEqual([
        'RESOURCE_ACTIVE',
        'TRADE_CAPABILITY_DATA',
        'WORKLOAD',
        'MEMBER_COVERAGE',
        'SCHEDULE_CONFLICT',
      ]);
      expect(aggregateEligible(conds)).toBe(true);
    });

    it('INACTIVE → RESOURCE_INACTIVE, eligible=false', () => {
      const conds = evaluateCrewEligibility(crewBase({ status: 'INACTIVE' }));
      expect(byCode(conds, 'RESOURCE_ACTIVE'))
        .toEqual(expect.objectContaining({ passed: false, reasonCode: 'RESOURCE_INACTIVE' }));
      expect(aggregateEligible(conds)).toBe(false);
    });

    it('0 trade → CAPABILITY_DATA_MISSING, eligible=false', () => {
      const conds = evaluateCrewEligibility(crewBase({ activeTrades: [] }));
      expect(byCode(conds, 'TRADE_CAPABILITY_DATA'))
        .toEqual(expect.objectContaining({ passed: false, reasonCode: 'CAPABILITY_DATA_MISSING' }));
      expect(aggregateEligible(conds)).toBe(false);
    });

    it('0 member → NO_ACTIVE_MEMBERS, eligible=false; LEAD cũng tính là member', () => {
      const empty = evaluateCrewEligibility(crewBase({ activeMemberCount: 0, hasActiveLead: false }));
      expect(byCode(empty, 'MEMBER_COVERAGE'))
        .toEqual(expect.objectContaining({ passed: false, reasonCode: 'NO_ACTIVE_MEMBERS' }));
      expect(aggregateEligible(empty)).toBe(false);
      const leadOnly = evaluateCrewEligibility(crewBase({ activeMemberCount: 1, hasActiveLead: true }));
      expect(byCode(leadOnly, 'MEMBER_COVERAGE'))
        .toEqual(expect.objectContaining({ passed: true, reasonCode: 'OK' }));
      expect(aggregateEligible(leadOnly)).toBe(true);
    });

    it('crew SCHEDULE_CONFLICT NOT_EVALUABLE, WORKLOAD passed:true', () => {
      const conds = evaluateCrewEligibility(crewBase({ openAssignments: 2 }));
      expect(byCode(conds, 'SCHEDULE_CONFLICT'))
        .toEqual(expect.objectContaining({ passed: null, reasonCode: 'NOT_EVALUABLE' }));
      expect(byCode(conds, 'WORKLOAD').passed).toBe(true);
    });
  });
});
