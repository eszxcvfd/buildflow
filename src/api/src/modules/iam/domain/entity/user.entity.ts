export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';
export type UserType = 'STAFF' | 'WORKER';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  employeeCode?: string | null;
  userType: UserType;
  contractorId?: string | null;
  status: UserStatus;
  failedLoginCount: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UserEntity {
  constructor(private props: UserProps) {}

  get id(): string { return this.props.id; }
  get email(): string { return this.props.email; }
  get passwordHash(): string { return this.props.passwordHash; }
  get fullName(): string { return this.props.fullName; }
  get phone(): string | null | undefined { return this.props.phone; }
  get avatarUrl(): string | null | undefined { return this.props.avatarUrl; }
  get contractorId(): string | null | undefined { return this.props.contractorId; }
  get employeeCode(): string | null | undefined { return this.props.employeeCode; }
  get status(): UserStatus { return this.props.status; }
  get failedLoginCount(): number { return this.props.failedLoginCount; }
  get lockedUntil(): Date | null | undefined { return this.props.lockedUntil; }
  get lastLoginAt(): Date | null | undefined { return this.props.lastLoginAt; }
  get userType(): UserType { return this.props.userType; }

  isActive(): boolean {
    return this.props.status === 'ACTIVE';
  }

  isInactive(): boolean {
    return this.props.status === 'INACTIVE';
  }

  isLockedStatus(): boolean {
    return this.props.status === 'LOCKED';
  }

  isCurrentlyLocked(now: Date = new Date()): boolean {
    // Manual lock (LOCKED without expiry) = permanent
    if (this.props.status === 'LOCKED' && !this.props.lockedUntil) return true;
    // Auto-lock with expiry (or ACTIVE with lockedUntil) = only locked while lockedUntil is in future
    if (this.props.lockedUntil && this.props.lockedUntil.getTime() > now.getTime()) return true;
    return false;
  }

  /**
   * Auto-unlock if temporary lock has expired.
   * - Clears lockedUntil and resets failed counter so user gets fresh attempts.
   * - Flips status LOCKED -> ACTIVE only when lock was auto (had expiry); manual LOCKED (no expiry) is untouched.
   * Returns true if an expired lock was cleared.
   */
  clearExpiredLock(now: Date = new Date()): boolean {
    if (this.props.lockedUntil && this.props.lockedUntil.getTime() <= now.getTime()) {
      this.props.lockedUntil = null;
      this.props.failedLoginCount = 0;
      if (this.props.status === 'LOCKED') {
        this.props.status = 'ACTIVE';
      }
      this.props.updatedAt = now;
      return true;
    }
    return false;
  }

  recordFailedAttempt(now: Date, maxAttempts: number, lockDurationMinutes: number): { locked: boolean; lockedUntil: Date | null } {
    const newCount = this.props.failedLoginCount + 1;
    this.props.failedLoginCount = newCount;
    this.props.updatedAt = now;

    if (newCount >= maxAttempts) {
      const lockedUntil = new Date(now.getTime() + lockDurationMinutes * 60 * 1000);
      this.props.lockedUntil = lockedUntil;
      // Also flip status to LOCKED for visibility; domain keeps both lock fields
      this.props.status = 'LOCKED';
      return { locked: true, lockedUntil };
    }
    return { locked: false, lockedUntil: null };
  }

  resetFailedAttempts(now: Date): void {
    this.props.failedLoginCount = 0;
    this.props.lockedUntil = null;
    // If previously LOCKED due to attempts, restore to ACTIVE (unless explicitly INACTIVE)
    if (this.props.status === 'LOCKED') {
      this.props.status = 'ACTIVE';
    }
    this.props.lastLoginAt = now;
    this.props.updatedAt = now;
  }

  getProps(): UserProps {
    return { ...this.props };
  }
}
