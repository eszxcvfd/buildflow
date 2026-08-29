export interface ProjectMembershipRepositoryPort {
  isMember(userId: string, projectId: string): Promise<boolean>;
  findActiveProjectIdsByUserId(userId: string): Promise<string[]>;
  findActiveMemberUserIdsByProjectId(projectId: string): Promise<string[]>;
}

export const PROJECT_MEMBERSHIP_REPOSITORY = Symbol('PROJECT_MEMBERSHIP_REPOSITORY');
