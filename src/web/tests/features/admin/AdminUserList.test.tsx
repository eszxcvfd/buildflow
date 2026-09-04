/**
 * DOM-level tests for AdminUserList (IAM-SRS-004).
 * Covers: loading, list rendering with status, status change flow (confirm -> PATCH -> UI update),
 * 403 permission error, action error surface.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AdminUserList } from '@/features/admin/components/AdminUserList';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

jest.mock('@/lib/api/admin-users', () => ({
  __esModule: true,
  listAdminUsers: jest.fn(),
  updateAdminUserStatus: jest.fn(),
}));

import { listAdminUsers, updateAdminUserStatus } from '@/lib/api/admin-users';

const listMock = listAdminUsers as jest.Mock;
const statusMock = updateAdminUserStatus as jest.Mock;

const userA = {
  id: 'u-1',
  email: 'a@b.com',
  fullName: 'Nguyen Van A',
  phone: null,
  avatarUrl: null,
  employeeCode: 'EMP-1',
  userType: 'STAFF',
  contractorId: null,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const userB = {
  ...userA,
  id: 'u-2',
  email: 'b@b.com',
  fullName: 'Tran Thi B',
  employeeCode: null,
  status: 'LOCKED',
};

describe('AdminUserList (IAM-SRS-004)', () => {
  beforeEach(() => {
    listMock.mockReset();
    statusMock.mockReset();
    routerMock.replace.mockClear();
  });

  afterEach(cleanup);

  it('renders loaded accounts with status and actions', async () => {
    listMock.mockResolvedValueOnce({ data: [userA, userB] });
    render(<AdminUserList />);
    expect(await screen.findByText(/a@b\.com/)).toBeTruthy();
    expect(screen.getByText(/Nguyen Van A/)).toBeTruthy();
    expect(screen.getByText(/Tran Thi B/)).toBeTruthy();
    expect(screen.getAllByText('Bị khóa').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hoạt động').length).toBeGreaterThan(0);
    expect(screen.getByText(/Tổng: 2 tài khoản/)).toBeTruthy();
  });

  it('shows 403 permission error when not admin', async () => {
    listMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' });
    render(<AdminUserList />);
    expect(await screen.findByText('Không có quyền truy cập — cần vai trò ADMIN (403)')).toBeTruthy();
  });

  it('shows 401 with login link when session expired', async () => {
    listMock.mockRejectedValueOnce({ status: 401, message: 'Phiên hết hạn' });
    render(<AdminUserList />);
    expect(await screen.findByText('Phiên hết hạn, vui lòng đăng nhập lại (401)')).toBeTruthy();
  });

  it('lock flow: confirm then PATCH status and update row', async () => {
    listMock.mockResolvedValueOnce({ data: [userA] });
    statusMock.mockResolvedValueOnce({ ...userA, status: 'LOCKED' });
    render(<AdminUserList />);
    await screen.findByText(/a@b\.com/);

    fireEvent.click(screen.getByRole('button', { name: 'Khóa' }));
    expect(await screen.findByText(/Xác nhận khóa tài khoản/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => {
      expect(statusMock).toHaveBeenCalledWith('u-1', { status: 'LOCKED' });
    });
    await waitFor(() => {
      expect(screen.getAllByText('Bị khóa').length).toBeGreaterThan(0);
    });
  });

  it('action failure surfaces error message without corrupting list', async () => {
    listMock.mockResolvedValueOnce({ data: [userA] });
    statusMock.mockRejectedValueOnce({ status: 500, message: 'Lỗi hệ thống' });
    render(<AdminUserList />);
    await screen.findByText(/a@b\.com/);

    fireEvent.click(screen.getByRole('button', { name: 'Khóa' }));
    await screen.findByText(/Xác nhận khóa/);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));

    expect(await screen.findByText('Lỗi hệ thống')).toBeTruthy();
    expect(screen.getByText('a@b.com')).toBeTruthy();
  });
});
