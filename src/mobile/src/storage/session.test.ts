import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import {
  clearSession,
  getSession,
  isSessionExpired,
  pickBackend,
  saveSession,
  type StoredSession,
} from './session';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockedSecureGet = jest.mocked(SecureStore.getItemAsync);
const mockedSecureSet = jest.mocked(SecureStore.setItemAsync);
const mockedSecureDelete = jest.mocked(SecureStore.deleteItemAsync);
const mockedAsyncGet = jest.mocked(AsyncStorage.getItem);
const mockedAsyncSet = jest.mocked(AsyncStorage.setItem);
const mockedAsyncRemove = jest.mocked(AsyncStorage.removeItem);

const SESSION_KEY = 'buildflow.auth.v1';

function makeSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    accessToken: 'token-123',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    user: { id: 'u1', email: 'e2e@example.com', fullName: 'E2E User', status: 'ACTIVE', userType: 'STAFF' },
    roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
    projectIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  // Mock fns are module-level: reset call history between tests.
  jest.clearAllMocks();
});

describe('session storage backend selection (pickBackend)', () => {
  it('maps web → AsyncStorage and native platforms → SecureStore', () => {
    expect(pickBackend('web')).toBe('async-storage');
    expect(pickBackend('ios')).toBe('secure-store');
    expect(pickBackend('android')).toBe('secure-store');
  });
});

describe('session storage (native = SecureStore)', () => {
  let osSpy: { restore(): void };

  beforeEach(() => {
    // Platform.OS is a plain data property under jest-expo → jest.replaceProperty
    // (jest.spyOn(..., 'get') would fail: not an accessor).
    osSpy = jest.replaceProperty(Platform, 'OS', 'ios');
  });

  afterEach(() => {
    osSpy.restore();
  });

  it('(a) save → get roundtrips through SecureStore only', async () => {
    const session = makeSession();

    await saveSession(session);
    expect(mockedSecureSet).toHaveBeenCalledWith(SESSION_KEY, JSON.stringify(session));
    expect(mockedAsyncSet).not.toHaveBeenCalled();

    mockedSecureGet.mockResolvedValueOnce(JSON.stringify(session));
    await expect(getSession()).resolves.toEqual(session);
    // Primary path hit: the legacy AsyncStorage copy is not even probed.
    expect(mockedAsyncGet).not.toHaveBeenCalled();
  });

  it('(b) migrates a legacy AsyncStorage session into SecureStore and returns it', async () => {
    const legacyPayload = JSON.stringify(makeSession({ accessToken: 'legacy-token' }));
    mockedSecureGet.mockResolvedValueOnce(null); // secure miss
    mockedAsyncGet.mockResolvedValueOnce(legacyPayload); // legacy plaintext found

    await expect(getSession()).resolves.toEqual(makeSession({ accessToken: 'legacy-token' }));

    expect(mockedSecureSet).toHaveBeenCalledWith(SESSION_KEY, legacyPayload);
    // Plaintext copy must be dropped only after the secure write succeeded.
    expect(mockedAsyncRemove).toHaveBeenLastCalledWith(SESSION_KEY);
  });

  it('(b2) drops an unreadable legacy plaintext without throwing', async () => {
    mockedSecureGet.mockResolvedValueOnce(null);
    mockedAsyncGet.mockResolvedValueOnce('{broken json');

    await expect(getSession()).resolves.toBeNull();
    expect(mockedSecureSet).not.toHaveBeenCalled();
    expect(mockedAsyncRemove).toHaveBeenCalledWith(SESSION_KEY);
  });

  it('(c) corrupt JSON from SecureStore → null, no throw, no legacy fallback', async () => {
    mockedSecureGet.mockResolvedValueOnce('{"accessToken": ');
    await expect(getSession()).resolves.toBeNull();
    expect(mockedAsyncGet).not.toHaveBeenCalled();
  });

  it('(d) clearSession wipes both SecureStore and the legacy AsyncStorage key', async () => {
    await clearSession();
    expect(mockedSecureDelete).toHaveBeenCalledWith(SESSION_KEY);
    expect(mockedAsyncRemove).toHaveBeenCalledWith(SESSION_KEY);
  });

  it('(f) session without accessToken or expiresAt → null', async () => {
    mockedSecureGet.mockResolvedValueOnce(JSON.stringify(makeSession({ accessToken: undefined })));
    await expect(getSession()).resolves.toBeNull();
    mockedSecureGet.mockResolvedValueOnce(JSON.stringify(makeSession({ expiresAt: undefined })));
    await expect(getSession()).resolves.toBeNull();
  });

  it('isSessionExpired keeps its public contract (preserved API)', async () => {
    await expect(isSessionExpired(null)).resolves.toBe(true);
    await expect(isSessionExpired(makeSession())).resolves.toBe(false);
    await expect(isSessionExpired(makeSession({ expiresAt: 'not-a-date' }))).resolves.toBe(true);
  });
});

describe('session storage (web = AsyncStorage fallback)', () => {
  let osSpy: { restore(): void };

  beforeEach(() => {
    osSpy = jest.replaceProperty(Platform, 'OS', 'web');
  });

  afterEach(() => {
    osSpy.restore();
  });

  it('(e) save and get use AsyncStorage and never touch SecureStore', async () => {
    const session = makeSession();

    await saveSession(session);
    expect(mockedAsyncSet).toHaveBeenCalledWith(SESSION_KEY, JSON.stringify(session));
    expect(mockedSecureSet).not.toHaveBeenCalled();

    mockedAsyncGet.mockResolvedValueOnce(JSON.stringify(session));
    await expect(getSession()).resolves.toEqual(session);
    expect(mockedSecureGet).not.toHaveBeenCalled();
  });

  it('(c2) corrupt JSON on web → null without throwing', async () => {
    mockedAsyncGet.mockResolvedValueOnce('not-json');
    await expect(getSession()).resolves.toBeNull();
  });

  it('(d2) clearSession on web only clears AsyncStorage (SecureStore unsupported on web)', async () => {
    await clearSession();
    expect(mockedSecureDelete).not.toHaveBeenCalled();
    expect(mockedAsyncRemove).toHaveBeenCalledWith(SESSION_KEY);
  });
});
