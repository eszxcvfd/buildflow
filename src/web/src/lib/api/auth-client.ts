import type { components } from './generated';

type LoginDto = components['schemas']['LoginDto'];
type LoginResponseDto = components['schemas']['LoginResponseDto'];

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export interface ProblemDetailsError {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  traceId: string;
  errors?: Record<string, string[]>;
}

export async function login(dto: LoginDto): Promise<LoginResponseDto> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = data as ProblemDetailsError;
    throw new ApiError(err.detail ?? err.title ?? 'Login failed', err);
  }
  return data as LoginResponseDto;
}

export async function fetchMe(token: string): Promise<LoginResponseDto['user']> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError((data as ProblemDetailsError).detail, data as ProblemDetailsError);
  return data;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly problem: ProblemDetailsError,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Token storage decision: demo uses localStorage (and a plain cookie for SSR demo).
 * Production should use httpOnly Secure cookie set via a BFF route (e.g. /api/auth/login)
 * to avoid XSS exposure. Here we store in localStorage for minimal demo and also
 * mirror to `buildflow_token` cookie (non-httpOnly) so Server Components can read it
 * if needed. The raw token is never logged.
 */
export function storeToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('buildflow_token', token);
  // Mirror to cookie (7 days) for server-side reads; not httpOnly in demo
  document.cookie = `buildflow_token=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('buildflow_token');
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('buildflow_token');
  document.cookie = 'buildflow_token=; path=/; max-age=0';
}
