/**
 * IAM-SRS-006: Project-scoped data access policy
 * - Admin exception must be explicitly defined (ADMIN role)
 * - All other roles require active project membership
 * - Applied at query/service layer, not post-filter
 */
export const ADMIN_ROLE_CODE = 'ADMIN';

export interface ProjectScopeDecision {
  allowed: boolean;
  reason: 'ADMIN_BYPASS' | 'MEMBER' | 'NOT_MEMBER' | 'INVALID_PROJECT_ID';
  isAdminBypass: boolean;
}

export function isAdminRole(actorRoles: string[]): boolean {
  return actorRoles.includes(ADMIN_ROLE_CODE);
}

export function decideProjectAccess(params: {
  actorRoles: string[];
  isMember: boolean;
  projectId: string | null;
}): ProjectScopeDecision {
  const { actorRoles, isMember, projectId } = params;

  if (!projectId || !isValidUuid(projectId)) {
    return { allowed: false, reason: 'INVALID_PROJECT_ID', isAdminBypass: false };
  }

  if (isAdminRole(actorRoles)) {
    return { allowed: true, reason: 'ADMIN_BYPASS', isAdminBypass: true };
  }

  if (isMember) {
    return { allowed: true, reason: 'MEMBER', isAdminBypass: false };
  }

  return { allowed: false, reason: 'NOT_MEMBER', isAdminBypass: false };
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function filterProjectIdsByScope(params: {
  actorRoles: string[];
  requestedProjectIds: string[]; // may contain any IDs from query/body
  memberProjectIds: string[];
  allProjectIds?: string[]; // for admin bypass listing
}): string[] {
  const { actorRoles, requestedProjectIds, memberProjectIds, allProjectIds } = params;

  if (isAdminRole(actorRoles)) {
    // Admin sees all or requested; no filtering to hide existence but audit bypass
    if (requestedProjectIds.length === 0 && allProjectIds) {
      return [...allProjectIds];
    }
    return [...requestedProjectIds];
  }

  const memberSet = new Set(memberProjectIds);
  // Only retain IDs that are actually members — prevents ID tampering from leaking
  return requestedProjectIds.filter((id) => memberSet.has(id));
}
