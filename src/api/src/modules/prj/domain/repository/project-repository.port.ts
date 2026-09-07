import { PoolClient } from 'pg';
import { ProjectEntity } from '../entity/project.entity';

/**
 * PRJ-SRS-001 (issue #32) — repository port cho write slice dự án.
 * Reads (`GET /api/v1/projects`, `GET /:id`) ở lại iam module
 * (scope-integrated); port này phục vụ POST/PATCH + pre-check trùng mã.
 */
export interface ProjectProfile {
  entity: ProjectEntity;
  /** `users.full_name` của manager hiện tại (join, có thể null khi user bị xóa mềm). */
  managerName: string | null;
}

export interface ProjectRepositoryPort {
  findById(id: string): Promise<ProjectEntity | null>;
  /** Pre-check trùng mã case-insensitive (`lower(code) = lower($1)`). */
  findByCode(code: string): Promise<ProjectEntity | null>;
  /** Đọc row trong tx (`SELECT ... FOR UPDATE`) trước khi apply PATCH. */
  findForUpdateWithClient(client: PoolClient, id: string): Promise<ProjectProfile | null>;
  /** Tên manager mới khi đổi `managerId` trong cùng tx. */
  findManagerNameWithClient(client: PoolClient, userId: string): Promise<string | null>;
  createWithClient(client: PoolClient, entity: ProjectEntity): Promise<void>;
  saveWithClient(client: PoolClient, entity: ProjectEntity): Promise<void>;
  /**
   * P9 (issue #32) — auto-membership manager khi CREATE dự án (cùng tx).
   * Plain INSERT `project_members` (`project_role='MANAGER'`, `is_active=true`,
   * `joined_at` default now). Không dùng cho UPDATE (manager-change defer #36).
   */
  insertManagerMembershipWithClient(
    client: PoolClient,
    args: { projectId: string; userId: string; addedBy: string },
  ): Promise<void>;
}

export const PRJ_PROJECT_REPOSITORY = Symbol('PRJ_PROJECT_REPOSITORY');
