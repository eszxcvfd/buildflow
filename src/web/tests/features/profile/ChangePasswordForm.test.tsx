/**
 * Component tests cho ChangePasswordForm (IAM-SRS-007, GitHub issue #22).
 * - guard auth khi mount: chưa login/token hết hạn → redirect /login?reason=session-expired
 * - mismatch confirm → field error, KHÔNG gọi fetch/API
 * - success → changePassword đúng args (confirmPassword riêng) + clearAuth + redirect /login?reason=password-changed
 * - 400 fieldErrors → render theo field dưới input
 * - 401 (chỉ còn nghĩa là session chết) → clearAuth + redirect login
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ChangePasswordForm } from '@/features/profile/components/ChangePasswordForm';
import { saveAuth, getAuth } from '@/lib/auth/storage';
import * as passwordApi from '@/lib/api/password';

jest.mock('@/lib/api/password', () => ({
  __esModule: true,
  changePassword: jest.fn(),
}));

const replaceMock = jest.fn();
const routerMock = { replace: replaceMock, push: jest.fn(), refresh: jest.fn() };
const changePasswordMock = jest.spyOn(passwordApi, 'changePassword');

jest.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

function saveValidAuth() {
  saveAuth({
    accessToken: 'tok123',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: { id: 'u1', email: 'a@b.com', fullName: 'A', status: 'ACTIVE', userType: 'STAFF' },
    roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
    projectIds: ['p1'],
  });
}

async function fillAndSubmit(opts: { current: string; next: string; confirm: string }) {
  fireEvent.change(screen.getByLabelText(/mật khẩu hiện tại/i), { target: { value: opts.current } });
  fireEvent.change(screen.getByLabelText(/^mật khẩu mới/i), { target: { value: opts.next } });
  fireEvent.change(screen.getByLabelText(/xác nhận mật khẩu mới/i), { target: { value: opts.confirm } });
  fireEvent.click(screen.getByRole('button', { name: /đổi mật khẩu/i }));
}

describe('ChangePasswordForm (IAM-SRS-007)', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
    changePasswordMock.mockReset();
  });

  afterEach(cleanup);

  it('guard: chưa login → redirect /login?reason=session-expired, không render form, không gọi API', async () => {
    render(<ChangePasswordForm />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login?reason=session-expired'));
    expect(screen.queryByLabelText(/mật khẩu hiện tại/i)).toBeNull();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('guard: token hết hạn → redirect /login?reason=session-expired', async () => {
    saveAuth({
      accessToken: 'tok',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      user: { id: 'u1', email: 'a@b.com', fullName: 'A', status: 'ACTIVE', userType: 'STAFF' },
      roles: [],
      projectIds: [],
    });
    render(<ChangePasswordForm />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login?reason=session-expired'));
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('mismatch confirm → field error hiển thị, KHÔNG gọi API', async () => {
    saveValidAuth();
    render(<ChangePasswordForm />);
    await screen.findByLabelText(/mật khẩu hiện tại/i);
    await fillAndSubmit({ current: 'OldPass1', next: 'NewPass1', confirm: 'Other1' });
    expect(await screen.findByText('Xác nhận mật khẩu không khớp')).toBeTruthy();
    expect(changePasswordMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('client validation: mật khẩu mới yếu policy → field error, không gọi API', async () => {
    saveValidAuth();
    render(<ChangePasswordForm />);
    await screen.findByLabelText(/mật khẩu hiện tại/i);
    await fillAndSubmit({ current: 'OldPass1', next: 'short', confirm: 'short' });
    expect(await screen.findByText('Mật khẩu mới tối thiểu 8 ký tự')).toBeTruthy();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('success → changePassword đúng args (confirmPassword riêng) + clearAuth + redirect /login?reason=password-changed', async () => {
    saveValidAuth();
    changePasswordMock.mockResolvedValueOnce({ message: 'Đổi mật khẩu thành công', reauthRequired: true });
    render(<ChangePasswordForm />);
    await screen.findByLabelText(/mật khẩu hiện tại/i);
    await fillAndSubmit({ current: 'OldPass1', next: 'NewPass1', confirm: 'NewPass1' });
    await waitFor(() => expect(changePasswordMock).toHaveBeenCalledWith('tok123', 'OldPass1', 'NewPass1', 'NewPass1'));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login?reason=password-changed'));
    expect(getAuth()).toBeNull(); // clearAuth() đã chạy
  });

  it('400 + fieldErrors → render lỗi theo field dưới input, không redirect', async () => {
    saveValidAuth();
    changePasswordMock.mockRejectedValueOnce(
      Object.assign(new Error('Dữ liệu không hợp lệ'), { status: 400, fieldErrors: { currentPassword: ['Mật khẩu hiện tại không đúng'] } }),
    );
    render(<ChangePasswordForm />);
    await screen.findByLabelText(/mật khẩu hiện tại/i);
    await fillAndSubmit({ current: 'wrong', next: 'NewPass1', confirm: 'NewPass1' });
    expect(await screen.findByText('Mật khẩu hiện tại không đúng')).toBeTruthy();
    expect(screen.getByText('Dữ liệu không hợp lệ')).toBeTruthy(); // global error (Alert role=alert)
    expect(replaceMock).not.toHaveBeenCalled();
    expect(getAuth()).not.toBeNull(); // vẫn giữ session
  });

  it('401 → chỉ còn nghĩa là session chết: clearAuth + redirect /login?reason=password-changed', async () => {
    saveValidAuth();
    changePasswordMock.mockRejectedValueOnce(Object.assign(new Error('Phiên hết hạn, vui lòng đăng nhập lại'), { status: 401 }));
    render(<ChangePasswordForm />);
    await screen.findByLabelText(/mật khẩu hiện tại/i);
    await fillAndSubmit({ current: 'OldPass1', next: 'NewPass1', confirm: 'NewPass1' });
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login?reason=password-changed'));
    expect(getAuth()).toBeNull();
  });
});
