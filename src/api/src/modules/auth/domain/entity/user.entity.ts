export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';
export type UserRole = 'WORKER' | 'ADMIN' | 'COORDINATOR';

export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly role: UserRole,
    public readonly status: UserStatus,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isActive(): boolean {
    return this.status === 'ACTIVE';
  }
}
