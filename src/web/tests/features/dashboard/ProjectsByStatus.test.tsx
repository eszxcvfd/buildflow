import * as React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { ProjectsByStatus } from '@/features/dashboard';

jest.mock('@/lib/api/projects', () => ({
  __esModule: true,
  listProjects: jest.fn(),
}));

import { listProjects, type Project } from '@/lib/api/projects';

const listMock = listProjects as jest.Mock;

function project(id: string, status: string): Project {
  return {
    id,
    code: id.toUpperCase(),
    name: `Dự án ${id}`,
    status,
    managerId: 'm1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ProjectsByStatus (dashboard)', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  afterEach(cleanup);

  it('renders one bar per status with counts and total', async () => {
    listMock.mockResolvedValueOnce([project('p1', 'ACTIVE'), project('p2', 'ACTIVE'), project('p3', 'DRAFT')]);
    const { container } = render(<ProjectsByStatus />);

    expect(await screen.findByText('Đang chạy')).toBeTruthy();
    expect(screen.getByText('Nháp')).toBeTruthy();
    expect(screen.getByText('Tổng 3 dự án')).toBeTruthy();
    expect(container.querySelectorAll('.bf-dash-status-row')).toHaveLength(2);
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('animates top-status fill to 100% after mount', async () => {
    listMock.mockResolvedValueOnce([project('p1', 'ACTIVE'), project('p2', 'ACTIVE'), project('p3', 'DRAFT')]);
    const { container } = render(<ProjectsByStatus />);
    await screen.findByText('Đang chạy');

    const fills = container.querySelectorAll<HTMLElement>('.bf-dash-status-fill');
    await waitFor(() => {
      expect(fills[0].style.width).toBe('100%');
      expect(fills[1].style.width).toBe('50%');
    });
  });

  it('shows empty state when there is no project', async () => {
    listMock.mockResolvedValueOnce([]);
    render(<ProjectsByStatus />);
    expect(await screen.findByText('Chưa có dự án nào')).toBeTruthy();
    expect(screen.getByText('Tạo dự án đầu tiên để xem tiến độ ở đây.')).toBeTruthy();
  });

  it('shows error message without crashing the widget', async () => {
    listMock.mockRejectedValueOnce({ status: 500, message: 'Tải danh sách dự án thất bại (500)' });
    render(<ProjectsByStatus />);
    expect(
      await screen.findByText(/Không tải được dữ liệu — Tải danh sách dự án thất bại \(500\)/),
    ).toBeTruthy();
  });
});
