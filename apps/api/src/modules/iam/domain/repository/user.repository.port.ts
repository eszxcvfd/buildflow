import type { UserSnapshot } from '../entity/user.entity';

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<UserSnapshot | null>;
  save(user: UserSnapshot): Promise<void>;
  findRolesByUserId(userId: string): Promise<Array<{ id: string; code: string; name: string }>>;
  findProjectIdsByUserId(userId: string): Promise<string[]>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
