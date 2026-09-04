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

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface ProfileError {
  status: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
}

export async function fetchProfile(token: string): Promise<Profile> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/me/profile`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw { status: res.status, message: `Không tải được hồ sơ (${res.status})` } satisfies ProfileError;
  return res.json();
}

export async function updateProfile(token: string, payload: UpdateProfilePayload): Promise<Profile> {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/me/profile`, {
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
  let message = typeof b.message === 'string' ? b.message : `Cập nhật thất bại (${res.status})`;
  const fieldErrors: Record<string, string[]> = {};
  if (Array.isArray(b.message)) {
    for (const m of b.message as unknown[]) {
      if (typeof m !== 'string') continue;
      const lower = m.toLowerCase();
      if (lower.includes('họ tên') || lower.includes('fullname')) fieldErrors.fullName = [...(fieldErrors.fullName ?? []), m];
      else if (lower.includes('phone') || lower.includes('điện thoại')) fieldErrors.phone = [...(fieldErrors.phone ?? []), m];
      else if (lower.includes('avatar')) fieldErrors.avatarUrl = [...(fieldErrors.avatarUrl ?? []), m];
      else fieldErrors._global = [...(fieldErrors._global ?? []), m];
    }
    message = fieldErrors._global?.[0] ?? 'Dữ liệu không hợp lệ';
  }
  throw { status: res.status, message, fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined } satisfies ProfileError;
}
