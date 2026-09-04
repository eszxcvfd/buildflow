/**
 * Admin role assignment API client (IAM-SRS-005, GitHub issue #20).
 * Endpoints: GET/PUT /api/v1/admin/users/:id/roles. Admin-only — server enforces role.
 */
export interface AdminRole {
  id: string;
  code: string;
  name: string;
}

export interface GetUserRolesResult {
  userId: string;
  roles: AdminRole[];
  effectivePolicy: string;
}

export interface AssignRolesResult extends GetUserRolesResult {
  beforeRoleIds: string[];
  afterRoleIds: string[];
}

export interface AssignRolesPayload {
  roleIds: string[];
  reason?: string | null;
}

export interface AdminRolesError {
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
    if (msg) throw { status: res.status, message: msg } satisfies AdminRolesError;
  }
  if (typeof body === 'string' && body.length > 0) {
    throw { status: res.status, message: body } satisfies AdminRolesError;
  }
  throw { status: res.status, message: fallback } satisfies AdminRolesError;
}

export async function getUserRoles(userId: string): Promise<GetUserRolesResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/users/${encodeURIComponent(userId)}/roles`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    await parseError(res, `Tải vai trò thất bại (${res.status})`);
  }
  return (await res.json()) as GetUserRolesResult;
}

export async function assignRoles(userId: string, payload: AssignRolesPayload): Promise<AssignRolesResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/admin/users/${encodeURIComponent(userId)}/roles`, {
    method: 'PUT',
    headers: authHeaders('application/json; charset=utf-8'),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    await parseError(res, `Gán vai trò thất bại (${res.status})`);
  }
  return (await res.json()) as AssignRolesResult;
}
