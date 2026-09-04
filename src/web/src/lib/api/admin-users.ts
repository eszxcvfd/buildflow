/**
 * Admin account management API client (IAM-SRS-004, GitHub issue #19).
 * Endpoints: GET/POST /api/v1/admin/users, GET/PATCH /api/v1/admin/users/:id,
 * PATCH /api/v1/admin/users/:id/status. Admin-only — server enforces role.
 */
export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  employeeCode: string | null;
  userType: string;
  contractorId: string | null;
  status: 'ACTIVE' | 'LOCKED' | 'INACTIVE' | string;
  createdAt: string;
  updatedAt: string;
}

export interface ListAdminUsersParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export type AdminUserError = {
  status: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export interface CreateAdminUserPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  employeeCode?: string | null;
  userType?: 'STAFF' | 'WORKER';
  contractorId?: string | null;
}

export interface UpdateAdminUserPayload {
  email?: string;
  fullName?: string;
  phone?: string | null;
  employeeCode?: string | null;
  userType?: 'STAFF' | 'WORKER';
  contractorId?: string | null;
}

export interface UpdateAdminUserStatusPayload {
  status: 'ACTIVE' | 'LOCKED' | 'INACTIVE';
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

function authHeaders(contentType?: string): HeadersInit {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    ...(contentType ? { 'Content-Type': contentType } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body: unknown = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const msg = typeof b.message === 'string' ? b.message : typeof b.error === 'string' ? b.error : undefined;
    if (Array.isArray(b.message)) {
      const fieldErrors: Record<string, string[]> = {};
      for (const m of b.message as unknown[]) {
        if (typeof m !== 'string') continue;
        const lower = m.toLowerCase();
        if (lower.includes('email')) fieldErrors.email = [...(fieldErrors.email ?? []), m];
        else if (lower.includes('mật khẩu') || lower.includes('password')) fieldErrors.password = [...(fieldErrors.password ?? []), m];
        else if (lower.includes('họ tên') || lower.includes('tên')) fieldErrors.fullName = [...(fieldErrors.fullName ?? []), m];
        else if (lower.includes('điện thoại') || lower.includes('phone')) fieldErrors.phone = [...(fieldErrors.phone ?? []), m];
        else if (lower.includes('mã nhân viên') || lower.includes('employee')) fieldErrors.employeeCode = [...(fieldErrors.employeeCode ?? []), m];
        else if (lower.includes('loại tài khoản') || lower.includes('user type')) fieldErrors.userType = [...(fieldErrors.userType ?? []), m];
        else if (lower.includes('trạng thái') || lower.includes('status')) fieldErrors.status = [...(fieldErrors.status ?? []), m];
        else fieldErrors._global = [...(fieldErrors._global ?? []), m];
      }
      throw { status: res.status, message: msg ?? fallback, fieldErrors } satisfies AdminUserError;
    }
    if (msg) throw { status: res.status, message: msg } satisfies AdminUserError;
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies AdminUserError;
  }
  throw { status: res.status, message: fallback } satisfies AdminUserError;
}

export async function listAdminUsers(params: ListAdminUsersParams = {}): Promise<{ data: AdminUser[] }> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  const url = `${getApiBaseUrl()}/api/v1/admin/users${qs.toString() ? `?${qs.toString()}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    await parseError(res, `Tải danh sách tài khoản thất bại (${res.status})`);
  }
  return (await res.json()) as { data: AdminUser[] };
}

export async function getAdminUser(id: string): Promise<AdminUser> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/users/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Tải tài khoản thất bại (${res.status})`);
  }
  return (await res.json()) as AdminUser;
}

export async function createAdminUser(payload: CreateAdminUserPayload): Promise<AdminUser> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/users`, {
    method: 'POST',
    headers: authHeaders('application/json; charset=utf-8'),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Tạo tài khoản thất bại (${res.status})`);
  }
  return (await res.json()) as AdminUser;
}

export async function updateAdminUser(id: string, payload: UpdateAdminUserPayload): Promise<AdminUser> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders('application/json; charset=utf-8'),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Cập nhật tài khoản thất bại (${res.status})`);
  }
  return (await res.json()) as AdminUser;
}

export async function updateAdminUserStatus(id: string, payload: UpdateAdminUserStatusPayload): Promise<AdminUser> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: authHeaders('application/json; charset=utf-8'),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Thay đổi trạng thái tài khoản thất bại (${res.status})`);
  }
  return (await res.json()) as AdminUser;
}
