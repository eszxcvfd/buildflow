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
