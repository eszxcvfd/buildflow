/**
 * Integration-style unit tests cho ProfileForm (IAM-SRS-003)
 * - read-only fields (email, vai trò, trạng thái) render từ profile
 * - 400 fieldErrors hiển thị dưới input
 * - success trên update
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ProfileForm } from '@/features/profile/components/ProfileForm';
import { saveAuth } from '@/lib/auth/storage';
import * as profileApi from '@/lib/api/profile';

jest.mock('@/lib/api/profile', () => ({
  __esModule: true,
  fetchProfile: jest.fn(),
  updateProfile: jest.fn(),
}));

const replaceMock = jest.fn();
const routerMock = { replace: replaceMock, push: jest.fn(), refresh: jest.fn() };
const fetchProfileMock = jest.spyOn(profileApi, 'fetchProfile');
const updateProfileMock = jest.spyOn(profileApi, 'updateProfile');

jest.mock('next/navigation', () => ({
  useRouter: () => routerMock,
}));


const sampleProfile = {
  id: 'u1',
  email: 'a@b.com',
  fullName: 'Nguyen Van A',
  phone: '0901234567',
  avatarUrl: null,
  employeeCode: 'EMP-1',
  userType: 'STAFF',
  contractorId: null,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function saveValidAuth() {
  saveAuth({
    accessToken: 'tok123',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    user: { id: 'u1', email: 'a@b.com', fullName: 'A', status: 'ACTIVE', userType: 'STAFF' },
    roles: [{ id: 'r1', code: 'WORKER', name: 'Worker' }],
    projectIds: ['p1'],
  });
}

describe('ProfileForm (IAM-SRS-003)', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
    routerMock.push.mockClear();
    routerMock.refresh.mockClear();
    fetchProfileMock.mockReset();
    updateProfileMock.mockReset();
  });

  afterEach(cleanup);

  it('renders read-only identity/role/status fields from loaded profile', async () => {
    saveValidAuth();
    fetchProfileMock.mockImplementationOnce(async () => sampleProfile);
    render(<ProfileForm />);

    expect(await screen.findByDisplayValue('a@b.com')).toBeTruthy();
    const email = screen.getByDisplayValue('a@b.com') as HTMLInputElement;
    expect(email.readOnly).toBe(true);
    expect(screen.getByDisplayValue('STAFF')).toBeTruthy();
    expect(screen.getByDisplayValue('ACTIVE')).toBeTruthy();
    expect(screen.getByDisplayValue('Nguyen Van A')).toBeTruthy();
    expect(screen.getByDisplayValue('0901234567')).toBeTruthy();
    expect(fetchProfileMock).toHaveBeenCalledWith('tok123');
  });

  it('shows 400 field errors under the inputs and does not show success', async () => {
    saveValidAuth();
    fetchProfileMock.mockImplementationOnce(async () => sampleProfile);
    render(<ProfileForm />);
    await screen.findByDisplayValue('Nguyen Van A');

    updateProfileMock.mockImplementationOnce(async () => {
      throw {
        status: 400,
        message: 'Dữ liệu không hợp lệ',
        fieldErrors: { fullName: ['Họ tên không được để trống'] },
      };
    });
    fireEvent.change(screen.getByLabelText(/họ tên/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /lưu/i }));

    expect(await screen.findByText('Họ tên không được để trống')).toBeTruthy();
    expect(screen.queryByText('Đã cập nhật hồ sơ thành công')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('shows success alert after a successful update', async () => {
    saveValidAuth();
    fetchProfileMock.mockImplementationOnce(async () => sampleProfile);
    render(<ProfileForm />);
    await screen.findByDisplayValue('Nguyen Van A');

    updateProfileMock.mockImplementationOnce(async () => ({ ...sampleProfile, fullName: 'Nguyen Van B', phone: null }));
    fireEvent.change(screen.getByLabelText(/họ tên/i), { target: { value: 'Nguyen Van B' } });
    fireEvent.change(screen.getByLabelText(/số điện thoại/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /lưu/i }));

    expect(await screen.findByText('Đã cập nhật hồ sơ thành công')).toBeTruthy();
    expect(updateProfileMock).toHaveBeenCalledWith('tok123', { fullName: 'Nguyen Van B', phone: null });
    expect(screen.getByDisplayValue('Nguyen Van B')).toBeTruthy();
  });
});
