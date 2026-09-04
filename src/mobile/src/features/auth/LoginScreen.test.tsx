import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { LoginScreen } from './LoginScreen';
import * as client from '../../api/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('LoginScreen', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('shows field validation errors when submitting empty form', async () => {
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());
    fireEvent.press(screen.getByLabelText('login submit'));
    expect(screen.getByText('Email không được để trống')).toBeTruthy();
    expect(screen.getByText('Mật khẩu không được để trống')).toBeTruthy();
  });

  it('renders session view after successful login', async () => {
    jest.spyOn(client, 'loginRequest').mockResolvedValueOnce({
      accessToken: 'token-123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: { id: 'u1', email: 'e2e@example.com', fullName: 'E2E User', status: 'ACTIVE', userType: 'STAFF' },
      roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
      projectIds: [],
    });
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());

    fireEvent.changeText(screen.getByLabelText('email input'), 'e2e@example.com');
    fireEvent.changeText(screen.getByLabelText('password input'), 'Password123!');
    fireEvent.press(screen.getByLabelText('login submit'));

    await waitFor(() => expect(screen.getByText('Xin chào, E2E User')).toBeTruthy());
    expect(screen.getByLabelText('logout')).toBeTruthy();
  });

  it('calls server logout then clears session when pressing logout', async () => {
    jest.spyOn(client, 'loginRequest').mockResolvedValueOnce({
      accessToken: 'token-123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: { id: 'u1', email: 'e2e@example.com', fullName: 'E2E User', status: 'ACTIVE', userType: 'STAFF' },
      roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
      projectIds: [],
    });
    const logoutSpy = jest.spyOn(client, 'logoutRequest').mockResolvedValueOnce();
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());
    fireEvent.changeText(screen.getByLabelText('email input'), 'e2e@example.com');
    fireEvent.changeText(screen.getByLabelText('password input'), 'Password123!');
    fireEvent.press(screen.getByLabelText('login submit'));
    await waitFor(() => expect(screen.getByText('Xin chào, E2E User')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('logout'));
    await waitFor(() => expect(logoutSpy).toHaveBeenCalledWith('token-123'));
    await waitFor(() => expect(screen.getByRole('header', { name: 'Đăng nhập' })).toBeTruthy());
  });

  it('keeps session view and shows error when logout API fails (network)', async () => {
    jest.spyOn(client, 'loginRequest').mockResolvedValueOnce({
      accessToken: 'token-123',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      user: { id: 'u1', email: 'e2e@example.com', fullName: 'E2E User', status: 'ACTIVE', userType: 'STAFF' },
      roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
      projectIds: [],
    });
    jest.spyOn(client, 'logoutRequest').mockRejectedValueOnce(new Error('network down'));
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());
    fireEvent.changeText(screen.getByLabelText('email input'), 'e2e@example.com');
    fireEvent.changeText(screen.getByLabelText('password input'), 'Password123!');
    fireEvent.press(screen.getByLabelText('login submit'));
    await waitFor(() => expect(screen.getByText('Xin chào, E2E User')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('logout'));
    await waitFor(() => expect(screen.getByText(/không thể kết nối/i)).toBeTruthy());
    expect(screen.getByText('Xin chào, E2E User')).toBeTruthy();
  });
});

describe('LoginScreen password flows (IAM-SRS-007, issue #22)', () => {
  const loginSuccess = {
    accessToken: 'token-123',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: { id: 'u1', email: 'e2e@example.com', fullName: 'E2E User', status: 'ACTIVE', userType: 'STAFF' },
    roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
    projectIds: [],
  };

  const profileFixture = {
    id: 'u1',
    email: 'e2e@example.com',
    fullName: 'E2E User',
    phone: null,
    avatarUrl: null,
    employeeCode: null,
    userType: 'STAFF',
    contractorId: null,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('forgot flow shows the generic API message and never a resetUrl', async () => {
    const genericMessage = 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.';
    const spy = jest.spyOn(client, 'requestPasswordResetRequest').mockResolvedValueOnce({ message: genericMessage });
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());

    fireEvent.press(screen.getByLabelText('forgot password'));
    fireEvent.changeText(screen.getByLabelText('forgot email input'), 'e2e@example.com');
    fireEvent.press(screen.getByLabelText('send reset request'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith('e2e@example.com'));
    expect(await screen.findByText(genericMessage)).toBeTruthy();
    expect(screen.queryByText(/resetUrl/i)).toBeNull();
  });

  it('forgot flow guards against double-submit while busy (API called once)', async () => {
    let resolveRequest!: (value: { message: string }) => void;
    const pending = new Promise<{ message: string }>((resolve) => { resolveRequest = resolve; });
    const spy = jest.spyOn(client, 'requestPasswordResetRequest').mockImplementation(() => pending);
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());

    fireEvent.press(screen.getByLabelText('forgot password'));
    fireEvent.changeText(screen.getByLabelText('forgot email input'), 'e2e@example.com');
    fireEvent.press(screen.getByLabelText('send reset request'));
    fireEvent.press(screen.getByLabelText('send reset request'));

    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => { resolveRequest({ message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.' }); });
    expect(await screen.findByText('Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.')).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('reset form shows the password policy hint before submitting', async () => {
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());

    fireEvent.press(screen.getByLabelText('have reset token'));
    expect(screen.getByText('Mật khẩu mới tối thiểu 8 ký tự, chứa ít nhất một chữ cái và một chữ số.')).toBeTruthy();
  });

  it('reset flow succeeds then automatically returns to login mode (~2s)', async () => {
    const spy = jest.spyOn(client, 'confirmPasswordResetRequest').mockResolvedValueOnce({ message: 'Đổi mật khẩu thành công', reauthRequired: true });
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());

    fireEvent.press(screen.getByLabelText('have reset token'));
    fireEvent.changeText(screen.getByLabelText('reset token input'), 'tok-123');
    fireEvent.changeText(screen.getByLabelText('reset new password input'), 'NewPass123');
    fireEvent.changeText(screen.getByLabelText('reset confirm password input'), 'NewPass123');
    fireEvent.press(screen.getByLabelText('confirm reset'));

    await waitFor(() => expect(spy).toHaveBeenCalledWith('tok-123', 'NewPass123', 'NewPass123'));
    expect(await screen.findByText('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.')).toBeTruthy();
    // auto-return parity with Web (2.5s redirect there, ~2s here)
    await waitFor(() => expect(screen.getByRole('header', { name: 'Đăng nhập' })).toBeTruthy(), { timeout: 4000 });
  }, 15000);

  it('reset flow renders per-field errors from the API fieldErrors', async () => {
    jest.spyOn(client, 'confirmPasswordResetRequest').mockRejectedValueOnce(
      new client.LoginError('Dữ liệu không hợp lệ', 400, undefined, { token: ['Token không hợp lệ hoặc đã hết hạn'] }),
    );
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());

    fireEvent.press(screen.getByLabelText('have reset token'));
    fireEvent.changeText(screen.getByLabelText('reset token input'), 'expired-token');
    fireEvent.changeText(screen.getByLabelText('reset new password input'), 'NewPass123');
    fireEvent.changeText(screen.getByLabelText('reset confirm password input'), 'NewPass123');
    fireEvent.press(screen.getByLabelText('confirm reset'));

    expect(await screen.findByText('Token không hợp lệ hoặc đã hết hạn')).toBeTruthy();
    expect(screen.getByText('Dữ liệu không hợp lệ')).toBeTruthy();
  });

  it('P1 session fix: password change clears the persisted session before dropping UI state', async () => {
    jest.spyOn(client, 'loginRequest').mockResolvedValueOnce(loginSuccess);
    jest.spyOn(client, 'fetchProfile').mockResolvedValueOnce(profileFixture);
    jest.spyOn(client, 'changePasswordRequest').mockResolvedValueOnce({ message: 'Đổi mật khẩu thành công', reauthRequired: true });
    render(<LoginScreen />);
    await waitFor(() => expect(screen.queryByLabelText('session loading indicator')).toBeNull());

    fireEvent.changeText(screen.getByLabelText('email input'), 'e2e@example.com');
    fireEvent.changeText(screen.getByLabelText('password input'), 'Password123!');
    fireEvent.press(screen.getByLabelText('login submit'));
    await waitFor(() => expect(screen.getByText('Xin chào, E2E User')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('view profile'));
    await waitFor(() => expect(screen.getByText('Hồ sơ cá nhân')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('current password input'), 'OldPass123');
    fireEvent.changeText(screen.getByLabelText('new password input'), 'NewPass123');
    fireEvent.changeText(screen.getByLabelText('confirm password input'), 'NewPass123');
    fireEvent.press(screen.getByLabelText('change password'));
    await waitFor(() => expect(screen.getByText('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.')).toBeTruthy());

    // After the ~1.2s success notice the hand-off must wipe the persisted session
    // (accessToken) from AsyncStorage — not just the in-memory state (issue #22 P1).
    await waitFor(() => expect(screen.getByRole('header', { name: 'Đăng nhập' })).toBeTruthy(), { timeout: 4000 });
    await expect(AsyncStorage.getItem('buildflow.auth.v1')).resolves.toBeNull();
  }, 15000);
});
