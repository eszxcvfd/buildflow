/**
 * Auth storage for web consumer (IAM-SRS-001).
 * Policy: interim browser storage using localStorage, per WEB.md Auth chưa chốt provider.
 * Do not store password. Revocation (logout) is IAM-SRS-002 producer contract – keep integration point.
 */
export interface StoredAuthUser {
  id: string;
  email: string;
  fullName: string;
  status: string;
  userType: string;
}

export interface StoredAuthRole {
  id: string;
  code: string;
  name: string;
}

export interface StoredAuth {
  accessToken: string;
  expiresAt: string; // ISO 8601 UTC
  user: StoredAuthUser;
  roles: StoredAuthRole[];
  projectIds: string[];
}

const STORAGE_KEY = 'buildflow.auth.v1';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function saveAuth(auth: StoredAuth): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // quota or privacy mode – degrade silently, caller can fallback to memory if needed
  }
}

export function getAuth(): StoredAuth | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.accessToken || !parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Sự kiện phát khi thông tin user trong session thay đổi (vd: sau khi lưu hồ sơ). */
export const AUTH_CHANGED_EVENT = 'buildflow:auth-changed';

/**
 * Cập nhật thông tin user trong session đã lưu rồi phát sự kiện AUTH_CHANGED_EVENT
 * để các component đang mở (vd: navbar) hiển thị lại dữ liệu mới ngay, không cần reload.
 */
export function updateStoredUser(
  patch: Partial<Pick<StoredAuthUser, 'fullName' | 'status' | 'userType'>>,
): StoredAuth | null {
  const current = getAuth();
  if (!current) return null;
  const next: StoredAuth = { ...current, user: { ...current.user, ...patch } };
  saveAuth(next);
  if (isBrowser()) window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  return next;
}

export function isTokenExpired(auth: StoredAuth | null, now: Date = new Date()): boolean {
  if (!auth) return true;
  const exp = new Date(auth.expiresAt);
  if (Number.isNaN(exp.getTime())) return true;
  return exp.getTime() <= now.getTime();
}

export function isAuthenticated(now: Date = new Date()): boolean {
  const auth = getAuth();
  if (!auth) return false;
  return !isTokenExpired(auth, now);
}

export function getRoles(): StoredAuthRole[] {
  const auth = getAuth();
  return auth?.roles ?? [];
}

export function getProjectIds(): string[] {
  const auth = getAuth();
  return auth?.projectIds ?? [];
}
