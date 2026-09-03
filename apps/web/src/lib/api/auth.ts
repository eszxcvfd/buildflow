"use client";

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

export const GENERIC_INVALID_MSG = 'Thông tin đăng nhập không hợp lệ';
export const ACCOUNT_LOCKED_MSG = 'Tài khoản bị khóa, thử lại sau';

export async function loginRequest(payload: LoginPayload): Promise<LoginSuccess> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error('NEXT_PUBLIC_API_URL is required');

  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    const data = (await res.json()) as LoginSuccess;
    return data;
  }

  const body = await res.json().catch(() => null) as { message?: string | string[] } | null;
  const serverMessage = Array.isArray(body?.message) ? body.message[0] : body?.message;
  throw { status: res.status, message: serverMessage ?? `Đăng nhập thất bại (${res.status})` } satisfies LoginError;
}
