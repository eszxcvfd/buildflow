import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminUserEditDialog } from './AdminUserEditDialog';
import { getAdminUser, updateAdminUser } from '@/lib/api/admin-users';

jest.mock('@/lib/api/admin-users', () => ({
  listAdminUsers: jest.fn(),
  getAdminUser: jest.fn(),
  createAdminUser: jest.fn(),
  updateAdminUser: jest.fn(),
  updateAdminUserStatus: jest.fn(),
}));

const getAdminUserMock = getAdminUser as jest.Mock;
const updateAdminUserMock = updateAdminUser as jest.Mock;

function adminUser(overrides = {}) {
  return {
    id: 'u-1',
    email: 'admin@example.com',
    fullName: 'Admin Mot',
    phone: '0901000001',
    employeeCode: 'AD-001',
    userType: 'STAFF',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getAdminUserMock.mockResolvedValue(adminUser());
  updateAdminUserMock.mockResolvedValue(adminUser());
});

describe('AdminUserEditDialog (CRUD popup, Pinback /admin/users/:id/edit)', () => {
  it('mở dialog → load theo id + prefill giá trị (title Sửa tài khoản)', async () => {
    render(<AdminUserEditDialog id="u-1" open onClose={() => {}} />);
    await waitFor(() => expect(getAdminUserMock).toHaveBeenCalledWith('u-1'));
    await waitFor(() => expect(screen.getByText('Sửa tài khoản')).not.toBeNull());
    expect((screen.getByLabelText('Email *') as HTMLInputElement).value).toBe('admin@example.com');
    expect((screen.getByLabelText('Họ tên *') as HTMLInputElement).value).toBe('Admin Mot');
  });

  it('sửa họ tên + Lưu → PATCH updateAdminUser + đóng dialog + báo onUpdated', async () => {
    const onClose = jest.fn();
    const onUpdated = jest.fn();
    render(<AdminUserEditDialog id="u-1" open onClose={onClose} onUpdated={onUpdated} />);
    await waitFor(() => expect(screen.getByText('Sửa tài khoản')).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Họ tên *'), { target: { value: 'Admin Hai' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updateAdminUserMock).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ fullName: 'Admin Hai' }),
    ));
    expect(onClose).toHaveBeenCalled();
    expect(onUpdated).toHaveBeenCalled();
  });

  it('lỗi per-field từ PATCH giữ nguyên trong dialog (không đóng)', async () => {
    const onClose = jest.fn();
    updateAdminUserMock.mockRejectedValue({
      status: 400,
      message: 'Dữ liệu không hợp lệ',
      fieldErrors: { email: ['Email đã tồn tại'] },
    });
    render(<AdminUserEditDialog id="u-1" open onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Sửa tài khoản')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(screen.getByText('Email đã tồn tại')).not.toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('nút Hủy trong dialog → đóng (không điều hướng)', async () => {
    const onClose = jest.fn();
    render(<AdminUserEditDialog id="u-1" open onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Sửa tài khoản')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onClose).toHaveBeenCalled();
    expect(updateAdminUserMock).not.toHaveBeenCalled();
  });

  it('đóng (open=false) → không render + không load', () => {
    render(<AdminUserEditDialog id="u-1" open={false} onClose={() => {}} />);
    expect(screen.queryByText('Sửa tài khoản')).toBeNull();
    expect(getAdminUserMock).not.toHaveBeenCalled();
  });
});
