import * as React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { RecentProjectsTable, formatViDate } from '@/features/dashboard';
import type { Project } from '@/lib/api/projects';

function project(id: string, name: string, status: string, createdAt: string): Project {
  return {
    id,
    code: id.toUpperCase(),
    name,
    status,
    managerId: 'm1',
    createdAt,
    updatedAt: createdAt,
  };
}

const FIXTURE: Project[] = [
  project('p1', 'Dự án Alpha', 'ACTIVE', '2026-01-01T00:00:00.000Z'),
  project('p2', 'Dự án Beta', 'COMPLETED', '2026-03-01T00:00:00.000Z'),
  project('p3', 'Dự án Gamma', 'DRAFT', '2026-02-01T00:00:00.000Z'),
];

describe('RecentProjectsTable (dashboard)', () => {
  afterEach(cleanup);

  it('renders rows sorted by createdAt desc with status badge and vi-VN date', () => {
    render(<RecentProjectsTable projects={FIXTURE} />);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4); // 1 header + 3 data

    const bodyText = rows
      .slice(1)
      .map((r) => r.textContent ?? '')
      .join('|');
    expect(bodyText.indexOf('Dự án Beta')).toBeGreaterThan(-1);
    expect(bodyText.indexOf('Dự án Beta')).toBeLessThan(bodyText.indexOf('Dự án Gamma'));
    expect(bodyText.indexOf('Dự án Gamma')).toBeLessThan(bodyText.indexOf('Dự án Alpha'));

    expect(screen.getByText('COMPLETED')).toBeTruthy();
    expect(screen.getByText('ACTIVE')).toBeTruthy();
    expect(screen.getByText('DRAFT')).toBeTruthy();
    expect(screen.getByText(formatViDate('2026-01-01T00:00:00.000Z'))).toBeTruthy();
  });

  it('limits to the 5 newest projects and notes the total', () => {
    const six = FIXTURE.concat([
      project('p4', 'Dự án Delta', 'PAUSED', '2026-04-01T00:00:00.000Z'),
      project('p5', 'Dự án Epsilon', 'CLOSED', '2026-05-01T00:00:00.000Z'),
      project('p6', 'Dự án Zeta', 'ACTIVE', '2025-12-01T00:00:00.000Z'),
    ]);
    render(<RecentProjectsTable projects={six} />);

    expect(screen.getAllByRole('row')).toHaveLength(6); // 1 header + 5 data
    expect(screen.getByText('5 mới nhất / 6 dự án')).toBeTruthy();
    expect(screen.queryByText('Dự án Zeta')).toBeNull(); // cũ nhất bị cắt
  });

  it('shows empty state when there is no project', () => {
    render(<RecentProjectsTable projects={[]} />);
    expect(screen.getByText('Chưa có dự án nào')).toBeTruthy();
    expect(screen.getByText('Tạo dự án đầu tiên để xem tiến độ ở đây.')).toBeTruthy();
  });

  it('shows error message instead of fake data', () => {
    render(
      <RecentProjectsTable projects={[]} error={{ status: 500, message: 'Tải danh sách dự án thất bại (500)' }} />,
    );
    expect(screen.getByText(/Không tải được dự án — Tải danh sách dự án thất bại \(500\)/)).toBeTruthy();
    expect(screen.queryByText('Chưa có dự án nào')).toBeNull();
  });
});
