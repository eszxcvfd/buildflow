import { PoolClient } from 'pg';
import { UserEntity } from '../entity/user.entity';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmployeeCode?(employeeCode: string): Promise<UserEntity | null>;
  save(user: UserEntity): Promise<void>;
  create(user: UserEntity): Promise<void>;
  findAll?(params?: { status?: string; limit?: number; offset?: number }): Promise<UserEntity[]>;
  findActiveRolesByUserId(userId: string): Promise<Array<{ id: string; code: string; name: string }>>;
  findActiveProjectIdsByUserId(userId: string): Promise<string[]>;
  // Transactional variants — share same DB transaction/client as audit log for atomicity
  createWithClient?(client: PoolClient, user: UserEntity): Promise<void>;
  saveWithClient?(client: PoolClient, user: UserEntity): Promise<void>;
  /** IAM-SRS-007: update only the password hash + password_changed_at atomically. Returns affected row count. */
  updatePasswordHash?(userId: string, passwordHash: string, changedAt: Date, client?: PoolClient): Promise<number>;
  /** IAM-SRS-007: read password_changed_at cutoff for session invalidation. */
  getPasswordChangedAt?(userId: string): Promise<Date | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
