import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ProjectsList } from '@/features/projects/components/ProjectsList';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };

jest.mock('next/navigation', () => ({ useRouter: () => routerMock }));

jest.mock('@/lib/api/projects', () => ({
  __esModule: true,
  listProjects: jest.fn(),
  getProject: jest.fn(),
  listProjectAreas: jest.fn(),
}));

import { listProjectAreas } from '@/lib/api/projects';

const areasMock = listProjectAreas as jest.Mock;

function row(overrides = {}) {
  return {
    id: 'p1', code: 'PRA', name: 'Du an A', status: 'ACTIVE', managerId: 'm1',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderList(props = {}) {
  return render(
    <ProjectsList
      rows={[row()]}
      loading={false}
      error={null}
      onRetry={jest.fn()}
      hasFilter={false}
      selectedId={null}
      onSelect={jest.fn()}
      {...props}
    />,
  );
}

describe('ProjectsList (IAM-SRS-006)', () => {
  beforeEach(() => {
    areasMock.mockReset();
    areasMock.mockRejectedValue({ status: 500, message: 'no areas' });
  });

  afterEach(cleanup);

  it('renders member projects in a table with vietnamese status label', async () => {
    renderList();
    expect(await screen.findByText(/Du an A/)).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Đang chạy')).toBeTruthy();
    expect(screen.getByText(/PRA/)).toBeTruthy();
  });

  it('shows empty state when no member projects', async () => {
    renderList({ rows: [] });
    expect(await screen.findByText(/chưa là thành viên dự án nào/)).toBeTruthy();
  });

  it('shows 401 login link on session expiry', async () => {
    renderList({ rows: [], error: { status: 401, message: 'Phiên hết hạn' } });
    expect(await screen.findByText('Phiên hết hạn, vui lòng đăng nhập lại (401)')).toBeTruthy();
  });

  it('shows 403 error with retry', async () => {
    const onRetry = jest.fn();
    renderList({ rows: [], error: { status: 403, message: 'Không có quyền truy cập dự án này' }, onRetry });
    expect(await screen.findByText('Không có quyền truy cập dự án này')).toBeTruthy();
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeTruthy();
  });
});
