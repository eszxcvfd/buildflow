/**
 * Tests cho trang forgot-password (IAM-SRS-007 anti-enumeration, GitHub issue #22).
 * - Submit LUÔN chỉ hiện message generic, bất kể response thế nào.
 * - Response dính key resetUrl/devResetUrl (phòng hờ backend regression) → KHÔNG render link nào.
 * - Có dòng hướng dẫn liên hệ quản trị viên.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ForgotPasswordPage from '@/app/(auth)/forgot-password/page';
import * as passwordApi from '@/lib/api/password';

jest.mock('@/lib/api/password', () => ({
  __esModule: true,
  requestPasswordReset: jest.fn(),
}));

const requestMock = jest.spyOn(passwordApi, 'requestPasswordReset');

const GENERIC = 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.';

function submitEmail(email: string) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: /gửi hướng dẫn đặt lại/i }));
}

describe('ForgotPasswordPage (anti-enumeration IAM-SRS-007)', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  afterEach(cleanup);

  it('submit → hiện message generic + gợi ý liên hệ quản trị viên, không hiện link reset', async () => {
    requestMock.mockResolvedValueOnce({ message: 'OK' });
    render(<ForgotPasswordPage />);
    submitEmail('a@b.com');
    expect(await screen.findByText(GENERIC)).toBeTruthy();
    expect(screen.getByText(/nếu bạn không nhận được email, liên hệ quản trị viên/i)).toBeTruthy();
    expect(requestMock).toHaveBeenCalledWith('a@b.com');
    // Không có anchor nào dẫn đến reset link (done state thay form, mọi anchor reset bị cấm)
    const anchors = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(anchors.filter((h) => h && (/reset|token/i.test(h)))).toEqual([]);
  });

  it('response chứa resetUrl/devResetUrl (phòng hờ) → vẫn KHÔNG render link nào, chỉ message generic', async () => {
    requestMock.mockResolvedValueOnce({
      message: 'OK',
      resetUrl: 'http://localhost:3000/reset-password?token=leaked',
      devResetUrl: 'http://localhost:3000/reset-password?token=leaked',
    } as never);
    render(<ForgotPasswordPage />);
    submitEmail('victim@example.com');
    expect(await screen.findByText(GENERIC)).toBeTruthy();
    expect(document.body.textContent).not.toContain('leaked');
    expect(document.body.textContent).not.toContain('Môi trường demo');
    expect(screen.queryByRole('link', { name: /reset-password/i })).toBeNull();
  });

  it('API lỗi → message lỗi chung, không lộ chi tiết', async () => {
    requestMock.mockRejectedValueOnce(Object.assign(new Error('Gửi yêu cầu thất bại'), { status: 0 }));
    render(<ForgotPasswordPage />);
    submitEmail('a@b.com');
    expect(await screen.findByText('Gửi yêu cầu thất bại, vui lòng thử lại')).toBeTruthy();
    expect(screen.queryByText(GENERIC)).toBeNull();
  });

  it('email rỗng → lỗi client, không gọi API', async () => {
    render(<ForgotPasswordPage />);
    fireEvent.click(screen.getByRole('button', { name: /gửi hướng dẫn đặt lại/i }));
    expect(await screen.findByText('Email không được để trống')).toBeTruthy();
    expect(requestMock).not.toHaveBeenCalled();
  });
});
