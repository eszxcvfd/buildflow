import { UserEntity } from '../../../iam/domain/entity/user.entity';

export type SkillLevel = 1 | 2 | 3 | 4 | 5;

export interface WorkerTrade {
  tradeId: string;
  skillLevel: SkillLevel;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;
}

export interface WorkerProps {
  user: UserEntity;
  trades: WorkerTrade[];
}

export class WorkerEntity {
  constructor(private props: WorkerProps) {}

  get id(): string { return this.props.user.id; }
  get user(): UserEntity { return this.props.user; }
  get trades(): WorkerTrade[] { return [...this.props.trades]; }
  get status(): string { return this.props.user.status; }
  get employeeCode(): string | null | undefined { return this.props.user.employeeCode; }
  get fullName(): string { return this.props.user.fullName; }

  isActive(): boolean { return this.props.user.isActive(); }
  isInactive(): boolean { return this.props.user.isInactive(); }

  /**
   * Legacy lifecycle state (ORG-SRS-001): ACTIVE + not currently locked.
   * This boolean is NOT the §9 (ORG-SRS-008) eligibility pre-check — the
   * fail-closed verdict (`eligible` + `conditions[]`) is computed by the
   * eligibility use case (see ENDPOINTS.md §9). Do not use this as an
   * assignment gate beyond the lifecycle rule.
   */
  isEligibleForAssignment(): boolean {
    // Business rule ORG-SRS-001: worker ngừng hoạt động không được phân công hoặc tự nhận việc mới
    return this.isActive() && !this.props.user.isCurrentlyLocked();
  }

  getProps(): WorkerProps {
    return { user: this.props.user, trades: [...this.props.trades] };
  }

  toPublicProfile(): ReturnType<UserEntity['toPublicProfile']> & { trades: WorkerTrade[]; eligible: boolean } {
    return {
      ...this.props.user.toPublicProfile(),
      trades: this.trades,
      // `eligible` here is the legacy lifecycle flag (see isEligibleForAssignment),
      // NOT the §9 (ORG-SRS-008) eligibility pre-check verdict.
      eligible: this.isEligibleForAssignment(),
    };
  }
}
