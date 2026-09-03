export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginSuccess {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; fullName: string; status: string };
  roles: Array<{ id: string; code: string; name: string }>;
  projectIds: string[];
}

export interface LoginError {
  status: number;
  message: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function loginRequest(payload: LoginPayload): Promise<LoginSuccess> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    return (await res.json()) as LoginSuccess;
  }

  const body = await res.json().catch(() => null) as { message?: string | string[] } | null;
  const serverMessage = Array.isArray(body?.message) ? body.message[0] : body?.message;
  throw { status: res.status, message: serverMessage ?? `Đăng nhập thất bại (${res.status})` } satisfies LoginError;
}

export interface ApiStatus {
  status: string;
  version: string;
  service: string;
  timestamp: string;
}

export async function fetchStatus(): Promise<ApiStatus> {
  const res = await fetch(`${API_URL}/api/v1/status`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json() as Promise<ApiStatus>;
}
