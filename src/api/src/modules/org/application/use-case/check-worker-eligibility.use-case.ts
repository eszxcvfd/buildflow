import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { WORKER_REPOSITORY, WorkerRepositoryPort } from '../../domain/repository/worker-repository.port';
import { CREW_REPOSITORY, CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { TRADE_REPOSITORY, TradeRepositoryPort } from '../../domain/repository/trade-repository.port';
import {
  EligibilityCondition,
  aggregateEligible,
  evaluateWorkerEligibility,
} from '../../domain/service/eligibility.policy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ORG-SRS-008 (issue #31) — pre-check điều kiện nhận việc của worker.
 * Read-only: chỉ pool reads (findById, catalog trade, countOpenAssignments,
 * memberships), KHÔNG transaction, KHÔNG ghi audit_logs.
 */
export interface CheckWorkerEligibilityInput {
  workerId: string;
  tradeId?: string | null;
  skillLevel?: number | null;
  /**
   * Ngày tham chiếu `YYYY-MM-DD` (đã validate ở controller, default today):
   * lọc `crews[]` theo [effective_from, effective_to] INCLUSIVE hai đầu
   * (logic point-in-time #30). Không ảnh hưởng conditions ở slice này.
   */
  at?: string | null;
  /** Reuse khi là UUID hợp lệ, ngược lại generate mới. */
  correlationId?: string | null;
  /** Message 404 khi không có hồ sơ worker (mặc định chung; `/me` ghi đè). */
  notFoundMessage?: string | null;
}

export interface WorkerEligibilityCrewInfo {
  crewId: string;
  crewCode: string;
  crewName: string;
  memberRole: 'LEAD' | 'MEMBER';
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CheckWorkerEligibilityOutput {
  resourceType: 'WORKER';
  resourceId: string;
  eligible: boolean;
  checkedAt: string;
  correlationId: string;
  conditions: EligibilityCondition[];
  crews: WorkerEligibilityCrewInfo[];
}

function notFound(message: string): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    message,
    code: 'RESOURCE_NOT_FOUND',
  });
}

export function normalizeCorrelationId(raw?: string | null): string {
  const trimmed = (raw ?? '').trim();
  return trimmed !== '' && UUID_RE.test(trimmed) ? trimmed : randomUUID();
}

@Injectable()
export class CheckWorkerEligibilityUseCase {
  constructor(
    @Inject(WORKER_REPOSITORY) private readonly workerRepo: WorkerRepositoryPort,
    @Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort,
    @Inject(TRADE_REPOSITORY) private readonly tradeRepo: TradeRepositoryPort,
  ) {}

  async execute(input: CheckWorkerEligibilityInput): Promise<CheckWorkerEligibilityOutput> {
    const correlationId = normalizeCorrelationId(input.correlationId);
    const worker = await this.workerRepo.findById(input.workerId);
    if (!worker) {
      throw notFound(input.notFoundMessage ?? 'Không tìm thấy hồ sơ worker');
    }

    const tradeId = input.tradeId ?? null;
    const skillLevel = input.skillLevel ?? null;
    let requestedTradeExists: boolean | null = null;
    if (tradeId) {
      const trade = await this.tradeRepo.findById(tradeId);
      requestedTradeExists = trade !== null;
    }

    const openAssignments = await this.workerRepo.countOpenAssignments(input.workerId);
    const memberships = await this.crewRepo.findActiveMembershipsByUserId(input.workerId);

    const at = (input.at ?? '').trim();
    const crews: WorkerEligibilityCrewInfo[] = (at !== '' ? memberships.filter((m) => {
      // Point-in-time #30: [effective_from, effective_to] INCLUSIVE hai đầu,
      // effective_to NULL = open-ended.
      if (m.effectiveFrom > at) return false;
      if (m.effectiveTo !== null && m.effectiveTo < at) return false;
      return true;
    }) : memberships).map((m) => ({
      crewId: m.crewId,
      crewCode: m.crewCode,
      crewName: m.crewName,
      memberRole: m.memberRole,
      effectiveFrom: m.effectiveFrom,
      effectiveTo: m.effectiveTo,
    }));

    const props = worker.user.getProps();
    const conditions = evaluateWorkerEligibility({
      status: props.status,
      userType: props.userType,
      locked: worker.user.isCurrentlyLocked(),
      activeTrades: worker.trades
        .filter((t) => t.isActive)
        .map((t) => ({ tradeId: t.tradeId, skillLevel: t.skillLevel })),
      requestedTradeId: tradeId,
      requestedTradeExists: requestedTradeExists,
      requestedSkillLevel: skillLevel,
      openAssignments,
    });

    return {
      resourceType: 'WORKER',
      resourceId: worker.id,
      eligible: aggregateEligible(conditions),
      checkedAt: new Date().toISOString(),
      correlationId,
      conditions,
      crews,
    };
  }
}
