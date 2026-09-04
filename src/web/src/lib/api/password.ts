/**
 * IAM-SRS-007 (GitHub issue #22): change password + reset password API client.
 * Never stores passwords/tokens in persistent storage; tokens only in memory/URL per SRS.
 */

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export interface PasswordActionError {
  status: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

function extractFieldErrors(body: unknown): Record<string, string[]> | undefined {
  if (Array.isArray(body)) {
    const fe: Record<string, string[]> = {};
    for (const m of body as unknown[]) {
      if (typeof m !== 'string') continue;
      const lower = m.toLowerCase();
      if (lower.includes('hiện tại')) fe.currentPassword = [...(fe.currentPassword ?? []), m];
      else if (lower.includes('xác nhận')) fe.confirmPassword = [...(fe.confirmPassword ?? []), m];
      else if (lower.includes('chữ số') || lower.includes('chữ cái') || lower.includes('mật khẩu mới') || lower.includes('tối thiểu 8')) fe.newPassword = [...(fe.newPassword ?? []), m];
      else fe._global = [...(fe._global ?? []), m];
    }
    return Object.keys(fe).length ? fe : undefined;
  }
  return undefined;
}

async function parse(res: Response, fallback: string): Promise<never> {
  const ct = res.headers.get('content-type') ?? '';
  const body: unknown = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const nested = b.message && typeof b.message === 'object' ? (b.message as { message?: string }) : null;
    const msg = typeof b.message === 'string'
      ? b.message
      : nested?.message
        ?? (typeof b.error === 'string' ? b.error : undefined);
    throw { status: res.status, message: msg ?? fallback, fieldErrors: extractFieldErrors(b.message) } satisfies PasswordActionError;
  }
  throw { status: res.status, message: fallback } satisfies PasswordActionError;
}

function authHeader(token: string | null): HeadersInit {
  return { Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function changePassword(token: string | null, currentPassword: string, newPassword: string): Promise<{ message: string; reauthRequired: boolean }> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/me/password`, {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword: newPassword }),
  });
  if (!res.ok) await parse(res, 'Đổi mật khẩu thất bại');
  return res.json();
}

/** Always resolves with the same generic message regardless of email existence (anti-enumeration). */
export async function requestPasswordReset(email: string): Promise<{ message: string; resetUrl?: string }> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/password-reset/request`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) await parse(res, 'Gửi yêu cầu thất bại');
  return res.json();
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<{ message: string; reauthRequired: boolean }> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) await parse(res, 'Đặt lại mật khẩu thất bại');
  return res.json();
}
