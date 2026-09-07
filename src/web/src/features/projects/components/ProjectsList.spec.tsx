import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectsList } from './ProjectsList';
import { listProjects } from '@/lib/api/projects';

jest.mock('@/lib/api/projects', () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
}));
jest.mock('@/lib/auth/roles', () => {
  const actual = jest.requireActual('@/lib/auth/roles');
  return { ...actual, useCanManageProjects: jest.fn(() => true) };
});

const listProjectsMock = listProjects as jest.Mock;

function project(i: number, overrides = {}) {
  return {
    id: `p-${i}`,
    code: `PRJ-${String(i).padStart(3, '0')}`,
    name: `Du an ${i}`,
    status: i % 2 === 0 ? 'ACTIVE' : 'DRAFT',
    managerId: 'm-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProjectsList PRJ-SRS-001 upgrade (issue #32)', () => {
  it('hiển thị loading rồi rows kèm link chi tiết', async () => {
    listProjectsMock.mockResolvedValue([project(1), project(2)]);
    render(<ProjectsList />);
    expect(screen.getByText('Đang tải…')).not.toBeNull();
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
    const link = screen.getByRole('link', { name: /Du an 1/ });
    expect(link.getAttribute('href')).toBe('/projects/p-1');
  });

  it('lọc theo search text (tên/mã)', async () => {
    listProjectsMock.mockResolvedValue([project(1), project(2), project(3)]);
    render(<ProjectsList />);
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'PRJ-002' } });
    await waitFor(() => expect(screen.queryByText('Du an 1')).toBeNull());
    expect(screen.getByText('Du an 2')).not.toBeNull();
  });

  it('lọc theo status', async () => {
    listProjectsMock.mockResolvedValue([project(1), project(2)]);
    render(<ProjectsList />);
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACTIVE' } });
    await waitFor(() => expect(screen.queryByText('Du an 1')).toBeNull());
    expect(screen.getByText('Du an 2')).not.toBeNull();
  });

  it('phân trang 20/trang với tổng số + Prev/Next', async () => {
    const many = Array.from({ length: 25 }, (_, i) => project(i + 1));
    listProjectsMock.mockResolvedValue(many);
    render(<ProjectsList />);
    await waitFor(() => expect(screen.getByText(/Tổng 25 dự án/)).not.toBeNull());
    expect(screen.getByText(/Trang 1\/2/)).not.toBeNull();
    expect(screen.queryByText('Du an 25')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await waitFor(() => expect(screen.getByText('Du an 25')).not.toBeNull());
    expect(screen.getByText(/Trang 2\/2/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trước' }));
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
  });

  it('CTA Tạo dự án dẫn tới /projects/new', async () => {
    listProjectsMock.mockResolvedValue([project(1)]);
    render(<ProjectsList />);
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
    const cta = screen.getByRole('link', { name: 'Tạo dự án' });
    expect(cta.getAttribute('href')).toBe('/projects/new');
  });

  it('empty khi không có dự án và không có filter giữ copy cũ', async () => {
    listProjectsMock.mockResolvedValue([]);
    render(<ProjectsList />);
    await waitFor(() => expect(screen.getByText('Bạn chưa là thành viên dự án nào')).not.toBeNull());
  });

  it('403 giữ permission card + retry', async () => {
    listProjectsMock.mockRejectedValue({ status: 403, message: 'Forbidden' });
    render(<ProjectsList />);
    await waitFor(() => expect(screen.getByText('Bạn không có quyền xem dự án')).not.toBeNull());
    listProjectsMock.mockResolvedValue([project(1)]);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
  });
});
