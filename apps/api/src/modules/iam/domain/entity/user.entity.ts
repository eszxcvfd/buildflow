export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface UserSnapshot {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  status: UserStatus;
  failedLoginCount: number;
  lockedUntil: Date | null;
}

export class UserEntity {
  constructor(private readonly props: UserSnapshot) {}

  get id(): string { return this.props.id; }
  get email(): string { return this.props.email; }
  get passwordHash(): string { return this.props.passwordHash; }
  get fullName(): string { return this.props.fullName; }
  get status(): UserStatus { return this.props.status; }
  get failedLoginCount(): number { return this.props.failedLoginCount; }
  get lockedUntil(): Date | null { return this.props.lockedUntil; }

  isInactive(): boolean { return this.props.status === 'INACTIVE'; }

  isCurrentlyLocked(now: Date): boolean {
    if (this.props.status === 'LOCKED' && !this.props.lockedUntil) return true;
    return Boolean(this.props.lockedUntil && this.props.lockedUntil.getTime() > now.getTime());
  }

  clearExpiredLock(now_?: Date): boolean {
    const ts = now_ ?? new Date();
    if (this.props.lockedUntil && this.props.lockedUntil.getTime() <= ts.getTime()) {
      this.props.lockedUntil = null;
      this.props.failedLoginCount = 0;
      if (this.props.status === 'LOCKED') this.props.status = 'ACTIVE';
      return true;
    }
    return false;
  }

  recordFailedAttempt(now: Date, maxAttempts: number, lockMinutes: number): { locked: boolean; lockedUntil: Date | null } {
    const count = this.props.failedLoginCount + 1;
    this.props.failedLoginCount = count;
    if (count >= maxAttempts) {
      const lockedUntil = new Date(now.getTime() + lockMinutes * 60_000);
      this.props.lockedUntil = lockedUntil;
      this.props.status = 'LOCKED';
      return { locked: true, lockedUntil };
    }
    return { locked: false, lockedUntil: null };
  }

  resetFailedAttempts(): void {
    this.props.failedLoginCount = 0;
    this.props.lockedUntil = null;
    if (this.props.status === 'LOCKED') this.props.status = 'ACTIVE';
  }

  getSnapshot(): UserSnapshot {
    return { ...this.props };
  }
}
