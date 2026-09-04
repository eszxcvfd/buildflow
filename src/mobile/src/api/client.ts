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
