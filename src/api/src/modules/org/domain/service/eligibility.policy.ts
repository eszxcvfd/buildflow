/**
 * ORG-SRS-008 (issue #31) — điều kiện nhận việc (eligibility) cho worker và crew.
 *
 * Domain thuần (không Nest/DB): đánh giá các condition cố định từ dữ liệu đã
 * load (pool reads ở use case), tổng hợp `eligible` và KHÔNG tự truy I/O.
 *
 * Ngữ nghĩa pass:
 * - `passed: true`  — đạt.
 * - `passed: false` — không đạt, KÉO `eligible` về false.
 * - `passed: null`  — không áp dụng / không đánh giá được ở slice này
 *   (NOT_REQUESTED, NOT_EVALUABLE), KHÔNG ảnh hưởng `eligible`.
 * - Worker/crew có 0 trade hiệu lực → fail closed (`eligible = false` qua
 *   TRADE_CAPABILITY_DATA).
 */

export type EligibilityConditionCode =
  | 'RESOURCE_ACTIVE'
  | 'TRADE_SKILL_MATCH'
  | 'TRADE_CAPABILITY_DATA'
  | 'WORKLOAD'
  | 'SCHEDULE_CONFLICT'
  | 'MEMBER_COVERAGE';

export interface EligibilityCondition {
  code: EligibilityConditionCode;
  passed: boolean | null;
  reasonCode: string;
  detail: string;
}

export interface ActiveTradeRef {
  tradeId: string;
  skillLevel: number;
}

function sameUuid(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** `eligible` = AND trên mọi condition có `passed === false` (null được bỏ qua). */
export function aggregateEligible(conditions: EligibilityCondition[]): boolean {
  return conditions.every((c) => c.passed !== false);
}

export interface WorkerEligibilityInput {
  status: string;
  userType: string;
  locked: boolean;
  activeTrades: ActiveTradeRef[];
  requestedTradeId?: string | null;
  /**
   * Trade được yêu cầu có tồn tại trong catalog không (use case tra cứu khi
   * có requestedTradeId). false → TRADE_NOT_FOUND; true nhưng worker không có
   * row hiệu lực → TRADE_INACTIVE. Mặc định true khi không tra cứu.
   */
  requestedTradeExists?: boolean | null;
  requestedSkillLevel?: number | null;
  openAssignments: number;
}

/**
 * Đánh giá 5 condition cố định cho worker, đúng thứ tự contract:
 * RESOURCE_ACTIVE, TRADE_SKILL_MATCH, TRADE_CAPABILITY_DATA, WORKLOAD,
 * SCHEDULE_CONFLICT.
 */
export function evaluateWorkerEligibility(input: WorkerEligibilityInput): EligibilityCondition[] {
  const conditions: EligibilityCondition[] = [];
  const trades = input.activeTrades ?? [];

  // 1. RESOURCE_ACTIVE — users.status ACTIVE + user_type WORKER + không bị khóa.
  if (input.locked) {
    conditions.push({
      code: 'RESOURCE_ACTIVE',
      passed: false,
      reasonCode: 'RESOURCE_LOCKED',
      detail: 'Tài khoản worker đang bị khóa (LOCKED) — không đủ điều kiện nhận việc',
    });
  } else if (input.status !== 'ACTIVE' || input.userType !== 'WORKER') {
    conditions.push({
      code: 'RESOURCE_ACTIVE',
      passed: false,
      reasonCode: 'RESOURCE_INACTIVE',
      detail: `Hồ sơ worker không ở trạng thái hiệu lực (status=${input.status}, user_type=${input.userType})`,
    });
  } else {
    conditions.push({
      code: 'RESOURCE_ACTIVE',
      passed: true,
      reasonCode: 'OK',
      detail: 'Hồ sơ worker đang hiệu lực (ACTIVE, WORKER, không bị khóa)',
    });
  }

  // 2. TRADE_SKILL_MATCH — chỉ khi tradeId và/hoặc skillLevel được yêu cầu.
  const tradeId = input.requestedTradeId ?? null;
  const skillLevel = input.requestedSkillLevel ?? null;
  if (!tradeId && (skillLevel === null || skillLevel === undefined)) {
    conditions.push({
      code: 'TRADE_SKILL_MATCH',
      passed: null,
      reasonCode: 'NOT_REQUESTED',
      detail: 'Không yêu cầu kiểm tra ngành nghề/kỹ năng — bỏ qua điều kiện này',
    });
  } else if (tradeId) {
    if (input.requestedTradeExists === false) {
      conditions.push({
        code: 'TRADE_SKILL_MATCH',
        passed: false,
        reasonCode: 'TRADE_NOT_FOUND',
        detail: `Ngành nghề yêu cầu không tồn tại trong danh mục (tradeId=${tradeId})`,
      });
    } else {
      const matching = trades.filter((t) => sameUuid(t.tradeId, tradeId));
      if (matching.length === 0) {
        conditions.push({
          code: 'TRADE_SKILL_MATCH',
          passed: false,
          reasonCode: 'TRADE_INACTIVE',
          detail: 'Ngành nghề tồn tại nhưng worker không có bản ghi hiệu lực (is_active) cho ngành nghề này',
        });
      } else if (skillLevel !== null && skillLevel !== undefined) {
        const best = Math.max(...matching.map((t) => t.skillLevel));
        if (best < skillLevel) {
          conditions.push({
            code: 'TRADE_SKILL_MATCH',
            passed: false,
            reasonCode: 'SKILL_LEVEL_TOO_LOW',
            detail: `Cấp kỹ năng cao nhất của worker cho ngành nghề này là ${best}, thấp hơn yêu cầu ${skillLevel}`,
          });
        } else {
          conditions.push({
            code: 'TRADE_SKILL_MATCH',
            passed: true,
            reasonCode: 'OK',
            detail: `Worker có ngành nghề yêu cầu ở cấp ${best} (yêu cầu ${skillLevel})`,
          });
        }
      } else {
        conditions.push({
          code: 'TRADE_SKILL_MATCH',
          passed: true,
          reasonCode: 'OK',
          detail: 'Worker có bản ghi hiệu lực cho ngành nghề yêu cầu',
        });
      }
    }
  } else {
    // Chỉ skillLevel: cần ít nhất một trade hiệu lực đạt cấp yêu cầu.
    const best = trades.length > 0 ? Math.max(...trades.map((t) => t.skillLevel)) : 0;
    if (best >= (skillLevel as number)) {
      conditions.push({
        code: 'TRADE_SKILL_MATCH',
        passed: true,
        reasonCode: 'OK',
        detail: `Worker có ít nhất một ngành nghề hiệu lực đạt cấp ${best} (yêu cầu ${skillLevel})`,
      });
    } else {
      conditions.push({
        code: 'TRADE_SKILL_MATCH',
        passed: false,
        reasonCode: 'SKILL_LEVEL_TOO_LOW',
        detail: `Worker không có ngành nghề hiệu lực nào đạt cấp yêu cầu ${skillLevel}`,
      });
    }
  }

  // 3. TRADE_CAPABILITY_DATA — fail closed khi 0 trade hiệu lực.
  if (trades.length > 0) {
    conditions.push({
      code: 'TRADE_CAPABILITY_DATA',
      passed: true,
      reasonCode: 'OK',
      detail: `Worker có ${trades.length} ngành nghề hiệu lực`,
    });
  } else {
    conditions.push({
      code: 'TRADE_CAPABILITY_DATA',
      passed: false,
      reasonCode: 'CAPABILITY_DATA_MISSING',
      detail: 'Worker chưa có dữ liệu năng lực (không có resource_trades hiệu lực) — fail closed',
    });
  }

  // 4. WORKLOAD — slice này chỉ báo số lượng, KHÔNG áp ngưỡng (JOB-SRS).
  conditions.push({
    code: 'WORKLOAD',
    passed: true,
    reasonCode: 'OK',
    detail: `Đang có ${input.openAssignments} công việc mở — giới hạn việc chưa cấu hình — JOB-SRS sẽ áp dụng ngưỡng`,
  });

  // 5. SCHEDULE_CONFLICT — chưa có dữ liệu work-order ở slice này.
  conditions.push({
    code: 'SCHEDULE_CONFLICT',
    passed: null,
    reasonCode: 'NOT_EVALUABLE',
    detail: 'Chưa có dữ liệu work-order ở slice này — JOB-SRS sẽ đánh giá ở slice phân công',
  });

  return conditions;
}

export interface CrewEligibilityInput {
  status: string;
  activeTrades: ActiveTradeRef[];
  openAssignments: number;
  activeMemberCount: number;
  hasActiveLead: boolean;
}

/**
 * Đánh giá 5 condition cố định cho crew, đúng thứ tự contract:
 * RESOURCE_ACTIVE, TRADE_CAPABILITY_DATA, WORKLOAD, MEMBER_COVERAGE,
 * SCHEDULE_CONFLICT.
 */
export function evaluateCrewEligibility(input: CrewEligibilityInput): EligibilityCondition[] {
  const conditions: EligibilityCondition[] = [];
  const trades = input.activeTrades ?? [];

  // 1. RESOURCE_ACTIVE — crews.status ACTIVE.
  if (input.status === 'ACTIVE') {
    conditions.push({
      code: 'RESOURCE_ACTIVE',
      passed: true,
      reasonCode: 'OK',
      detail: 'Đội đang hiệu lực (ACTIVE)',
    });
  } else {
    conditions.push({
      code: 'RESOURCE_ACTIVE',
      passed: false,
      reasonCode: 'RESOURCE_INACTIVE',
      detail: `Đội không ở trạng thái hiệu lực (status=${input.status})`,
    });
  }

  // 2. TRADE_CAPABILITY_DATA — fail closed khi 0 trade hiệu lực (resource_type CREW).
  if (trades.length > 0) {
    conditions.push({
      code: 'TRADE_CAPABILITY_DATA',
      passed: true,
      reasonCode: 'OK',
      detail: `Đội có ${trades.length} ngành nghề hiệu lực`,
    });
  } else {
    conditions.push({
      code: 'TRADE_CAPABILITY_DATA',
      passed: false,
      reasonCode: 'CAPABILITY_DATA_MISSING',
      detail: 'Đội chưa có dữ liệu năng lực (không có resource_trades hiệu lực) — fail closed',
    });
  }

  // 3. WORKLOAD — slice này chỉ báo số lượng, KHÔNG áp ngưỡng (JOB-SRS).
  conditions.push({
    code: 'WORKLOAD',
    passed: true,
    reasonCode: 'OK',
    detail: `Đang có ${input.openAssignments} công việc mở — giới hạn việc chưa cấu hình — JOB-SRS sẽ áp dụng ngưỡng`,
  });

  // 4. MEMBER_COVERAGE — ≥1 thành viên hiệu lực (LEAD/MEMBER đều tính, theo
  // logic listMembers #30: default chỉ is_active).
  if (input.activeMemberCount > 0) {
    conditions.push({
      code: 'MEMBER_COVERAGE',
      passed: true,
      reasonCode: 'OK',
      detail: `Đội có ${input.activeMemberCount} thành viên hiệu lực (trưởng nhóm: ${input.hasActiveLead ? 'có' : 'không'})`,
    });
  } else {
    conditions.push({
      code: 'MEMBER_COVERAGE',
      passed: false,
      reasonCode: 'NO_ACTIVE_MEMBERS',
      detail: 'Đội không có thành viên hiệu lực',
    });
  }

  // 5. SCHEDULE_CONFLICT — chưa có dữ liệu work-order ở slice này.
  conditions.push({
    code: 'SCHEDULE_CONFLICT',
    passed: null,
    reasonCode: 'NOT_EVALUABLE',
    detail: 'Chưa có dữ liệu work-order ở slice này — JOB-SRS sẽ đánh giá ở slice phân công',
  });

  return conditions;
}
