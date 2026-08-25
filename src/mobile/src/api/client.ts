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

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export interface ProblemDetailsError {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  traceId: string;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

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

export async function login(dto: LoginDto): Promise<LoginResponseDto> {
  const res = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = data as ProblemDetailsError;
    throw new Error(err.detail ?? err.title ?? 'Login failed');
  }
  return data as LoginResponseDto;
}

export async function logout(token: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 204) return;
  if (!res.ok) {
    let data: ProblemDetailsError | null = null;
    try {
      data = (await res.json()) as ProblemDetailsError;
    } catch {
      // no body
    }
    if (data) throw new Error(data.detail ?? data.title ?? 'Logout failed');
    throw new Error(`Logout failed: ${res.status}`);
  }
}

export async function fetchMe(token: string): Promise<LoginResponseDto['user']> {
  const res = await fetch(`${API_URL}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as ProblemDetailsError).detail);
  return data;
}
