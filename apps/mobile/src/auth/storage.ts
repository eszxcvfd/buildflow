import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StoredAuth {
  accessToken: string;
  expiresAt: string;
  user: { id: string; email: string; fullName: string; status: string };
  roles: Array<{ id: string; code: string; name: string }>;
  projectIds: string[];
}

const STORAGE_KEY = 'buildflow.auth.v1';

export async function saveAuth(auth: StoredAuth): Promise<void> {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(auth)); } catch { /* quota */ }
}

export async function getAuth(): Promise<StoredAuth | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed.accessToken || !parsed.expiresAt) return null;
    return parsed;
  } catch { return null; }
}

export async function clearAuth(): Promise<void> {
  try { await AsyncStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function isTokenExpired(auth: StoredAuth | null): boolean {
  if (!auth) return true;
  return new Date(auth.expiresAt).getTime() <= Date.now();
}
