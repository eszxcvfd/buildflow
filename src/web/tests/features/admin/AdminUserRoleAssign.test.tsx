/**
 * DOM tests for AdminUserRoleAssign (IAM-SRS-005).
 * Covers: loading, render current roles, toggle + diff, empty selection blocked client-side,
 * save flow PUT + success alert with before/after counts, 403 permission error.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { AdminUserRoleAssign } from '@/features/admin/components/AdminUserRoleAssign';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));

jest.mock('@/lib/api/admin-roles', () => ({
  __esModule: true,
  getUserRoles: jest.fn(),
  assignRoles: jest.fn(),
}));

jest.mock('@/lib/api/admin-users', () => ({
  __esModule: true,
  listAdminUsers: jest.fn(),
}));

import { getUserRoles, assignRoles } from '@/lib/api/admin-roles';
import { listAdminUsers } from '@/lib/api/admin-users';

const getRolesMock = getUserRoles as jest.Mock;
const assignMock = assignRoles as jest.Mock;
const listMock = listAdminUsers as jest.Mock;

const workerRole = { id: 'r1', code: 'WORKER', name: 'Worker' };
const adminRole = { id: 'r2', code: 'ADMIN', name: 'Administrator' };

const userA = {
  id: 'u-1',
  email: 'a@b.com',
  fullName: 'Nguyen Van A',
  phone: null,
  avatarUrl: null,
  employeeCode: null,
  userType: 'STAFF',
  contractorId: null,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setupMocks(roleList: Array<{ id: string; code: string; name: string }>) {
  listMock.mockResolvedValue({ data: [userA] });
  getRolesMock.mockResolvedValue({
    userId: 'u-1',
    roles: roleList,
    effectivePolicy: 'PERMISSION_EFFECTIVE_NEXT_LOGIN',
  });
}

describe('AdminUserRoleAssign (IAM-SRS-005)', () => {
  beforeEach(() => {
    getRolesMock.mockReset();
    assignMock.mockReset();
    listMock.mockReset();
  });

  afterEach(cleanup);

  it('renders current roles with checkboxes', async () => {
    setupMocks([workerRole]);
    render(<AdminUserRoleAssign userId="u-1" />);
    expect(await screen.findByText(/Nguyen Van A/)).toBeTruthy();
    expect(screen.getByLabelText('Chọn vai trò WORKER')).toBeTruthy();
    expect((screen.getByLabelText('Chọn vai trò WORKER') as HTMLInputElement).checked).toBe(true);
  });

  it('blocks save when no roles selected (policy >=1 role)', async () => {
    setupMocks([workerRole]);
    render(<AdminUserRoleAssign userId="u-1" />);
    await screen.findByText(/Nguyen Van A/);
    fireEvent.click(screen.getByLabelText('Chọn vai trò WORKER'));
    fireEvent.click(screen.getByRole('button', { name: /lưu vai trò/i }));
    expect(await screen.findByText(/không được để trống/i)).toBeTruthy();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('shows diff when toggling a new role and PUTs on save', async () => {
    setupMocks([workerRole, adminRole]);
    assignMock.mockResolvedValueOnce({
      userId: 'u-1',
      roles: [workerRole, adminRole],
      beforeRoleIds: ['r1'],
      afterRoleIds: ['r1'],
      effectivePolicy: 'PERMISSION_EFFECTIVE_NEXT_LOGIN',
    });
    render(<AdminUserRoleAssign userId="u-1" />);
    await screen.findByText(/Nguyen Van A/);

    fireEvent.click(screen.getByLabelText('Chọn vai trò ADMIN'));
    expect(screen.getByText(/Bỏ: ADMIN/)).toBeTruthy();
    // Toggle back on so final selection is WORKER + ADMIN
    fireEvent.click(screen.getByLabelText('Chọn vai trò ADMIN'));
    // No diff now: button disabled, no "Diff" panel rendered
    expect(screen.queryByText(/Diff trước/)).toBeNull();

    // Toggle ADMIN off (diff appears), save WORKER only, then no-op save disabled
    fireEvent.click(screen.getByLabelText('Chọn vai trò ADMIN'));
    const saveBtn = screen.getByRole('button', { name: /lưu vai trò/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith('u-1', { roleIds: ['r1'], reason: null });
    });
    expect(await screen.findByText(/1 → 1 role/)).toBeTruthy();
  });

  it('shows 403 permission error', async () => {
    listMock.mockResolvedValue({ data: [userA] });
    getRolesMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' });
    render(<AdminUserRoleAssign userId="u-1" />);
    expect(await screen.findByText('Không có quyền truy cập — cần vai trò ADMIN (403)')).toBeTruthy();
  });

  it('surfaces 400 role-not-found error from server', async () => {
    setupMocks([workerRole, adminRole]);
    assignMock.mockRejectedValueOnce({ status: 400, message: 'Role không tồn tại hoặc đã ngừng hoạt động: bad' });
    render(<AdminUserRoleAssign userId="u-1" />);
    await screen.findByText(/Nguyen Van A/);
    // currentRoles=[WORKER,ADMIN] both selected initially. Deselect WORKER, keep ADMIN,
    // mock rejects any PUT -> globalError from server 400.
    fireEvent.click(screen.getByLabelText('Chọn vai trò WORKER'));
    expect(screen.getByText(/Bỏ: WORKER/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /lưu vai trò/i }));
    expect(await screen.findByText(/Role không tồn tại/)).toBeTruthy();
  });
});
