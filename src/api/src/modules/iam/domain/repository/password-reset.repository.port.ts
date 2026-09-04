import { PoolClient } from 'pg';

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface PasswordResetRepositoryPort {
  create(record: { userId: string; tokenHash: string; expiresAt: Date }, client?: PoolClient): Promise<PasswordResetTokenRecord>;
  findLatestUsableByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null>;
  markUsed(id: string, usedAt: Date, client?: PoolClient): Promise<void>;
  invalidateAllForUser(userId: string, now: Date, client?: PoolClient): Promise<number>;
}

export const PASSWORD_RESET_REPOSITORY = Symbol('PASSWORD_RESET_REPOSITORY');
