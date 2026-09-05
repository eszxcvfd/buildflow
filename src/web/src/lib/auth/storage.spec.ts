import { AUTH_CHANGED_EVENT, clearAuth, getAuth, isAuthenticated, isTokenExpired, saveAuth, updateStoredUser } from './storage';

const auth = {
  accessToken: 'jwt-1',
  expiresAt: '2026-08-28T12:00:00.000Z',
  user: { id: 'u1', email: 'alice@example.com', fullName: 'Alice', status: 'ACTIVE', userType: 'STAFF' },
  roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
  projectIds: ['p1'],
};

describe('web session storage IAM-SRS-001/002', () => {
  beforeEach(() => window.localStorage.clear());

  it('persists and reads session without password data', () => {
    saveAuth(auth);
    expect(getAuth()).toEqual(auth);
    expect(window.localStorage.getItem('buildflow.auth.v1')).not.toContain('password');
  });

  it('clears the current session on logout', () => {
    saveAuth(auth);
    clearAuth();
    expect(getAuth()).toBeNull();
    expect(isAuthenticated(new Date('2026-08-28T11:00:00.000Z'))).toBe(false);
  });

  it('requires re-authentication for expired or malformed sessions', () => {
    expect(isTokenExpired(auth, new Date('2026-08-28T12:00:00.000Z'))).toBe(true);
    expect(isTokenExpired({ ...auth, expiresAt: 'not-a-date' }, new Date())).toBe(true);
    expect(isAuthenticated(new Date('2026-08-28T13:00:00.000Z'))).toBe(false);
  });

  it('updateStoredUser merges profile changes and notifies listeners', () => {
    saveAuth(auth);
    const listener = jest.fn();
    window.addEventListener(AUTH_CHANGED_EVENT, listener);
    const next = updateStoredUser({ fullName: 'Alice Nguyễn' });
    expect(next?.user.fullName).toBe('Alice Nguyễn');
    expect(getAuth()?.user.fullName).toBe('Alice Nguyễn');
    // không đụng tới các trường còn lại
    expect(getAuth()?.accessToken).toBe('jwt-1');
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_CHANGED_EVENT, listener);
  });

  it('updateStoredUser trả về null khi chưa có session', () => {
    expect(updateStoredUser({ fullName: 'Nobody' })).toBeNull();
  });
});
