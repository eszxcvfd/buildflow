import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import DashboardPage from '@/app/(app)/dashboard/page';

jest.mock('@/lib/auth/storage', () => ({
  __esModule: true,
  getAuth: jest.fn(),
}));

jest.mock('@/lib/api/projects', () => ({
  __esModule: true,
  listProjects: jest.fn(),
}));

jest.mock('@/lib/api/contractors', () => ({
  __esModule: true,
  listContractors: jest.fn(),
}));

jest.mock('@/lib/api/workers', () => ({
  __esModule: true,
  listWorkers: jest.fn(),
}));

jest.mock('@/lib/api/admin-users', () => ({
  __esModule: true,
  listAdminUsers: jest.fn(),
}));

import { getAuth } from '@/lib/auth/storage';
import { listProjects, type Project } from '@/lib/api/projects';
import { listContractors } from '@/lib/api/contractors';
import { listWorkers } from '@/lib/api/workers';
import { listAdminUsers } from '@/lib/api/admin-users';

const getAuthMock = getAuth as jest.Mock;
const listProjectsMock = listProjects as jest.Mock;
const listContractorsMock = listContractors as jest.Mock;
const listWorkersMock = listWorkers as jest.Mock;
const listAdminUsersMock = listAdminUsers as jest.Mock;

function project(id: string, status: string, createdAt: string): Project {
  return {
    id,
    code: id.toUpperCase(),
    name: `Dự án ${id}`,
    status,
    managerId: 'm1',
    createdAt,
    updatedAt: createdAt,
  };
}

const AUTH = {
  accessToken: 'token',
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: { id: 'u1', email: 'a@b.c', fullName: 'Nguyễn Văn A', status: 'ACTIVE', userType: 'STAFF' },
  roles: [],
  projectIds: [],
};

describe('DashboardPage (dashboard)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    getAuthMock.mockReturnValue(AUTH);
    // listProjects được gọi 2 lần độc lập: useProjectsOverview (KPI + bảng) và ProjectsByStatus.
    listProjectsMock.mockResolvedValue([
      project('p1', 'ACTIVE', '2026-03-01T00:00:00.000Z'),
      project('p2', 'ACTIVE', '2026-02-01T00:00:00.000Z'),
      project('p3', 'DRAFT', '2026-01-01T00:00:00.000Z'),
    ]);
    listContractorsMock.mockResolvedValue({ data: [], total: 7, limit: 20, offset: 0 });
    listWorkersMock.mockResolvedValue({ data: [], total: 15, limit: 20, offset: 0 });
    listAdminUsersMock.mockResolvedValue({ data: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }, { id: 'a4' }] });
  });

  afterEach(cleanup);

  it('greets by name and renders 4 independent KPIs plus recent projects', async () => {
    render(<DashboardPage />);

    expect(await screen.findByText(/Xin chào Nguyễn Văn A — hôm nay /)).toBeTruthy();

    // KPI Dự án: tổng + note đang chạy
    expect(await screen.findByText('3')).toBeTruthy();
    expect(screen.getByText('2 đang chạy')).toBeTruthy();
    // KPI Nhà thầu / Công nhân / Tài khoản
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();

    // Bảng dự án gần đây: 3 dòng (1 header + 3 data)
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('Dự án p1')).toBeTruthy();

    // Widget bar chart fetch riêng listProjects
    expect(await screen.findByText('Tổng 3 dự án')).toBeTruthy();
  });

  it('shows dash + admin note when listAdminUsers returns 403, rest of page stays intact', async () => {
    listAdminUsersMock.mockRejectedValue({ status: 403, message: 'Không có quyền' });
    render(<DashboardPage />);

    expect(await screen.findByText('Cần quyền quản trị')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();

    // Các KPI khác vẫn hiển thị bình thường — 1 API lỗi không sập page
    expect(await screen.findByText('7')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(await screen.findByText('Tổng 3 dự án')).toBeTruthy();
  });
});
