import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ProjectsList } from '@/features/projects/components/ProjectsList';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };

jest.mock('next/navigation', () => ({ useRouter: () => routerMock }));

jest.mock('@/lib/api/projects', () => ({
  __esModule: true,
  listProjects: jest.fn(),
  getProject: jest.fn(),
}));

import { listProjects } from '@/lib/api/projects';

const listMock = listProjects as jest.Mock;

describe('ProjectsList (IAM-SRS-006)', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  afterEach(cleanup);

  it('renders member projects in a table with status badge', async () => {
    listMock.mockResolvedValueOnce([
      { id: 'p1', code: 'PRA', name: 'Du an A', status: 'ACTIVE', managerId: 'm1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ]);
    render(<ProjectsList />);
    expect(await screen.findByText(/Du an A/)).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
    expect(screen.getByText(/PRA/)).toBeTruthy();
  });

  it('shows empty state when no member projects', async () => {
    listMock.mockResolvedValueOnce([]);
    render(<ProjectsList />);
    expect(await screen.findByText(/chưa là thành viên dự án nào/)).toBeTruthy();
  });

  it('shows 401 login link on session expiry', async () => {
    listMock.mockRejectedValueOnce({ status: 401, message: 'Phiên hết hạn' });
    render(<ProjectsList />);
    expect(await screen.findByText('Phiên hết hạn, vui lòng đăng nhập lại (401)')).toBeTruthy();
  });

  it('shows 403 error with retry', async () => {
    listMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền truy cập dự án này' });
    render(<ProjectsList />);
    expect(await screen.findByText('Không có quyền truy cập dự án này')).toBeTruthy();
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeTruthy();
  });
});
