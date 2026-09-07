import {
  ADDABLE_PROJECT_MEMBER_ROLES,
  isAddableProjectMemberRole,
  normalizeProjectMemberRole,
  normalizeProjectMemberReason,
  MANAGER_VIA_PATCH_MESSAGE,
} from './project-member.policy';

describe('project-member.policy PRJ-SRS-005 (issue #36)', () => {
  it('4 roles gán được qua POST: COORDINATOR/QC/WORKER/VIEWER', () => {
    expect(ADDABLE_PROJECT_MEMBER_ROLES).toEqual(['COORDINATOR', 'QC', 'WORKER', 'VIEWER']);
    for (const role of ['COORDINATOR', 'QC', 'WORKER', 'VIEWER']) {
      expect(isAddableProjectMemberRole(role)).toBe(true);
      expect(normalizeProjectMemberRole(role)).toBe(role);
    }
  });

  it('MANAGER → throw message đặt qua PATCH managerId (use case map 400 fieldErrors {projectRole})', () => {
    expect(() => normalizeProjectMemberRole('MANAGER')).toThrow(MANAGER_VIA_PATCH_MESSAGE);
    expect(MANAGER_VIA_PATCH_MESSAGE).toContain('PATCH /projects/:id managerId');
  });

  it('role lạ/rỗng → throw Vai trò thành viên không hợp lệ', () => {
    expect(() => normalizeProjectMemberRole('LEAD')).toThrow('Vai trò thành viên không hợp lệ');
    expect(() => normalizeProjectMemberRole('ADMIN')).toThrow('Vai trò thành viên không hợp lệ');
    expect(() => normalizeProjectMemberRole('')).toThrow('Vai trò thành viên không hợp lệ');
    expect(() => normalizeProjectMemberRole(undefined)).toThrow('Vai trò thành viên không hợp lệ');
  });

  it('reason optional: thiếu/rỗng/blank → null; hợp lệ giữ trim', () => {
    expect(normalizeProjectMemberReason(undefined)).toBeNull();
    expect(normalizeProjectMemberReason(null)).toBeNull();
    expect(normalizeProjectMemberReason('')).toBeNull();
    expect(normalizeProjectMemberReason('   ')).toBeNull();
    expect(normalizeProjectMemberReason('  Nghỉ việc  ')).toBe('Nghỉ việc');
  });

  it('reason > 500 ký tự → throw', () => {
    expect(() => normalizeProjectMemberReason('x'.repeat(501))).toThrow('Lý do tối đa 500 ký tự');
    expect(normalizeProjectMemberReason('x'.repeat(500))).toBe('x'.repeat(500));
  });
});
