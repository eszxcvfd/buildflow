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

  updateProfile(input: { fullName?: string; phone?: string | null; avatarUrl?: string | null }, now?: Date): void {
    const updatedAt = now ?? new Date();
    if (input.fullName !== undefined) {
      const trimmed = input.fullName.trim();
      if (trimmed.length === 0) {
        throw new Error('Họ tên không được để trống');
      }
      if (trimmed.length > 150) {
        throw new Error('Họ tên tối đa 150 ký tự');
      }
      this.props.fullName = trimmed;
    }
    if (input.phone !== undefined) {
      if (input.phone === null || input.phone === '') {
        this.props.phone = null;
      } else {
        const normalized = input.phone.trim();
        // Allow +84 or 0 prefix, 7-15 digits, may contain spaces/dashes stripped
        const digitsOnly = normalized.replace(/[\s-]/g, '');
        if (!/^\+?[0-9]{7,15}$/.test(digitsOnly)) {
          throw new Error('Số điện thoại không hợp lệ');
        }
        if (normalized.length > 20) {
          throw new Error('Số điện thoại tối đa 20 ký tự');
        }
        this.props.phone = normalized;
      }
    }
    if (input.avatarUrl !== undefined) {
      if (input.avatarUrl === null || input.avatarUrl === '') {
        this.props.avatarUrl = null;
      } else {
        const url = input.avatarUrl.trim();
        if (url.length > 500) {
          throw new Error('Avatar URL tối đa 500 ký tự');
        }
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Avatar URL phải là http/https');
          }
        } catch {
          throw new Error('Avatar URL không hợp lệ');
        }
        this.props.avatarUrl = url;
      }
    }
    this.props.updatedAt = updatedAt;
  }

  updateAdmin(input: {
    email?: string;
    fullName?: string;
    phone?: string | null;
    avatarUrl?: string | null;
    employeeCode?: string | null;
    userType?: UserType;
    contractorId?: string | null;
  }, now?: Date): void {
    const updatedAt = now ?? new Date();
    if (input.email !== undefined) {
      const trimmed = input.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        throw new Error('Email không hợp lệ');
      }
      if (trimmed.length > 255) {
        throw new Error('Email tối đa 255 ký tự');
      }
      this.props.email = trimmed;
    }
    if (input.fullName !== undefined) {
      const trimmed = input.fullName.trim();
      if (trimmed.length === 0) {
        throw new Error('Họ tên không được để trống');
      }
      if (trimmed.length > 150) {
        throw new Error('Họ tên tối đa 150 ký tự');
      }
      this.props.fullName = trimmed;
    }
    if (input.phone !== undefined) {
      if (input.phone === null || input.phone === '') {
        this.props.phone = null;
      } else {
        const normalized = input.phone.trim();
        const digitsOnly = normalized.replace(/[\s-]/g, '');
        if (!/^\+?[0-9]{7,15}$/.test(digitsOnly)) {
          throw new Error('Số điện thoại không hợp lệ');
        }
        if (normalized.length > 20) {
          throw new Error('Số điện thoại tối đa 20 ký tự');
        }
        this.props.phone = normalized;
      }
    }
    if (input.avatarUrl !== undefined) {
      if (input.avatarUrl === null || input.avatarUrl === '') {
        this.props.avatarUrl = null;
      } else {
        const url = input.avatarUrl.trim();
        if (url.length > 500) {
          throw new Error('Avatar URL tối đa 500 ký tự');
        }
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Avatar URL phải là http/https');
          }
        } catch {
          throw new Error('Avatar URL không hợp lệ');
        }
        this.props.avatarUrl = url;
      }
    }
    if (input.employeeCode !== undefined) {
      if (input.employeeCode === null || input.employeeCode === '') {
        this.props.employeeCode = null;
      } else {
        const trimmed = input.employeeCode.trim();
        if (trimmed.length > 50) {
          throw new Error('Mã nhân viên tối đa 50 ký tự');
        }
        this.props.employeeCode = trimmed;
      }
    }
    if (input.userType !== undefined) {
      if (!['STAFF', 'WORKER'].includes(input.userType)) {
        throw new Error('Loại tài khoản không hợp lệ');
      }
      this.props.userType = input.userType;
    }
    if (input.contractorId !== undefined) {
      if (input.contractorId === null || input.contractorId === '') {
        this.props.contractorId = null;
      } else {
        const trimmed = String(input.contractorId).trim();
        // basic uuid check
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
          throw new Error('Contractor ID không hợp lệ');
        }
        this.props.contractorId = trimmed;
      }
    }
    this.props.updatedAt = updatedAt;
  }

  changeStatus(newStatus: UserStatus, now?: Date): void {
    const updatedAt = now ?? new Date();
    if (!['ACTIVE', 'LOCKED', 'INACTIVE'].includes(newStatus)) {
      throw new Error('Trạng thái không hợp lệ');
    }
    if (this.props.status === newStatus) {
      throw new Error(`Tài khoản đã ở trạng thái ${newStatus}`);
    }
    // Transition handling
    if (newStatus === 'ACTIVE') {
      // unlock or reactivate: clear lock fields
      this.props.status = 'ACTIVE';
      this.props.lockedUntil = null;
      this.props.failedLoginCount = 0;
    } else if (newStatus === 'LOCKED') {
      // manual lock: no expiry, keep failed count but set LOCKED
      this.props.status = 'LOCKED';
      this.props.lockedUntil = null;
    } else if (newStatus === 'INACTIVE') {
      // deactivate: clear lock expiry, keep status INACTIVE
      this.props.status = 'INACTIVE';
      this.props.lockedUntil = null;
    }
    this.props.updatedAt = updatedAt;
  }

  toPublicProfile(): {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    avatarUrl: string | null;
    employeeCode: string | null;
    userType: UserType;
    contractorId: string | null;
    status: UserStatus;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.props.id,
      email: this.props.email,
      fullName: this.props.fullName,
      phone: (this.props.phone as string | null) ?? null,
      avatarUrl: (this.props.avatarUrl as string | null) ?? null,
      employeeCode: (this.props.employeeCode as string | null) ?? null,
      userType: this.props.userType,
      contractorId: (this.props.contractorId as string | null) ?? null,
      status: this.props.status,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }

  getProps(): UserProps {
    return { ...this.props };
  }
}
