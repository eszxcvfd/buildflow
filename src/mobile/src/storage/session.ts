import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoginSuccess } from '../api/client';

const SESSION_KEY = 'buildflow.auth.v1';

export type StoredSession = LoginSuccess;

export async function saveSession(session: LoginSuccess): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function getSession(): Promise<StoredSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.accessToken || !parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function isSessionExpired(session: StoredSession | null, now = new Date()): Promise<boolean> {
  if (!session) return true;
  const exp = new Date(session.expiresAt);
  return Number.isNaN(exp.getTime()) || exp.getTime() <= now.getTime();
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
