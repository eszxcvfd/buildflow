export interface ApiStatus {
  status: string;
  version: string;
  service: string;
  timestamp: string;
}

export interface HealthLive {
  status: string;
  timestamp: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface LoginUser {
  id: string;
  email: string;
  fullName: string;
  status: string;
  userType: string;
}

export interface LoginRole {
  id: string;
  code: string;
  name: string;
}

export interface LoginSuccess {
  accessToken: string;
  expiresAt: string;
  user: LoginUser;
  roles: LoginRole[];
  projectIds: string[];
}

export class LoginError extends Error {
  status: number;
  code?: string;
  /** IAM-SRS-007 (issue #22): per-field validation messages, ported from Web `PasswordActionError`. */
  fieldErrors?: Record<string, string[]>;

  constructor(message: string, status: number, code?: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'LoginError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export async function logoutRequest(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  // Contract (IAM-SRS-002): 200 on success; 401 when token missing/expired/revoked.
  // Both are acceptable terminal states for client-side logout — the session is dead either way.
  if (res.ok || res.status === 401) return;
  throw new Error(`Đăng xuất thất bại (${res.status})`);
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  employeeCode: string | null;
  userType: string;
  contractorId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchProfile(token: string): Promise<Profile> {
  const res = await fetch(`${API_URL}/api/v1/me/profile`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Không tải được hồ sơ (${res.status})`);
  return res.json();
}

/**
 * ORG-SRS-008 (issue #31) — self eligibility pre-check.
 * Contract: GET /api/v1/eligibility/me (JwtAuthGuard only, any role; server
 * resolves the worker from the JWT sub). Success shape:
 * `{ resourceType: 'WORKER', resourceId, eligible, checkedAt, correlationId,
 *    conditions: [{ code, passed: boolean|null, reasonCode, detail }],
 *    crews: [{ crewId, crewCode, crewName, memberRole, effectiveFrom, effectiveTo }] }`.
 * Errors reuse LoginError (status + code) so screens can branch: 404 with
 * code RESOURCE_NOT_FOUND means the user has no worker profile; 401 means the
 * session is dead and the user must re-login.
 */
export interface EligibilityCondition {
  code: string;
  passed: boolean | null;
  reasonCode: string;
  detail: string;
}

export interface EligibilityCrewMembership {
  crewId: string;
  crewCode: string;
  crewName: string;
  memberRole: 'LEAD' | 'MEMBER';
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface MyEligibility {
  resourceType: 'WORKER';
  resourceId: string;
  eligible: boolean;
  checkedAt: string;
  correlationId: string;
  conditions: EligibilityCondition[];
  crews: EligibilityCrewMembership[];
}

export async function fetchMyEligibility(token: string): Promise<MyEligibility> {
  const res = await fetch(`${API_URL}/api/v1/eligibility/me`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    // Web-export correctness: never serve a cached eligibility verdict; harmless on native.
    cache: 'no-store',
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.ok && body && typeof body === 'object') return body as MyEligibility;
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const message = typeof b.message === 'string' ? b.message : undefined;
  const code = typeof b.code === 'string' ? b.code : undefined;
  const fallback: Record<number, string> = {
    401: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
    404: 'user không có hồ sơ worker',
  };
  throw new LoginError(message ?? fallback[res.status] ?? `Không tải được điều kiện nhận việc (${res.status})`, res.status, code);
}

export async function updateProfileRequest(token: string, payload: { fullName?: string; phone?: string | null }): Promise<Profile> {
  const res = await fetch(`${API_URL}/api/v1/me/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.ok && body) return body as Profile;
  const b = (body ?? {}) as Record<string, unknown>;
  const message = typeof b.message === 'string' ? b.message : `Cập nhật thất bại (${res.status})`;
  throw new LoginError(message, res.status);
}

/**
 * IAM-SRS-007 (issue #22): derive per-field validation errors from a password-action
 * error body. Handles both shapes the backend can return:
 *  - Nest validation 400: `{ message: string[], error, statusCode }` — entries are
 *    classified into fields by the same Vietnamese keywords as the Web client.
 *  - Use-case 400: `{ message: string, errors: { field: message } }` — keys are the field names.
 * Ported from src/web/src/lib/api/password.ts (Web parity).
 */
function extractFieldErrors(body: unknown): Record<string, string[]> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const b = body as Record<string, unknown>;
  const fieldErrors: Record<string, string[]> = {};

  if (Array.isArray(b.message)) {
    for (const m of b.message as unknown[]) {
      if (typeof m !== 'string') continue;
      const lower = m.toLowerCase();
      if (lower.includes('hiện tại')) fieldErrors.currentPassword = [...(fieldErrors.currentPassword ?? []), m];
      else if (lower.includes('xác nhận')) fieldErrors.confirmPassword = [...(fieldErrors.confirmPassword ?? []), m];
      else if (lower.includes('chữ số') || lower.includes('chữ cái') || lower.includes('mật khẩu mới') || lower.includes('tối thiểu 8')) fieldErrors.newPassword = [...(fieldErrors.newPassword ?? []), m];
      else fieldErrors._global = [...(fieldErrors._global ?? []), m];
    }
  }

  if (b.errors && typeof b.errors === 'object') {
    for (const [field, value] of Object.entries(b.errors as Record<string, unknown>)) {
      const messages = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : typeof value === 'string' ? [value] : [];
      if (messages.length > 0) fieldErrors[field] = [...(fieldErrors[field] ?? []), ...messages];
    }
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

function toPasswordActionError(status: number, body: unknown, fallback: string): LoginError {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const nested = b.message && typeof b.message === 'object' && !Array.isArray(b.message)
    ? (b.message as { message?: string })
    : undefined;
  const message = typeof b.message === 'string'
    ? b.message
    : nested?.message ?? (typeof b.error === 'string' ? b.error : undefined) ?? fallback;
  const code = typeof b.code === 'string' ? b.code : undefined;
  return new LoginError(message, status, code, extractFieldErrors(body));
}

async function parseBody(res: Response): Promise<unknown> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return res.text().catch(() => null);
  return res.json().catch(() => null);
}

/** Fetch wrapper for password actions: network failure → stable user-facing fallback. */
async function passwordFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0);
  }
}

/** IAM-SRS-007: change password for the signed-in user. Contract: confirmPassword is required. */
export async function changePasswordRequest(token: string, currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ message: string; reauthRequired: boolean }> {
  const res = await passwordFetch(`${API_URL}/api/v1/me/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
  const body: unknown = await parseBody(res);
  if (res.ok && body) return body as { message: string; reauthRequired: boolean };
  throw toPasswordActionError(res.status, body, `Đổi mật khẩu thất bại (${res.status})`);
}

/** IAM-SRS-007: request reset (anti-enumeration — the response is always a generic message, no resetUrl). */
export async function requestPasswordResetRequest(email: string): Promise<{ message: string }> {
  const res = await passwordFetch(`${API_URL}/api/v1/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body: unknown = await parseBody(res);
  if (res.ok && body) return body as { message: string };
  throw toPasswordActionError(res.status, body, `Gửi yêu cầu thất bại (${res.status})`);
}

/** IAM-SRS-007: confirm reset with one-time token. Contract: confirmPassword is required. */
export async function confirmPasswordResetRequest(token: string, newPassword: string, confirmPassword: string): Promise<{ message: string; reauthRequired: boolean }> {
  const res = await passwordFetch(`${API_URL}/api/v1/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify({ token, newPassword, confirmPassword }),
  });
  const body: unknown = await parseBody(res);
  if (res.ok && body) return body as { message: string; reauthRequired: boolean };
  throw toPasswordActionError(res.status, body, `Đặt lại mật khẩu thất bại (${res.status})`);
}

export async function loginRequest(email: string, password: string): Promise<LoginSuccess> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const contentType = res.headers.get('content-type') ?? '';
  const body: unknown = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (res.ok && body && typeof body === 'object') {
    const data = body as Record<string, unknown>;
    if (
      typeof data.accessToken === 'string' &&
      typeof data.expiresAt === 'string' &&
      data.user && typeof data.user === 'object' &&
      Array.isArray(data.roles) &&
      Array.isArray(data.projectIds)
    ) {
      return data as unknown as LoginSuccess;
    }
    throw new LoginError('Phản hồi đăng nhập không hợp lệ', 500);
  }

  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const message = typeof b.message === 'string' ? b.message : undefined;
  const code = typeof b.code === 'string' ? b.code : undefined;
  const fallback: Record<number, string> = {
    400: 'Dữ liệu không hợp lệ',
    401: 'Thông tin đăng nhập không hợp lệ',
    403: 'Tài khoản bị hạn chế',
  };
  throw new LoginError(message ?? fallback[res.status] ?? `Yêu cầu thất bại (${res.status})`, res.status, code);
}

export async function fetchStatus(): Promise<ApiStatus> {
  const res = await fetch(`${API_URL}/api/v1/status`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

export async function fetchHealthLive(): Promise<HealthLive> {
  const res = await fetch(`${API_URL}/health/live`);
  if (!res.ok) throw new Error(`live ${res.status}`);
  return res.json();
}

/**
 * PRJ-SRS-006 (issue #37) — project access control, Mobile read slice.
 * Contract (iam-owned reads, scope-integrated, committed at HEAD):
 * - GET /api/v1/projects?limit&offset → bare array of ProjectSummary
 *   (ADMIN sees all; non-admin sees only ACTIVE-membership projects).
 * - GET /api/v1/projects/:id → single ProjectSummary; 403 when the project
 *   exists but is outside the caller's membership (anti-leak), 404 when it
 *   does not exist (reachable for ADMIN), 401 on expired/invalid token.
 * Error semantics mirror the Web client (src/web/src/lib/api/projects.ts):
 * 401 → expired-session copy, 403 → not-a-member copy, 404 → not-found copy.
 */
export interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  managerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListProjectsParams {
  /** Server giới hạn 1–100 (mặc định 20). */
  limit?: number;
  offset?: number;
}

function toProjectError(status: number, body: unknown, fallback: string): LoginError {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const serverMessage = typeof b.message === 'string' ? b.message : undefined;
  const code = typeof b.code === 'string' ? b.code : undefined;
  const copy: Record<number, string> = {
    401: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
    403: 'Bạn không phải thành viên dự án này',
    404: 'Không tìm thấy dự án',
  };
  return new LoginError(serverMessage ?? copy[status] ?? fallback, status, code);
}

export async function listProjects(token: string, params: ListProjectsParams = {}): Promise<ProjectSummary[]> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const query = qs.toString();
  const res = await fetch(`${API_URL}/api/v1/projects${query ? `?${query}` : ''}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    // Web parity: never serve a cached project list; harmless on native.
    cache: 'no-store',
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    if (Array.isArray(body)) return body as ProjectSummary[];
    // Defensive: accept a paginated envelope ({ data: [...] }) if the API
    // ever wraps the list; the committed contract is a bare array.
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (Array.isArray(b.data)) return b.data as ProjectSummary[];
    throw new LoginError('Phản hồi danh sách dự án không hợp lệ', 500);
  }
  throw toProjectError(res.status, body, `Tải danh sách dự án thất bại (${res.status})`);
}

export async function getProject(token: string, id: string): Promise<ProjectSummary> {
  const res = await fetch(`${API_URL}/api/v1/projects/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.ok && body && typeof body === 'object') return body as ProjectSummary;
  throw toProjectError(res.status, body, `Tải dự án thất bại (${res.status})`);
}

/**
 * PRJ-SRS-006 (issue #37) — project members read slice.
 * Contract: GET /api/v1/projects/:id/members → `{ data: ProjectMemberDto[], total }`
 * (any ACTIVE member may read teammates; ADMIN bypass). 403 = out-of-scope
 * (anti-leak: also returned when the project does not exist for non-members),
 * 404 = not found (reachable for ADMIN/in-scope callers), 401 = session dead.
 */
export interface ProjectMember {
  id: string;
  userId: string;
  userName: string | null;
  userCode: string | null;
  projectRole: string;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
}

/**
 * JOB-SRS-005 (issue #45) — Job Board list, Mobile read slice.
 * Contract (ENDPOINTS.md §20): GET /api/v1/job-board?limit&offset →
 * `200 { data: JobBoardItem[], total, limit, offset }` + `Cache-Control: no-store`.
 * Scope = ACTIVE-membership (ADMIN unrestricted); membership rỗng → 200 empty
 * (KHÔNG 403); query key lạ bị ignore; item KHÔNG có `createdBy` (no-PII).
 * Error mapping mirror `toProjectError`: 401 → expired-session copy,
 * 403 → generic copy, network → kết nối fallback (LoginError status 0).
 */
export type JobBoardState = 'AVAILABLE' | 'ASSIGNED' | 'EXPIRED' | 'SCHEDULED' | 'CLOSED';

export interface JobBoardItem {
  id: string;
  code: string;
  title: string;
  projectId: string;
  projectName?: string | null;
  areaId: string | null;
  areaName?: string | null;
  workTypeId: string;
  workTypeName?: string | null;
  requiredTradeId: string | null;
  requiredTradeName?: string | null;
  priority: string;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  plannedHeadcount: number | null;
  version: number;
  jobBoard: {
    open: boolean;
    openFrom: string | null;
    openUntil: string | null;
    state: JobBoardState;
  };
}

export interface JobBoardPage {
  data: JobBoardItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface FetchJobBoardParams {
  /** Server giới hạn 1–100 (mặc định 20). */
  limit?: number;
  offset?: number;
  /**
   * JOB-SRS-006 (issue #46) — 6 filter param, tất cả optional, `''` = absent
   * (không gửi). `areaId`/`workTypeId` lặp được (multi-select chips).
   * `dateFrom`/`dateTo` ISO-8601 bắt buộc offset (mirror #44).
   * `skill` enum duy nhất `mine`.
   */
  projectId?: string;
  areaIds?: string[];
  workTypeIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  skill?: 'mine';
}

export interface JobBoardFilterOptions {
  /** Clock server (ISO string) — khớp contract §20.1, UI giữ trong type. */
  now: string;
  projects: { id: string; name: string }[];
  areas: { id: string; name: string }[];
  workTypes: { id: string; name: string }[];
  trades: { id: string; name: string }[];
}

function toJobBoardError(status: number, body: unknown, fallback: string): LoginError {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const serverMessage = typeof b.message === 'string' ? b.message : undefined;
  const code = typeof b.code === 'string' ? b.code : undefined;
  // F006 (#45): trích body.fieldErrors → arg 4 của LoginError để screen
  // render nguyên nhân per-field (server trả { statusCode, message, fieldErrors }).
  const rawFieldErrors = b.fieldErrors;
  const fieldErrors =
    rawFieldErrors && typeof rawFieldErrors === 'object' && !Array.isArray(rawFieldErrors)
      ? (rawFieldErrors as Record<string, string[]>)
      : undefined;
  const copy: Record<number, string> = {
    401: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
    // 403 defensive-unreachable trên path này (server: membership rỗng → 200
    // empty, không 403) — giữ copy làm #46-forward-compat (filter projectId
    // thêm 403-generic ở #46).
    403: 'Bạn không có quyền xem bảng việc',
  };
  return new LoginError(serverMessage ?? copy[status] ?? fallback, status, code, fieldErrors);
}

export async function fetchJobBoard(token: string, params: FetchJobBoardParams = {}): Promise<JobBoardPage> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  // JOB-SRS-006 (#46): `''` = absent (không gửi); mảng lặp từng phần tử.
  if (params.projectId) qs.set('projectId', params.projectId);
  for (const a of params.areaIds ?? []) if (a) qs.append('areaId', a);
  for (const w of params.workTypeIds ?? []) if (w) qs.append('workTypeId', w);
  if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params.dateTo) qs.set('dateTo', params.dateTo);
  if (params.skill) qs.set('skill', params.skill);
  const query = qs.toString();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/job-board${query ? `?${query}` : ''}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      // Never serve a cached board — availability changes on every claim.
      cache: 'no-store',
    });
  } catch {
    throw new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (Array.isArray(b.data) && typeof b.total === 'number') {
      return {
        data: b.data as JobBoardItem[],
        total: b.total,
        limit: typeof b.limit === 'number' ? b.limit : (params.limit ?? 20),
        offset: typeof b.offset === 'number' ? b.offset : (params.offset ?? 0),
      };
    }
    throw new LoginError('Phản hồi bảng việc không hợp lệ', 500);
  }
  throw toJobBoardError(res.status, body, `Tải bảng việc thất bại (${res.status})`);
}

/**
 * JOB-SRS-006 (issue #46) — nguồn picker cho WORKER (WORKER 403 ở
 * `/trades` và `/work-types`). Cùng scope+availability với list.
 * Contract: ENDPOINTS.md §20.1.
 */
export async function fetchJobBoardFilterOptions(token: string): Promise<JobBoardFilterOptions> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/job-board/filter-options`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    throw new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    // F002 (#46): contract §20.1 trả `{ now, 4 arrays }` — `now` bắt buộc.
    if (
      typeof b.now === 'string' &&
      Array.isArray(b.projects) && Array.isArray(b.areas) && Array.isArray(b.workTypes) && Array.isArray(b.trades)
    ) {
      return b as unknown as JobBoardFilterOptions;
    }
    throw new LoginError('Phản hồi tùy chọn lọc không hợp lệ', 500);
  }
  throw toJobBoardError(res.status, body, `Tải tùy chọn lọc thất bại (${res.status})`);
}

/**
 * JOB-SRS-005 (issue #45) — preview read-only tối thiểu (BD7): tái dùng
 * endpoint có sẵn `GET /api/v1/work-orders/:id` (WORKER ACTIVE member được đọc —
 * ENDPOINTS §17). Shape lỏng: chỉ các field preview cần + `jobBoard.state`
 * optional (list `GET /work-orders` không enrich — chỉ `GET :id` có).
 */
export interface WorkOrderPreview {
  id: string;
  code: string;
  title: string;
  projectId: string;
  projectName?: string | null;
  status: string;
  priority: string;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  version: number;
  jobBoard?: {
    open: boolean;
    openFrom: string | null;
    openUntil: string | null;
    state: JobBoardState;
    hasActiveAssignment?: boolean;
  } | null;
}

export async function fetchWorkOrderPreview(token: string, id: string): Promise<WorkOrderPreview> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/work-orders/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    throw new LoginError('Không thể kết nối máy chủ, vui lòng thử lại', 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok && body && typeof body === 'object') return body as WorkOrderPreview;
  throw toJobBoardError(res.status, body, `Tải chi tiết công việc thất bại (${res.status})`);
}

export async function listProjectMembers(token: string, projectId: string): Promise<ProjectMember[]> {
  const res = await fetch(`${API_URL}/api/v1/projects/${encodeURIComponent(projectId)}/members`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (Array.isArray(b.data)) return b.data as ProjectMember[];
    throw new LoginError('Phản hồi danh sách thành viên không hợp lệ', 500);
  }
  throw toProjectError(res.status, body, `Tải danh sách thành viên thất bại (${res.status})`);
}
