"use client";

export interface StoredAuth {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; fullName: string; status: string };
  roles: Array<{ id: string; code: string; name: string }>;
  projectIds: string[];
}

const STORAGE_KEY = 'buildflow.auth.v1';

export function saveAuth(auth: StoredAuth): void {
  if (typeof globalThis.window === 'undefined') return;
  try { globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth)); } catch { /* quota/private */ }
}

export function getAuth(): StoredAuth | null {
  if (typeof globalThis.window === 'undefined') return null;
  try {
    const raw = globalThis.window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed.accessToken || !parsed.expiresAt) return null;
    return parsed;
  } catch { return null; }
}

export function clearAuth(): void {
  if (typeof globalThis.window === 'undefined') return;
  try { globalThis.window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function isTokenExpired(auth: StoredAuth | null): boolean {
  if (!auth) return true;
  return new Date(auth.expiresAt).getTime() <= Date.now();
}
