import { PoolClient } from 'pg';
import { RoleEntity } from '../entity/role.entity';

export interface RoleRepositoryPort {
  findByIds(ids: string[]): Promise<RoleEntity[]>;
  findAllActive(): Promise<RoleEntity[]>;
  findById(id: string): Promise<RoleEntity | null>;
  // For testing / seeding helpers, not used in production assignment path
  findActiveRolesByUserId?(userId: string): Promise<Array<{ id: string; code: string; name: string }>>;
  // Role assignment persistence must be transactional
  replaceUserRolesWithClient?(
    client: PoolClient,
    params: { userId: string; roleIds: string[]; actorUserId: string; now: Date },
  ): Promise<void>;
  findActiveRoleIdsByUserIdWithClient?(
    client: PoolClient,
    userId: string,
  ): Promise<string[]>;
  findActiveRoleIdsByUserId?(userId: string): Promise<string[]>;
}

export const ROLE_REPOSITORY = Symbol('ROLE_REPOSITORY');
