export interface ProjectMembershipRepositoryPort {
  isMember(userId: string, projectId: string): Promise<boolean>;
  findActiveProjectIdsByUserId(userId: string): Promise<string[]>;
  findActiveMemberUserIdsByProjectId(projectId: string): Promise<string[]>;
  /**
   * PRJ-SRS-006 (issue #37) — role hiện tại của membership ACTIVE, null khi
   * không là member. Dùng cho write-scope (MANAGER/COORDINATOR mới được write).
   */
  findActiveProjectRole(userId: string, projectId: string): Promise<string | null>;
}

export const PROJECT_MEMBERSHIP_REPOSITORY = Symbol('PROJECT_MEMBERSHIP_REPOSITORY');
