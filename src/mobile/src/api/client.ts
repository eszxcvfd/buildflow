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

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'LoginError';
    this.status = status;
    this.code = code;
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

/** IAM-SRS-007: change password for the signed-in user. */
export async function changePasswordRequest(token: string, currentPassword: string, newPassword: string): Promise<{ message: string; reauthRequired: boolean }> {
  const res = await fetch(`${API_URL}/api/v1/me/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword: newPassword }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.ok && body) return body as { message: string; reauthRequired: boolean };
  const b = (body ?? {}) as Record<string, unknown>;
  const nested = b.message && typeof b.message === 'object' ? (b.message as { message?: string }).message : undefined;
  const message = typeof b.message === 'string' ? b.message : nested ?? `Đổi mật khẩu thất bại (${res.status})`;
  throw new LoginError(message, res.status);
}

/** IAM-SRS-007: request reset (anti-enumeration — generic message always). */
export async function requestPasswordResetRequest(email: string): Promise<{ message: string; resetUrl?: string }> {
  const res = await fetch(`${API_URL}/api/v1/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.ok && body) return body as { message: string; resetUrl?: string };
  throw new LoginError(`Gửi yêu cầu thất bại (${res.status})`, res.status);
}

/** IAM-SRS-007: confirm reset with one-time token. */
export async function confirmPasswordResetRequest(token: string, newPassword: string): Promise<{ message: string; reauthRequired: boolean }> {
  const res = await fetch(`${API_URL}/api/v1/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  const body: unknown = await res.json().catch(() => null);
  if (res.ok && body) return body as { message: string; reauthRequired: boolean };
  const b = (body ?? {}) as Record<string, unknown>;
  const message = typeof b.message === 'string' ? b.message : `Đặt lại mật khẩu thất bại (${res.status})`;
  throw new LoginError(message, res.status);
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
