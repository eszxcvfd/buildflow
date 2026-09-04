import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { ProfileScreen } from './ProfileScreen';
import * as client from '../../api/client';
import type { Profile } from '../../api/client';

const profileFixture: Profile = {
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

describe('ProfileScreen change password (IAM-SRS-007, issue #22)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function fillChangePasswordForm(current = 'OldPass123', next = 'NewPass123', confirm = 'NewPass123') {
    fireEvent.changeText(screen.getByLabelText('current password input'), current);
    fireEvent.changeText(screen.getByLabelText('new password input'), next);
    fireEvent.changeText(screen.getByLabelText('confirm password input'), confirm);
    fireEvent.press(screen.getByLabelText('change password'));
  }

  it('renders the change-password form after loading the profile', async () => {
    jest.spyOn(client, 'fetchProfile').mockResolvedValueOnce(profileFixture);
    render(<ProfileScreen token="tok-1" />);
    expect(await screen.findByText('Hồ sơ cá nhân')).toBeTruthy();
    expect(screen.getByLabelText('current password input')).toBeTruthy();
    expect(screen.getByLabelText('new password input')).toBeTruthy();
    expect(screen.getByLabelText('confirm password input')).toBeTruthy();
  });

  it('client-side validation: mismatched confirm renders its field error without calling the API', async () => {
    jest.spyOn(client, 'fetchProfile').mockResolvedValue(profileFixture);
    const changeSpy = jest.spyOn(client, 'changePasswordRequest');
    render(<ProfileScreen token="tok-1" />);
    await screen.findByText('Hồ sơ cá nhân');

    fillChangePasswordForm('OldPass123', 'NewPass123', 'Different123');

    expect(screen.getByText('Xác nhận mật khẩu không khớp')).toBeTruthy();
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it('successful change: shows success, then calls onPasswordChanged after the ~1.2s notice', async () => {
    jest.spyOn(client, 'fetchProfile').mockResolvedValue(profileFixture);
    jest.spyOn(client, 'changePasswordRequest').mockResolvedValueOnce({ message: 'Đổi mật khẩu thành công', reauthRequired: true });
    const onPasswordChanged = jest.fn();
    render(<ProfileScreen token="tok-1" onPasswordChanged={onPasswordChanged} />);
    await screen.findByText('Hồ sơ cá nhân');

    fillChangePasswordForm();

    expect(await screen.findByText('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.')).toBeTruthy();
    expect(onPasswordChanged).not.toHaveBeenCalled();
    await waitFor(() => expect(onPasswordChanged).toHaveBeenCalledTimes(1), { timeout: 3000 });
  }, 15000);

  it('unmount before the hand-off fires: onPasswordChanged is never called (timer cleanup)', async () => {
    jest.spyOn(client, 'fetchProfile').mockResolvedValue(profileFixture);
    jest.spyOn(client, 'changePasswordRequest').mockResolvedValue({ message: 'Đổi mật khẩu thành công', reauthRequired: true });
    const onPasswordChanged = jest.fn();
    const { unmount } = render(<ProfileScreen token="tok-1" onPasswordChanged={onPasswordChanged} />);
    await screen.findByText('Hồ sơ cá nhân');

    fillChangePasswordForm();
    await screen.findByText('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
    unmount();

    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(onPasswordChanged).not.toHaveBeenCalled();
  }, 15000);

  it('400 with use-case fieldErrors: renders the per-field message', async () => {
    jest.spyOn(client, 'fetchProfile').mockResolvedValue(profileFixture);
    jest.spyOn(client, 'changePasswordRequest').mockRejectedValueOnce(
      new client.LoginError('Đổi mật khẩu thất bại', 400, undefined, { currentPassword: ['Mật khẩu hiện tại không đúng'] }),
    );
    render(<ProfileScreen token="tok-1" />);
    await screen.findByText('Hồ sơ cá nhân');

    fillChangePasswordForm('WrongPass1');

    expect(await screen.findByText('Mật khẩu hiện tại không đúng')).toBeTruthy();
    expect(screen.getByText('Đổi mật khẩu thất bại')).toBeTruthy();
  });

  it('double-submit guard: pressing change password twice while busy calls the API once', async () => {
    jest.spyOn(client, 'fetchProfile').mockResolvedValue(profileFixture);
    let resolveChange!: (value: { message: string; reauthRequired: boolean }) => void;
    const pending = new Promise<{ message: string; reauthRequired: boolean }>((resolve) => { resolveChange = resolve; });
    const changeSpy = jest.spyOn(client, 'changePasswordRequest').mockImplementation(() => pending);
    const onPasswordChanged = jest.fn();
    const { unmount } = render(<ProfileScreen token="tok-1" onPasswordChanged={onPasswordChanged} />);
    await screen.findByText('Hồ sơ cá nhân');

    fillChangePasswordForm();
    fireEvent.press(screen.getByLabelText('change password'));

    expect(changeSpy).toHaveBeenCalledTimes(1);
    await act(async () => { resolveChange({ message: 'Đổi mật khẩu thành công', reauthRequired: true }); });
    expect(await screen.findByText('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.')).toBeTruthy();
    expect(changeSpy).toHaveBeenCalledTimes(1);
    unmount();
  }, 15000);
});
