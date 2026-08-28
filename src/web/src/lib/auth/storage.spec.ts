import { clearAuth, getAuth, isAuthenticated, isTokenExpired, saveAuth } from './storage';

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
});
