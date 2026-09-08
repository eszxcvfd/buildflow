/**
 * Projects API client (PRJ-SRS-001, GitHub issue #32 — write slice).
 *
 * Reads (`GET /api/v1/projects`, `GET /api/v1/projects/:id`) là iam-owned,
 * scope-integrated: non-admin chỉ thấy member projects; hiện chỉ hỗ trợ
 * `limit`/`offset` (không search/status/total) nên UI lọc/phân trang phía
 * client trên tối đa 100 bản ghi fetch về — KHÔNG sửa API read trong slice này.
 * Writes (`POST`, `PATCH /api/v1/projects/:id`) do prj module sở hữu,
 * create requireRoles ADMIN + PROJECT_MANAGER; PATCH/status/members-writes
 * enforce project-scope (PRJ-SRS-006, ENDPOINTS §15: ADMIN bypass audited
 * HOẶC ACTIVE member MANAGER/COORDINATOR). PATCH whitelist
 * {name, description, address, timezone, plannedStartDate, plannedEndDate,
 * managerId} — `code`/`status` trong body → 400 fieldErrors.
 * PRJ-SRS-002 (issue #33) — lifecycle `PATCH /api/v1/projects/:id/status`
 * `{action, reason?}` → profile + `alreadyInState`; 409 INVALID_TRANSITION
 * kèm `allowedTransitions` được giữ nguyên trong ApiError.
 *
 * GET list/detail dùng `cache: 'no-store'`; lỗi 400 shape mới
 * `{ message, fieldErrors }` được giữ nguyên fieldErrors (pattern contractors.ts).
 * Chữ ký `listProjects`/`getProject` giữ nguyên để consumer cũ (dashboard,
 * ProjectsList) không vỡ.
 */

/** Summary shape từ iam reads (GET list/detail). */
export interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  managerId: string;
  createdAt: string;
  updatedAt: string;
}

/** P8 — ProjectProfileDto từ prj writes (POST/PATCH response, đủ 15 trường). */
export interface ProjectProfile {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string;
  timezone: string;
  plannedStartDate: string;
  plannedEndDate: string;
  managerId: string;
  managerName: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export interface ListProjectsParams {
  /** Server giới hạn 1–100 (mặc định 20). Dashboard dùng 100 để đếm chính xác. */
  limit?: number;
  offset?: number;
}

export interface CreateProjectPayload {
  code: string;
  name: string;
  address: string;
  plannedStartDate: string;
  plannedEndDate: string;
  managerId: string;
  description?: string | null;
  timezone?: string | null;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
  address?: string;
  timezone?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  managerId?: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  /** PRJ-SRS-002 — 409 INVALID_TRANSITION kèm actions hợp lệ từ trạng thái hiện tại. */
  allowedTransitions?: string[];
  traceId?: string;
}

/** Giữ nguyên export cũ cho consumer chỉ cần message/status. */
export interface ProjectsError {
  status: number;
  message: string;
}

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('buildflow.auth.v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed?.accessToken ?? null;
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Chuẩn hóa fieldErrors từ API shape
 * `{ statusCode, message, fieldErrors: { <field>: [msg] } }`. Trả undefined
 * khi shape lạ để caller fallback về message chung; an toàn cả hai shape.
 */
export function toFieldErrors(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      const msgs = value.filter((m): m is string => typeof m === 'string');
      if (msgs.length) out[key] = msgs;
    } else if (typeof value === 'string') {
      out[key] = [value];
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function classifyMessage(m: string): { field: string } | null {
  const lower = m.toLowerCase();
  if (lower.includes('mã dự án') || lower.includes('project_code_duplicate') || lower.includes('duplicate')) return { field: 'code' };
  if (lower.includes('code') && !lower.includes('mã nhân viên')) return { field: 'code' };
  if (lower.includes('tên dự án') || lower.includes('name')) return { field: 'name' };
  if (lower.includes('địa chỉ') || lower.includes('address')) return { field: 'address' };
  if (lower.includes('mô tả') || lower.includes('description')) return { field: 'description' };
  if (lower.includes('múi giờ') || lower.includes('timezone')) return { field: 'timezone' };
  if (lower.includes('ngày') || lower.includes('planned') || lower.includes('date')) {
    if (lower.includes('kết thúc') || lower.includes('end')) return { field: 'plannedEndDate' };
    if (lower.includes('bắt đầu') || lower.includes('start')) return { field: 'plannedStartDate' };
    return { field: 'plannedEndDate' };
  }
  if (lower.includes('quản lý') || lower.includes('manager')) return { field: 'managerId' };
  if (lower.includes('lý do') || lower.includes('reason')) return { field: 'reason' };
  if (lower.includes('trạng thái') && !lower.includes('dự án')) return { field: 'status' };
  if (lower.includes('action')) return { field: 'action' };
  return null;
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : undefined;
    const code = typeof b.code === 'string' ? b.code : undefined;
    const traceId = typeof b.traceId === 'string' ? b.traceId : undefined;
    // PRJ-SRS-002 — 409 INVALID_TRANSITION kèm allowedTransitions (actions hợp lệ
    // từ trạng thái hiện tại); giữ nguyên để dialog/detail hiển thị gợi ý.
    const allowedTransitions = Array.isArray(b.allowedTransitions)
      ? (b.allowedTransitions as unknown[]).filter((a): a is string => typeof a === 'string')
      : undefined;
    if (Array.isArray(b.message)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const m of b.message as unknown[]) {
        if (typeof m !== 'string') continue;
        const hit = classifyMessage(m);
        const key = hit?.field ?? '_global';
        fieldErrors[key] = [...(fieldErrors[key] ?? []), m];
      }
      throw { status: res.status, message: msg ?? fallback, code, fieldErrors, allowedTransitions, traceId } satisfies ApiError;
    }
    if (msg) {
      // 409 trùng mã dự án → map về field `code` để form hiển thị theo field.
      if (res.status === 409) {
        if (code === 'PROJECT_CODE_DUPLICATE' || /(đã tồn tại|duplicate|unique|trùng)/i.test(msg)) {
          throw { status: res.status, message: msg, code, fieldErrors: { code: [msg] }, traceId } satisfies ApiError;
        }
        // PRJ-SRS-002 — sai trạng thái → 409 INVALID_TRANSITION + allowedTransitions.
        if (code === 'INVALID_TRANSITION') {
          throw { status: res.status, message: msg, code, allowedTransitions, traceId } satisfies ApiError;
        }
      }
      // 400 single-string từ use case → map vào field tương ứng.
      if (res.status === 400) {
        const hit = classifyMessage(msg);
        if (hit) {
          throw { status: res.status, message: msg, code, fieldErrors: { [hit.field]: [msg] }, traceId } satisfies ApiError;
        }
      }
      // API filter 400 shape { message, fieldErrors }: giữ nguyên fieldErrors server.
      throw { status: res.status, message: msg, code, fieldErrors: toFieldErrors(b.fieldErrors), traceId } satisfies ApiError;
    }
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies ApiError;
  }
  throw { status: res.status, message: fallback } satisfies ApiError;
}

export async function listProjects(params: ListProjectsParams = {}): Promise<Project[]> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const query = qs.toString();
  const res = await fetch(`${getApiBaseUrl()}/api/v1/projects${query ? `?${query}` : ''}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Tải danh sách dự án thất bại (${res.status})`);
  }
  return (await res.json()) as Project[];
}

export async function getProject(id: string): Promise<Project> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/projects/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Tải dự án thất bại (${res.status})`);
  }
  return (await res.json()) as Project;
}

/**
 * PRJ-SRS-001 — tạo dự án (ADMIN + PROJECT_MANAGER). Server luôn ép `DRAFT`.
 * 409 `{ code: 'PROJECT_CODE_DUPLICATE' }` được classify về field `code`.
 */
export async function createProject(payload: CreateProjectPayload): Promise<ProjectProfile> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Tạo dự án thất bại (${res.status})`);
  }
  return (await res.json()) as ProjectProfile;
}

/**
 * PRJ-SRS-001 — sửa hồ sơ dự án (whitelist, KHÔNG `code`/`status`).
 * `code`/`status` trong input bị server reject 400 fieldErrors explicit.
 */
export async function updateProject(id: string, payload: UpdateProjectPayload): Promise<ProjectProfile> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Cập nhật dự án thất bại (${res.status})`);
  }
  return (await res.json()) as ProjectProfile;
}

/**
 * PRJ-SRS-002 (issue #33) — lifecycle trạng thái dự án.
 * `PATCH /api/v1/projects/:id/status` (ADMIN + PROJECT_MANAGER), body
 * `{ action, reason? }`, response ProjectProfileDto + `alreadyInState`.
 * Transition map L1 (server authoritative):
 *   DRAFT → ACTIVE (ACTIVATE), DRAFT → CLOSED (CLOSE, reason)
 *   ACTIVE → PAUSED (PAUSE, reason), ACTIVE → COMPLETED (COMPLETE)
 *   PAUSED → ACTIVE (RESUME), COMPLETED → CLOSED (CLOSE, reason)
 *   CLOSED → ACTIVE (REOPEN, reason)
 * Lỗi: action lạ → 400; sai trạng thái → 409 INVALID_TRANSITION +
 * `allowedTransitions`; thiếu reason → 400 fieldErrors `{reason}`;
 * alreadyInState → 200, không mutation/audit.
 */
export const PROJECT_STATUS_ACTIONS = [
  'ACTIVATE',
  'PAUSE',
  'RESUME',
  'COMPLETE',
  'CLOSE',
  'REOPEN',
] as const;

export type ProjectStatusAction = (typeof PROJECT_STATUS_ACTIONS)[number];

export interface ChangeProjectStatusPayload {
  action: ProjectStatusAction;
  reason?: string | null;
}

export type ChangeProjectStatusResult = ProjectProfile & {
  alreadyInState: boolean;
};

/**
 * PRJ-SRS-005 (issue #36) + PRJ-SRS-006 (issue #37, ENDPOINTS §15) — thành viên dự án.
 *
 * Contract: GET /api/v1/projects/:id/members (`?includeInactive=true` toàn bộ
 * lịch sử, default chỉ active) → `{ data, total }` — reads mở cho mọi ACTIVE
 * member (mọi project_role, kể cả WORKER/QC/VIEWER) + ADMIN bypass (audited);
 * ngoài scope → 403 NOT_MEMBER (không leak tồn tại);
 * POST `:id/members`
 * `{ userId, projectRole }` (`201`; role chỉ COORDINATOR|QC|WORKER|VIEWER —
 * MANAGER → 400 fieldErrors `{projectRole}`, đặt qua PATCH managerId; trùng
 * cùng project → 409 MEMBER_DUPLICATE); DELETE `:id/members/:memberId`
 * `{ reason? }` (soft-deactivate, giữ lịch sử; đã inactive → 200
 * `{ alreadyRemoved: true }` không audit; membership của manager hiện tại →
 * 409 MANAGER_MEMBER). Writes (POST/DELETE) = ADMIN bypass (audited) HOẶC
 * ACTIVE member MANAGER/COORDINATOR — global PROJECT_MANAGER không membership
 * → 403. Web giữ role-gate canManageProjects (ADMIN + PROJECT_MANAGER,
 * fail-closed) cho buttons + 403 graceful (server là authoritative).
 * Reads dùng `cache: 'no-store'`; 400 shape `{ message, fieldErrors }` giữ
 * nguyên fieldErrors server (pattern crews.ts).
 */
export interface ProjectMember {
  id: string;
  userId: string;
  userName: string | null;
  userCode: string | null;
  projectRole: 'MANAGER' | 'COORDINATOR' | 'QC' | 'WORKER' | 'VIEWER' | string;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
  addedBy: string;
  /** Bảng `project_members` không có `created_at` riêng — server map = `joined_at`. */
  createdAt: string;
}

export interface ListProjectMembersParams {
  /** true → toàn bộ lịch sử (kể cả đã rời), false/default → chỉ active. */
  includeInactive?: boolean;
}

export interface ListProjectMembersResult {
  data: ProjectMember[];
  total: number;
}

/** Roles được phép gán qua POST add-member (MANAGER bị chặn cả client lẫn server). */
export const ADDABLE_PROJECT_MEMBER_ROLES = ['COORDINATOR', 'QC', 'WORKER', 'VIEWER'] as const;

export type AddableProjectMemberRole = (typeof ADDABLE_PROJECT_MEMBER_ROLES)[number];

export interface AddProjectMemberPayload {
  userId: string;
  projectRole: AddableProjectMemberRole | string;
}

export interface RemoveProjectMemberPayload {
  /** Lý do rời dự án 1–500, optional — ghi vào audit_logs.reason. */
  reason?: string | null;
}

/** DELETE → soft-deactivate; đã inactive → alreadyRemoved:true, không audit thêm. */
export type RemoveProjectMemberResult = ProjectMember & {
  alreadyRemoved: boolean;
};

function classifyMemberMessage(m: string): { field: string } | null {
  const lower = m.toLowerCase();
  if (lower.includes('người dùng') || lower.includes('nguoi dung') || lower.includes('userid')) return { field: 'userId' };
  if (
    lower.includes('vai trò') ||
    lower.includes('vai tro') ||
    lower.includes('projectrole') ||
    lower.includes('project_role') ||
    lower.includes('quản lý dự án chỉ đặt qua patch')
  )
    return { field: 'projectRole' };
  if (lower.includes('lý do') || lower.includes('reason')) return { field: 'reason' };
  return null;
}

async function parseMemberError(res: Response, fallback: string): Promise<never> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : undefined;
    const code = typeof b.code === 'string' ? b.code : undefined;
    const traceId = typeof b.traceId === 'string' ? b.traceId : undefined;
    if (Array.isArray(b.message)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const m of b.message as unknown[]) {
        if (typeof m !== 'string') continue;
        const hit = classifyMemberMessage(m);
        const key = hit?.field ?? '_global';
        fieldErrors[key] = [...(fieldErrors[key] ?? []), m];
      }
      throw { status: res.status, message: msg ?? fallback, code, fieldErrors, traceId } satisfies ApiError;
    }
    if (msg) {
      // 409 trùng thành viên cùng project → map về field `userId`.
      // 409 MANAGER_MEMBER giữ nguyên `code` để UI hiển thị message actionable.
      if (res.status === 409 && (code === 'MEMBER_DUPLICATE' || /(đã thuộc dự án|duplicate|unique)/i.test(msg))) {
        throw { status: res.status, message: msg, code, fieldErrors: { userId: [msg] }, traceId } satisfies ApiError;
      }
      // API 400 shape { message, fieldErrors }: giữ nguyên fieldErrors server.
      throw { status: res.status, message: msg, code, fieldErrors: toFieldErrors(b.fieldErrors), traceId } satisfies ApiError;
    }
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies ApiError;
  }
  throw { status: res.status, message: fallback } satisfies ApiError;
}

/**
 * PRJ-SRS-005 — tra cứu thành viên: default chỉ active,
 * `includeInactive=true` toàn bộ lịch sử (`joined_at` DESC).
 */
export async function listProjectMembers(
  id: string,
  params: ListProjectMembersParams = {},
): Promise<ListProjectMembersResult> {
  const qs = new URLSearchParams();
  if (params.includeInactive) qs.set('includeInactive', 'true');
  const query = qs.toString();
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/projects/${encodeURIComponent(id)}/members${query ? `?${query}` : ''}`,
    {
      headers: authHeaders(),
      cache: 'no-store',
    },
  );
  if (!res.ok) {
    await parseMemberError(res, `Tải danh sách thành viên dự án thất bại (${res.status})`);
  }
  return (await res.json()) as ListProjectMembersResult;
}

/**
 * PRJ-SRS-005 — thêm thành viên (`201`). Lỗi: 400 fieldErrors (userId /
 * projectRole — MANAGER qua đây bị từ chối, đặt qua PATCH managerId),
 * 404 project, 409 MEMBER_DUPLICATE (code giữ nguyên, fieldErrors.userId).
 */
export async function addProjectMember(id: string, payload: AddProjectMemberPayload): Promise<ProjectMember> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/projects/${encodeURIComponent(id)}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseMemberError(res, `Thêm thành viên dự án thất bại (${res.status})`);
  }
  return (await res.json()) as ProjectMember;
}

/**
 * PRJ-SRS-005 — xóa mềm thành viên (giữ lịch sử).
 * Idempotent: đã inactive → 200 `{ alreadyRemoved: true }`, không audit thêm.
 * Membership của manager hiện tại → 409 MANAGER_MEMBER.
 */
export async function removeProjectMember(
  id: string,
  memberId: string,
  payload: RemoveProjectMemberPayload = {},
): Promise<RemoveProjectMemberResult> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/projects/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`,
    {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    await parseMemberError(res, `Xóa thành viên dự án thất bại (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const { alreadyRemoved, ...member } = body;
  return {
    ...(member as unknown as ProjectMember),
    alreadyRemoved: alreadyRemoved === true,
  };
}

export async function changeProjectStatus(
  id: string,
  payload: ChangeProjectStatusPayload,
): Promise<ChangeProjectStatusResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/projects/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Chuyển trạng thái dự án thất bại (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const { alreadyInState, ...profile } = body;
  return {
    ...(profile as unknown as ProjectProfile),
    alreadyInState: alreadyInState === true,
  };
}

/**
 * PRJ-SRS-003 (issue #34) — khu vực/hạng mục của dự án (một cấp, không
 * hard delete — ngừng sử dụng qua `isActive: false`).
 *
 * Contract: GET /api/v1/projects/:projectId/areas (`?activeOnly=true` chỉ
 * active — future Work Order picker; default kèm inactive, sắp
 * `is_active DESC, name ASC`) → `{ data, total }`; POST `:projectId/areas`
 * `{ code?, name }` (`201`); PATCH `:projectId/areas/:areaId`
 * `{ name?, code? (null = gỡ mã), isActive?, reason? }` (`200` +
 * `alreadyInactive` khi deactivate lặp — idempotent, không audit).
 * Reads mở cho mọi ACTIVE member (kể cả WORKER); writes ADMIN +
 * PROJECT_MANAGER + membership scope (403 ngoài scope). Reads dùng
 * `cache: 'no-store'`; 400 shape `{ message, fieldErrors }` giữ nguyên
 * fieldErrors server (pattern parseMemberError).
 */
export interface ProjectArea {
  id: string;
  projectId: string;
  /** null = không mã. */
  code: string | null;
  name: string;
  /** false = đã retire (ngừng sử dụng, giữ lịch sử). */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListProjectAreasParams {
  /** true → chỉ khu vực đang sử dụng (Work Order picker tương lai). */
  activeOnly?: boolean;
}

export interface ListProjectAreasResult {
  data: ProjectArea[];
  total: number;
}

export interface CreateProjectAreaPayload {
  name: string;
  code?: string | null;
}

export interface UpdateProjectAreaPayload {
  name?: string;
  /** null = gỡ mã khỏi khu vực. */
  code?: string | null;
  /** false = ngừng sử dụng (soft-retire, đường xóa duy nhất). */
  isActive?: boolean;
  /** Lý do 1–500, optional — ghi vào audit_logs.reason. */
  reason?: string | null;
}

/** PATCH → area; deactivate lặp → alreadyInactive:true, không mutation/audit. */
export type UpdateProjectAreaResult = ProjectArea & {
  alreadyInactive: boolean;
};

function classifyAreaMessage(m: string): { field: string } | null {
  const lower = m.toLowerCase();
  if (lower.includes('tên khu vực') || lower.includes('ten khu vuc') || lower.includes('area_duplicate')) return { field: 'name' };
  if (lower.includes('mã khu vực') || lower.includes('ma khu vuc') || lower.includes('area_code_duplicate')) return { field: 'code' };
  if (lower.includes('name') && lower.includes('khu vực')) return { field: 'name' };
  if (lower.includes('code') && lower.includes('khu vực')) return { field: 'code' };
  if (lower.includes('lý do') || lower.includes('reason')) return { field: 'reason' };
  if (lower.includes('trạng thái hoạt động') || lower.includes('isactive')) return { field: 'isActive' };
  return null;
}

async function parseAreaError(res: Response, fallback: string): Promise<never> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : undefined;
    const code = typeof b.code === 'string' ? b.code : undefined;
    const traceId = typeof b.traceId === 'string' ? b.traceId : undefined;
    if (Array.isArray(b.message)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const m of b.message as unknown[]) {
        if (typeof m !== 'string') continue;
        const hit = classifyAreaMessage(m);
        const key = hit?.field ?? '_global';
        fieldErrors[key] = [...(fieldErrors[key] ?? []), m];
      }
      throw { status: res.status, message: msg ?? fallback, code, fieldErrors, traceId } satisfies ApiError;
    }
    if (msg) {
      // 409 trùng mã → field `code` (check trước — message mã cũng chứa
      // cụm 'khu vực đã tồn tại'); 409 trùng tên active cùng project →
      // map về field `name`. Giữ nguyên `code` để UI hiển thị actionable.
      if (res.status === 409 && (code === 'AREA_CODE_DUPLICATE' || /(mã khu vực đã tồn tại|area_code_duplicate)/i.test(msg))) {
        throw { status: res.status, message: msg, code, fieldErrors: { code: [msg] }, traceId } satisfies ApiError;
      }
      if (res.status === 409 && (code === 'AREA_DUPLICATE' || /(khu vực đã tồn tại|area_duplicate)/i.test(msg))) {
        throw { status: res.status, message: msg, code, fieldErrors: { name: [msg] }, traceId } satisfies ApiError;
      }
      // 400 single-string từ use case → map vào field tương ứng.
      if (res.status === 400) {
        const hit = classifyAreaMessage(msg);
        if (hit) {
          throw { status: res.status, message: msg, code, fieldErrors: { [hit.field]: [msg] }, traceId } satisfies ApiError;
        }
      }
      // API 400 shape { message, fieldErrors }: giữ nguyên fieldErrors server.
      throw { status: res.status, message: msg, code, fieldErrors: toFieldErrors(b.fieldErrors), traceId } satisfies ApiError;
    }
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies ApiError;
  }
  throw { status: res.status, message: fallback } satisfies ApiError;
}

/**
 * PRJ-SRS-003 — tra cứu khu vực: default kèm inactive,
 * `activeOnly=true` chỉ khu vực đang sử dụng.
 */
export async function listProjectAreas(
  projectId: string,
  params: ListProjectAreasParams = {},
): Promise<ListProjectAreasResult> {
  const qs = new URLSearchParams();
  if (params.activeOnly) qs.set('activeOnly', 'true');
  const query = qs.toString();
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/projects/${encodeURIComponent(projectId)}/areas${query ? `?${query}` : ''}`,
    {
      headers: authHeaders(),
      cache: 'no-store',
    },
  );
  if (!res.ok) {
    await parseAreaError(res, `Tải danh sách khu vực dự án thất bại (${res.status})`);
  }
  return (await res.json()) as ListProjectAreasResult;
}

/**
 * PRJ-SRS-003 — tạo khu vực (`201`). Lỗi: 400 fieldErrors (name/code),
 * 404 project, 403 ngoài scope, 409 AREA_DUPLICATE (fieldErrors.name) /
 * AREA_CODE_DUPLICATE (fieldErrors.code).
 */
export async function createProjectArea(
  projectId: string,
  payload: CreateProjectAreaPayload,
): Promise<ProjectArea> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/projects/${encodeURIComponent(projectId)}/areas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseAreaError(res, `Tạo khu vực dự án thất bại (${res.status})`);
  }
  return (await res.json()) as ProjectArea;
}

/**
 * PRJ-SRS-003 — sửa khu vực (rename tại chỗ / gỡ mã / toggle isActive).
 * Deactivate lặp → 200 `{ alreadyInactive: true }`, không audit thêm.
 */
export async function updateProjectArea(
  projectId: string,
  areaId: string,
  payload: UpdateProjectAreaPayload,
): Promise<UpdateProjectAreaResult> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/v1/projects/${encodeURIComponent(projectId)}/areas/${encodeURIComponent(areaId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) {
    await parseAreaError(res, `Cập nhật khu vực dự án thất bại (${res.status})`);
  }
  const body = (await res.json()) as Record<string, unknown>;
  const { alreadyInactive, ...area } = body;
  return {
    ...(area as unknown as ProjectArea),
    alreadyInactive: alreadyInactive === true,
  };
}
