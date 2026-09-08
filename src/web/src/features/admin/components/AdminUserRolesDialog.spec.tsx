import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminUserRolesDialog } from './AdminUserRolesDialog';
import { getUserRoles, assignRoles } from '@/lib/api/admin-roles';
import { listAdminUsers } from '@/lib/api/admin-users';

jest.mock('@/lib/api/admin-roles', () => ({
  getUserRoles: jest.fn(),
  assignRoles: jest.fn(),
}));

jest.mock('@/lib/api/admin-users', () => ({
  listAdminUsers: jest.fn(),
  getAdminUser: jest.fn(),
  createAdminUser: jest.fn(),
  updateAdminUser: jest.fn(),
  updateAdminUserStatus: jest.fn(),
}));

const getUserRolesMock = getUserRoles as jest.Mock;
const assignRolesMock = assignRoles as jest.Mock;
const listAdminUsersMock = listAdminUsers as jest.Mock;

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

beforeEach(() => {
  jest.clearAllMocks();
  listAdminUsersMock.mockResolvedValue({ data: [userA] });
  getUserRolesMock.mockResolvedValue({
    userId: 'u-1',
    roles: [workerRole, adminRole],
    effectivePolicy: 'PERMISSION_EFFECTIVE_NEXT_LOGIN',
  });
  assignRolesMock.mockResolvedValue({
    userId: 'u-1',
    roles: [workerRole],
    beforeRoleIds: ['r1', 'r2'],
    afterRoleIds: ['r1'],
    effectivePolicy: 'PERMISSION_EFFECTIVE_NEXT_LOGIN',
  });
});

describe('AdminUserRolesDialog (CRUD popup, Pinback /admin/users/:id/roles)', () => {
  it('mở dialog → load roles theo id + prefill tên user + email ở header (title Gán vai trò)', async () => {
    render(<AdminUserRolesDialog id="u-1" open onClose={() => {}} />);
    await waitFor(() => expect(getUserRolesMock).toHaveBeenCalledWith('u-1'));
    await waitFor(() => expect(screen.getByText('Gán vai trò')).not.toBeNull());
    expect(await screen.findByText(/Nguyen Van A/)).not.toBeNull();
    expect(screen.getByText(/a@b\.com/)).not.toBeNull();
    expect(screen.getByLabelText('Chọn vai trò WORKER')).not.toBeNull();
  });

  it('bỏ chọn 1 role + Lưu vai trò → PUT assignRoles + đóng dialog + báo onUpdated', async () => {
    const onClose = jest.fn();
    const onUpdated = jest.fn();
    render(<AdminUserRolesDialog id="u-1" open onClose={onClose} onUpdated={onUpdated} />);
    await screen.findByText(/Nguyen Van A/);
    fireEvent.click(screen.getByLabelText('Chọn vai trò ADMIN'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu vai trò' }));
    await waitFor(() => expect(assignRolesMock).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ roleIds: ['r1'] }),
    ));
    expect(onClose).toHaveBeenCalled();
    expect(onUpdated).toHaveBeenCalled();
  });

  it('lỗi từ PUT giữ nguyên trong dialog (không đóng)', async () => {
    const onClose = jest.fn();
    assignRolesMock.mockRejectedValueOnce({ status: 400, message: 'Role không tồn tại hoặc đã ngừng hoạt động: bad' });
    render(<AdminUserRolesDialog id="u-1" open onClose={onClose} />);
    await screen.findByText(/Nguyen Van A/);
    fireEvent.click(screen.getByLabelText('Chọn vai trò ADMIN'));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu vai trò' }));
    await waitFor(() => expect(screen.getByText(/Role không tồn tại/)).not.toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('nút Hủy trong dialog → đóng (không điều hướng, không PUT)', async () => {
    const onClose = jest.fn();
    render(<AdminUserRolesDialog id="u-1" open onClose={onClose} />);
    await screen.findByText(/Nguyen Van A/);
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalled();
    expect(assignRolesMock).not.toHaveBeenCalled();
  });

  it('đóng (open=false) → không render + không load', () => {
    render(<AdminUserRolesDialog id="u-1" open={false} onClose={() => {}} />);
    expect(screen.queryByText('Gán vai trò')).toBeNull();
    expect(getUserRolesMock).not.toHaveBeenCalled();
  });
});
