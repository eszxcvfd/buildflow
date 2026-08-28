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
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
