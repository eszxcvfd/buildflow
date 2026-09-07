/**
 * Role helpers cho web consumer (ORG-SRS-005, issue #28).
 *
 * Nguồn role duy nhất phía client: session đã lưu ở localStorage
 * (`buildflow.auth.v1` qua `getAuth()` — roles[].code). Không decode JWT
 * phía client, không tự suy diễn quyền ngoài danh sách dưới đây.
 *
 * Codes là `roles.code` thật trong DB (login use-case map roles[].code
 * vào JWT): chỉ `ADMIN` và `PROJECT_MANAGER` được đọc directory.
 * `MANAGER`/`COORDINATOR` thuộc `project_members.project_role`
 * (migration 0001 `project_members_role_ck`) — KHÔNG phải roles.code,
 * nên không được coi là quyền xem directory.
 */

'use client';

import * as React from 'react';
import { AUTH_CHANGED_EVENT, getAuth } from './storage';

const ADMIN_CODES = new Set(['ADMIN']);
const PROJECT_MANAGER_CODES = new Set(['PROJECT_MANAGER']);

export function isAdminCode(code: string): boolean {
  return ADMIN_CODES.has(code.toUpperCase());
}

export function isProjectManagerCode(code: string): boolean {
  return PROJECT_MANAGER_CODES.has(code.toUpperCase());
}

/** ADMIN-only: write/lifecycle/open-work/audit-logs. */
export function hasAdminRole(codes: string[]): boolean {
  return codes.some((c) => isAdminCode(c));
}

/**
 * ORG-SRS-005 — directory tra cứu nguồn lực: ADMIN + PROJECT_MANAGER được đọc
 * (khớp API slice #28: GET /workers, /contractors, /trades search/detail
 * requireRoles ADMIN/PROJECT_MANAGER).
 */
export function canViewResourceDirectory(codes: string[]): boolean {
  const upper = codes.map((c) => c.toUpperCase());
  return upper.some((c) => ADMIN_CODES.has(c) || PROJECT_MANAGER_CODES.has(c));
}

/**
 * PRJ-SRS-001 (issue #32) — write dự án: ADMIN + PROJECT_MANAGER được tạo/sửa
 * hồ sơ dự án (khớp API slice: POST + PATCH requireRoles ADMIN/PROJECT_MANAGER).
 * Fail-closed: role lạ, mảng rỗng hoặc alias project_role đều false.
 */
export function canManageProjects(codes: string[]): boolean {
  const upper = codes.map((c) => c.toUpperCase());
  return upper.some((c) => ADMIN_CODES.has(c) || PROJECT_MANAGER_CODES.has(c));
}

/** Đọc roles hiện tại từ session; đồng bộ lại khi AUTH_CHANGED_EVENT phát. */
export function useSessionRoleCodes(): string[] {
  const [codes, setCodes] = React.useState<string[]>(() => getAuth()?.roles.map((r) => r.code) ?? []);
  React.useEffect(() => {
    function sync() {
      setCodes(getAuth()?.roles.map((r) => r.code) ?? []);
    }
    sync();
    window.addEventListener(AUTH_CHANGED_EVENT, sync);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, sync);
  }, []);
  return codes;
}

/** true khi user hiện tại có quyền admin (hiển thị lifecycle buttons, edit links). */
export function useIsAdmin(): boolean {
  return hasAdminRole(useSessionRoleCodes());
}

/** true khi user được xem trang tra cứu nguồn lực /resources. */
export function useCanViewResourceDirectory(): boolean {
  return canViewResourceDirectory(useSessionRoleCodes());
}

/** true khi user được tạo/sửa hồ sơ dự án (gating CTA 'Tạo dự án', 'Sửa hồ sơ'). */
export function useCanManageProjects(): boolean {
  return canManageProjects(useSessionRoleCodes());
}
