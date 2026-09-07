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

export interface ProjectRepositoryPort extends ProjectRepositoryPortMembers {
  findById(id: string): Promise<ProjectEntity | null>;
  /** Pre-read kèm `managerName` cho lifecycle slice #33 (profile cho alreadyInState + before). */
  findProfileById(id: string): Promise<ProjectProfile | null>;
  /** Pre-check trùng mã case-insensitive (`lower(code) = lower($1)`). */
  findByCode(code: string): Promise<ProjectEntity | null>;
  /** Đọc row trong tx (`SELECT ... FOR UPDATE`) trước khi apply PATCH. */
  findForUpdateWithClient(client: PoolClient, id: string): Promise<ProjectProfile | null>;
  /** Tên manager mới khi đổi `managerId` trong cùng tx. */
  findManagerNameWithClient(client: PoolClient, userId: string): Promise<string | null>;
  createWithClient(client: PoolClient, entity: ProjectEntity): Promise<void>;
  saveWithClient(client: PoolClient, entity: ProjectEntity): Promise<void>;
  /**
   * P9 (issue #32) — auto-membership manager khi CREATE dự án (cùng tx);
   * P11/M4 (issue #36) — reuse khi UPDATE đổi `managerId` (cùng tx):
   * insert `project_members` (`project_role='MANAGER'`, `is_active=true`,
   * `joined_at` default now) cho manager mới chưa có ACTIVE membership.
   * Plain INSERT; 23505 `ux_project_members_active` do caller xử lý.
   */
  insertManagerMembershipWithClient(
    client: PoolClient,
    args: { projectId: string; userId: string; addedBy: string },
  ): Promise<void>;
}

export const PRJ_PROJECT_REPOSITORY = Symbol('PRJ_PROJECT_REPOSITORY');

/* ------------------------------------------------------------------ */
/* PRJ-SRS-005 (issue #36, M1-M6) — quản lý thành viên dự án.           */
/* Bảng `public.project_members` (migration 0001, không migration mới,  */
/* không đổi constraint): project_role CHECK IN ('MANAGER',             */
/* 'COORDINATOR','QC','WORKER','VIEWER'); partial unique                */
/* `ux_project_members_active (project_id, user_id) WHERE is_active`;   */
/* `revocation_ck (is_active OR left_at IS NOT NULL)`. Lưu ý DDL: bảng  */
/* KHÔNG có cột `created_at` — DTO `createdAt` map từ `joined_at`.      */
/* ------------------------------------------------------------------ */

export type ProjectMemberRole = 'MANAGER' | 'COORDINATOR' | 'QC' | 'WORKER' | 'VIEWER';

/**
 * Một row `project_members`. `joinedAt`/`leftAt` là timestamptz
 * (`left_at` NULL = đang tham gia); `createdAt` = `joined_at`
 * (bảng không có cột `created_at` riêng).
 * `userName`/`userCode` join từ users khi rẻ (`full_name`/`employee_code`).
 */
export interface ProjectMemberRow {
  id: string;
  projectId: string;
  userId: string;
  projectRole: ProjectMemberRole;
  joinedAt: Date;
  leftAt: Date | null;
  isActive: boolean;
  addedBy: string;
  createdAt: Date;
  userName?: string | null;
  userCode?: string | null;
}

export interface ProjectMemberFilter {
  projectId: string;
  /** true → toàn bộ lịch sử, sắp `joined_at` DESC; false/thiếu → chỉ `is_active`. */
  includeInactive?: boolean;
}

export interface ProjectRepositoryPortMembers {
  /**
   * Tra cứu thuần SELECT (pool read, không tx) cho GET list —
   * mirror `listMembers` crews #30 (fix F7).
   */
  listMembers(filter: ProjectMemberFilter): Promise<ProjectMemberRow[]>;
  listMembersWithClient(client: PoolClient, filter: ProjectMemberFilter): Promise<ProjectMemberRow[]>;
  findMemberByIdWithClient(client: PoolClient, memberId: string): Promise<ProjectMemberRow | null>;
  findActiveMemberWithClient(
    client: PoolClient,
    projectId: string,
    userId: string,
  ): Promise<ProjectMemberRow | null>;
  insertMemberWithClient(
    client: PoolClient,
    input: { projectId: string; userId: string; projectRole: string; addedBy: string },
  ): Promise<ProjectMemberRow>;
  /**
   * Soft-deactivate (M2): `is_active=false`, `left_at=CURRENT_TIMESTAMP`
   * (thỏa `revocation_ck`; xem §12 M2 — `CURRENT_DATE` nửa đêm vi phạm
   * `membership_dates_ck` khi remove cùng ngày join). Row KHÔNG bao giờ bị xóa.
   */
  deactivateMemberWithClient(client: PoolClient, memberId: string): Promise<ProjectMemberRow | null>;
}

/* ------------------------------------------------------------------ */
/* PRJ-SRS-003 (issue #34, A1-A6) — khu vực dự án (một cấp).             */
/* Bảng `public.project_areas` (baseline 0001 + constraints 0005/0006, KHÔNG */
/* bảng mới): `code` nullable (optional), expression partial unique       */
/* `ux_project_areas_active_name_ci (project_id, lower(name))             */
/* WHERE is_active` (0006, DB-enforced case-insensitive),                */
/* `project_areas_name_ck (btrim(name) <> '')`, FK                      */
/* `fk_project_areas_project_id ... ON DELETE RESTRICT`. Không có cột   */
/* `parent_id` — một cấp enforced by schema. Cột baseline               */
/* `description`/`display_order` tồn tại nhưng slice này không expose    */
/* qua API (giữ default); work_orders.area_id tham chiếu area (module    */
/* JOB chưa tồn tại nên usage count = 0 — xem ENDPOINTS.md §13 A2).      */
/* ------------------------------------------------------------------ */

/**
 * Một row `project_areas`. `code` null = không mã (optional).
 * `description`/`display_order` không map ở slice này.
 */
export interface ProjectAreaRow {
  id: string;
  projectId: string;
  code: string | null;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectAreaFilter {
  projectId: string;
  /** true → chỉ `is_active`; thiếu/false → toàn bộ (kèm inactive, sắp tên). */
  activeOnly?: boolean;
}

export interface ProjectAreaRepositoryPort {
  /**
   * Tra cứu thuần SELECT (pool read, không tx) cho GET list —
   * mirror `listMembers` crews #30 (fix F7).
   */
  listAreas(filter: ProjectAreaFilter): Promise<ProjectAreaRow[]>;
  findAreaById(areaId: string): Promise<ProjectAreaRow | null>;
  /** Đọc row trong tx (`SELECT ... FOR UPDATE`) trước khi apply PATCH. */
  findAreaForUpdateWithClient(client: PoolClient, areaId: string): Promise<ProjectAreaRow | null>;
  /**
   * Pre-check trùng tên active cùng project, case-insensitive (chặt hơn DB
   * btree case-sensitive — precedent P4 `#32`). Caller loại `exclSelf`.
   */
  findActiveAreaByNameWithClient(
    client: PoolClient,
    projectId: string,
    name: string,
  ): Promise<ProjectAreaRow | null>;
  /**
   * Pre-check trùng mã cùng project (index `ux_project_areas_project_code`
   * KHÔNG partial — inactive vẫn giữ mã). NULL không bao giờ match.
   */
  findAreaByCodeWithClient(
    client: PoolClient,
    projectId: string,
    code: string,
  ): Promise<ProjectAreaRow | null>;
  insertAreaWithClient(
    client: PoolClient,
    input: { projectId: string; code: string | null; name: string },
  ): Promise<ProjectAreaRow>;
  /** Rename tại chỗ + toggle active (update name/code/is_active, updated_at). */
  saveAreaWithClient(
    client: PoolClient,
    input: { id: string; code: string | null; name: string; isActive: boolean },
  ): Promise<ProjectAreaRow | null>;
  /** Scope check pool-read: caller có ACTIVE membership trong project không. */
  isActiveProjectMember(projectId: string, userId: string): Promise<boolean>;
}

export const PRJ_PROJECT_AREA_REPOSITORY = Symbol('PRJ_PROJECT_AREA_REPOSITORY');
