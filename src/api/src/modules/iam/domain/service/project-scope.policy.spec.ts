import {
  decideProjectAccess,
  isAdminRole,
  filterProjectIdsByScope,
  isValidUuid,
  ADMIN_ROLE_CODE,
} from './project-scope.policy';

describe('ProjectScopePolicy IAM-SRS-006', () => {
  const validId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';

  it('ADMIN bypasses membership check', () => {
    const d = decideProjectAccess({ actorRoles: [ADMIN_ROLE_CODE], isMember: false, projectId: validId });
    expect(d.allowed).toBe(true);
    expect(d.isAdminBypass).toBe(true);
    expect(d.reason).toBe('ADMIN_BYPASS');
    expect(isAdminRole([ADMIN_ROLE_CODE])).toBe(true);
    expect(isAdminRole(['WORKER'])).toBe(false);
  });

  it('member allowed, non-member denied', () => {
    expect(decideProjectAccess({ actorRoles: ['WORKER'], isMember: true, projectId: validId }).allowed).toBe(true);
    expect(decideProjectAccess({ actorRoles: ['WORKER'], isMember: false, projectId: validId }).allowed).toBe(false);
    expect(decideProjectAccess({ actorRoles: ['WORKER'], isMember: false, projectId: validId }).reason).toBe('NOT_MEMBER');
  });

  it('invalid projectId denied and not leak', () => {
    expect(decideProjectAccess({ actorRoles: ['ADMIN'], isMember: false, projectId: 'not-uuid' }).allowed).toBe(false);
    expect(decideProjectAccess({ actorRoles: ['ADMIN'], isMember: false, projectId: '' }).reason).toBe('INVALID_PROJECT_ID');
    expect(isValidUuid('not-uuid')).toBe(false);
    expect(isValidUuid(validId)).toBe(true);
  });

  it('ID tampering: filter retains only member IDs', () => {
    const memberIds = [validId];
    const requested = [validId, otherId];
    const filtered = filterProjectIdsByScope({
      actorRoles: ['WORKER'],
      requestedProjectIds: requested,
      memberProjectIds: memberIds,
    });
    expect(filtered).toEqual([validId]);
    expect(filtered).not.toContain(otherId);
  });

  it('admin sees all requested without filtering', () => {
    const filtered = filterProjectIdsByScope({
      actorRoles: [ADMIN_ROLE_CODE],
      requestedProjectIds: [validId, otherId],
      memberProjectIds: [],
    });
    expect(filtered).toHaveLength(2);
  });

  it('admin list with no filter returns allProjectIds', () => {
    const all = [validId, otherId];
    const filtered = filterProjectIdsByScope({
      actorRoles: [ADMIN_ROLE_CODE],
      requestedProjectIds: [],
      memberProjectIds: [],
      allProjectIds: all,
    });
    expect(filtered).toEqual(all);
  });

  it('non-admin list empty when no membership', () => {
    const filtered = filterProjectIdsByScope({
      actorRoles: ['WORKER'],
      requestedProjectIds: [validId],
      memberProjectIds: [],
    });
    expect(filtered).toEqual([]);
  });
});
