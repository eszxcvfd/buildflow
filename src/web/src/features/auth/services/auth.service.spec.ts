import { clearAuth, getAuth, saveAuth } from '@/lib/auth/storage';
import { loginAndPersist, logoutAndClear } from './auth.service';
import { loginRequest, logoutRequest } from '@/lib/api/auth';

jest.mock('@/lib/api/auth', () => ({
  loginRequest: jest.fn(),
  logoutRequest: jest.fn(),
}));

const loginMock = loginRequest as jest.MockedFunction<typeof loginRequest>;
const logoutMock = logoutRequest as jest.MockedFunction<typeof logoutRequest>;

describe('auth service IAM-SRS-001/002', () => {
  beforeEach(() => {
    window.localStorage.clear();
    loginMock.mockReset();
    logoutMock.mockReset();
  });

  it('trims email, persists successful login, and normalizes expiry', async () => {
    loginMock.mockResolvedValue({
      accessToken: 'jwt-1', expiresAt: '2026-08-28T12:00:00.000Z',
      user: { id: 'u1', email: 'alice@example.com', fullName: 'Alice', status: 'ACTIVE', userType: 'STAFF' },
      roles: [], projectIds: [],
    });
    await loginAndPersist(' alice@example.com ', 'Secret123!');
    expect(loginMock).toHaveBeenCalledWith({ email: 'alice@example.com', password: 'Secret123!' });
    expect(getAuth()?.accessToken).toBe('jwt-1');
  });

  it('always clears local session when server logout is expired/revoked', async () => {
    saveAuth({
      accessToken: 'jwt-1', expiresAt: '2026-08-28T12:00:00.000Z',
      user: { id: 'u1', email: 'alice@example.com', fullName: 'Alice', status: 'ACTIVE', userType: 'STAFF' },
      roles: [], projectIds: [],
    });
    logoutMock.mockRejectedValue({ status: 401, message: 'Phiên hết hạn, vui lòng đăng nhập lại' });
    await expect(logoutAndClear()).resolves.toBeUndefined();
    expect(logoutMock).toHaveBeenCalledWith('jwt-1');
    expect(getAuth()).toBeNull();
    expect(clearAuth).toBeDefined();
  });
});
