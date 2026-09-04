import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { LoginSuccess } from '../api/client';

// Same key on both backends. Valid for SecureStore (alphanumeric plus '.','-','_')
// and for AsyncStorage.
const SESSION_KEY = 'buildflow.auth.v1';

// Why AsyncStorage on web (accepted risk): the expo-secure-store line matching
// this project's Expo SDK 51 (~13.0.x) has no web implementation — its web
// native-module shim is an empty stub and every call throws UnavailabilityError —
// while this app also runs as `expo start --web`, so web must persist somewhere.
// Consequence: on web the accessToken still lives in plain AsyncStorage
// (localStorage), which we accept for now because web is a dev/preview target
// and tokens are short-lived; native builds never persist new sessions outside
// Keychain/Keystore. Documented in docs/architecture/MOBILE.md.
export type StoredSession = LoginSuccess;

export type SessionBackend = 'secure-store' | 'async-storage';

// Pure and exported so tests can pin the platform → backend mapping without
// mocking react-native.
export function pickBackend(platform: string): SessionBackend {
  return platform === 'web' ? 'async-storage' : 'secure-store';
}

// Same JSON validation as before the secure-storage migration: unreadable JSON
// or a session missing accessToken/expiresAt counts as "no session", never throws.
function parseSession(raw: string): StoredSession | null {
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.accessToken || !parsed?.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: LoginSuccess): Promise<void> {
  const payload = JSON.stringify(session);
  if (pickBackend(Platform.OS) === 'secure-store') {
    await SecureStore.setItemAsync(SESSION_KEY, payload);
    return;
  }
  await AsyncStorage.setItem(SESSION_KEY, payload);
}

export async function getSession(): Promise<StoredSession | null> {
  try {
    if (pickBackend(Platform.OS) === 'async-storage') {
      // Web: the AsyncStorage copy is the only copy, nothing to migrate.
      const webRaw = await AsyncStorage.getItem(SESSION_KEY);
      return webRaw ? parseSession(webRaw) : null;
    }

    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (raw) return parseSession(raw);

    // LEGACY MIGRATION (plaintext → Keychain/Keystore): sessions written by
    // builds before the secure-storage migration lived in AsyncStorage under
    // the same key. On the first read after upgrading, copy the value into
    // SecureStore, delete the plaintext copy and return the session so the
    // existing user is not logged out.
    const legacyRaw = await AsyncStorage.getItem(SESSION_KEY);
    if (!legacyRaw) return null;
    const legacy = parseSession(legacyRaw);
    if (!legacy) {
      // Plaintext garbage: unreadable JSON — drop it instead of re-parsing
      // the same broken payload on every launch.
      await AsyncStorage.removeItem(SESSION_KEY);
      return null;
    }
    await SecureStore.setItemAsync(SESSION_KEY, legacyRaw);
    await AsyncStorage.removeItem(SESSION_KEY);
    return legacy;
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
  if (pickBackend(Platform.OS) === 'secure-store') {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
  // Defence in depth: the legacy AsyncStorage key must never outlive the
  // session, no matter which backend the current (or an older) build wrote to.
  await AsyncStorage.removeItem(SESSION_KEY);
}
