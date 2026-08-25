import { SessionEntity } from '../entity/session.entity';

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface SessionRepositoryPort {
  create(params: { userId: string; tokenHash: string; expiresAt: Date | null }): Promise<SessionEntity>;
  findByTokenHash(tokenHash: string): Promise<SessionEntity | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  deleteById(id: string): Promise<void>;
}
