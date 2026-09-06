import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CREW_REPOSITORY, CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import {
  EligibilityCondition,
  aggregateEligible,
  evaluateCrewEligibility,
} from '../../domain/service/eligibility.policy';
import { normalizeCorrelationId } from './check-worker-eligibility.use-case';

/**
 * ORG-SRS-008 (issue #31) — pre-check điều kiện nhận việc của crew.
 * Read-only: chỉ pool reads (findById, crew trades, countOpenAssignments,
 * listMembers active), KHÔNG transaction, KHÔNG ghi audit_logs.
 */
export interface CheckCrewEligibilityInput {
  crewId: string;
  /** Reuse khi là UUID hợp lệ, ngược lại generate mới. */
  correlationId?: string | null;
}

export interface CrewEligibilityMemberInfo {
  memberId: string;
  userId: string;
  memberRole: 'LEAD' | 'MEMBER';
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CheckCrewEligibilityOutput {
  resourceType: 'CREW';
  resourceId: string;
  eligible: boolean;
  checkedAt: string;
  correlationId: string;
  conditions: EligibilityCondition[];
  members: CrewEligibilityMemberInfo[];
}

@Injectable()
export class CheckCrewEligibilityUseCase {
  constructor(
    @Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort,
  ) {}

  async execute(input: CheckCrewEligibilityInput): Promise<CheckCrewEligibilityOutput> {
    const correlationId = normalizeCorrelationId(input.correlationId);
    const crew = await this.crewRepo.findById(input.crewId);
    if (!crew) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Không tìm thấy đội thi công',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const trades = await this.crewRepo.findActiveTradesByCrewId(input.crewId);
    const openAssignments = await this.crewRepo.countOpenAssignments(input.crewId);
    // MEMBER_COVERAGE: ≥1 active member (LEAD/MEMBER đều tính) — logic
    // listMembers #30 default chỉ is_active, pool read.
    const members = await this.crewRepo.listMembers({ crewId: input.crewId });

    const conditions = evaluateCrewEligibility({
      status: crew.status,
      activeTrades: trades,
      openAssignments,
      activeMemberCount: members.length,
      hasActiveLead: members.some((m) => m.memberRole === 'LEAD'),
    });

    return {
      resourceType: 'CREW',
      resourceId: crew.id,
      eligible: aggregateEligible(conditions),
      checkedAt: new Date().toISOString(),
      correlationId,
      conditions,
      members: members.map((m) => ({
        memberId: m.id,
        userId: m.userId,
        memberRole: m.memberRole,
        effectiveFrom: m.effectiveFrom,
        effectiveTo: m.effectiveTo,
      })),
    };
  }
}
