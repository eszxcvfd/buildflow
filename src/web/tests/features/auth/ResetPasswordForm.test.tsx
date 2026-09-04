/**
 * Tests cho ResetPasswordForm + page structure (IAM-SRS-007, GitHub issue #22).
 * - Page (auth)/reset-password bọc form trong <Suspense> (fix P1 build: useSearchParams CSR bailout).
 * - Đọc token từ searchParams; submit gọi confirmPasswordReset(token, newPassword, confirmPassword).
 * - Policy hint hiển thị TRƯỚC khi submit; fieldErrors từ server render theo field.
 * - Thành công → redirect /login?reason=password-reset.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm';
import { POLICY_HINT } from '@/features/auth/components/ResetPasswordForm';
import * as passwordApi from '@/lib/api/password';

jest.mock('@/lib/api/password', () => ({
  __esModule: true,
  confirmPasswordReset: jest.fn(),
}));

let searchToken: string | null = 'reset-tok-123';
const replaceMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? searchToken : null),
  }),
}));

const confirmMock = jest.spyOn(passwordApi, 'confirmPasswordReset');

function fillAndSubmit(next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText(/^mật khẩu mới$/i), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(/xác nhận mật khẩu mới/i), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: /đặt lại mật khẩu/i }));
}

describe('ResetPasswordForm (IAM-SRS-007)', () => {
  beforeEach(() => {
    searchToken = 'reset-tok-123';
    replaceMock.mockClear();
    confirmMock.mockReset();
  });

  afterEach(cleanup);

  it('policy hint hiển thị TRƯỚC khi submit', async () => {
    render(<ResetPasswordForm />);
    expect(await screen.findByText(POLICY_HINT)).toBeTruthy();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('đọc token từ searchParams; submit gọi confirmPasswordReset(token, newPassword, confirmPassword)', async () => {
    render(<ResetPasswordForm />);
    await screen.findByLabelText(/^mật khẩu mới$/i);
    fillAndSubmit('NewPass1', 'NewPass1');
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith('reset-tok-123', 'NewPass1', 'NewPass1'));
  });

  it('thành công → redirect /login?reason=password-reset', async () => {
    confirmMock.mockResolvedValueOnce({ message: 'OK', reauthRequired: true });
    render(<ResetPasswordForm />);
    await screen.findByLabelText(/^mật khẩu mới$/i);
    fillAndSubmit('NewPass1', 'NewPass1');
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login?reason=password-reset'));
    expect(await screen.findByText(/đổi mật khẩu thành công/i)).toBeTruthy();
  });

  it('confirm mismatch → field error, không gọi API', async () => {
    render(<ResetPasswordForm />);
    await screen.findByLabelText(/^mật khẩu mới$/i);
    fillAndSubmit('NewPass1', 'Other1');
    expect(await screen.findByText('Xác nhận mật khẩu không khớp')).toBeTruthy();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('400 fieldErrors từ server → render theo field dưới input', async () => {
    confirmMock.mockRejectedValueOnce(
      Object.assign(new Error('Dữ liệu không hợp lệ'), { status: 400, fieldErrors: { confirmPassword: ['Xác nhận mật khẩu không khớp'] } }),
    );
    render(<ResetPasswordForm />);
    await screen.findByLabelText(/^mật khẩu mới$/i);
    fillAndSubmit('NewPass1', 'NewPass1');
    expect(await screen.findByText('Xác nhận mật khẩu không khớp')).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('401 token invalid/used/expired → hiện message lỗi, không redirect về /login', async () => {
    confirmMock.mockRejectedValueOnce(Object.assign(new Error('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'), { status: 401 }));
    render(<ResetPasswordForm />);
    await screen.findByLabelText(/^mật khẩu mới$/i);
    fillAndSubmit('NewPass1', 'NewPass1');
    expect(await screen.findByText('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn')).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('không có token trong URL → cảnh báo + disable nút, không gọi API', async () => {
    searchToken = null;
    render(<ResetPasswordForm />);
    expect(await screen.findByText(/link không chứa token đặt lại/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /đặt lại mật khẩu/i }) as HTMLButtonElement).disabled).toBe(true);
    fillAndSubmit('NewPass1', 'NewPass1');
    expect(confirmMock).not.toHaveBeenCalled();
  });
});

describe('reset-password page structure (P1 build regression guard)', () => {
  it('page bọc ResetPasswordForm trong <Suspense> (useSearchParams CSR bailout)', async () => {
    const fs = await import('fs');
    expect(fs.existsSync('src/app/(auth)/reset-password/page.tsx')).toBe(true);
    const page = fs.readFileSync('src/app/(auth)/reset-password/page.tsx', 'utf8');
    expect(page).toMatch(/Suspense/);
    expect(page).toMatch(/ResetPasswordForm/);
    const form = fs.readFileSync('src/features/auth/components/ResetPasswordForm.tsx', 'utf8');
    expect(form).toMatch(/useSearchParams/);
    expect(form).toMatch(/confirmPasswordReset/);
  });
});
