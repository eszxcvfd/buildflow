import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectsList } from './ProjectsList';
import { listProjectAreas } from '@/lib/api/projects';

jest.mock('@/lib/api/projects', () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  listProjectAreas: jest.fn(),
  listProjectMembers: jest.fn(),
  changeProjectStatus: jest.fn(),
}));

const listProjectAreasMock = listProjectAreas as jest.Mock;

function project(i: number, overrides = {}) {
  return {
    id: `p-${i}`,
    code: `PRJ-${String(i).padStart(3, '0')}`,
    name: `Du an ${i}`,
    status: i % 2 === 0 ? 'ACTIVE' : 'DRAFT',
    managerId: 'm-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderList(props = {}) {
  const defaults = {
    rows: [project(1), project(2)],
    loading: false,
    error: null,
    onRetry: jest.fn(),
    hasFilter: false,
    selectedId: null as string | null,
    onSelect: jest.fn(),
  };
  return render(<ProjectsList {...defaults} {...props} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  listProjectAreasMock.mockRejectedValue({ status: 500, message: 'no areas' });
});

describe('ProjectsList web redesign (9-col dense table)', () => {
  it('hiển thị loading rồi rows kèm link chi tiết', async () => {
    const { rerender } = render(
      <ProjectsList rows={[]} loading error={null} onRetry={jest.fn()} hasFilter={false} selectedId={null} onSelect={jest.fn()} />,
    );
    expect(screen.getByText('Đang tải…')).not.toBeNull();
    rerender(
      <ProjectsList rows={[project(1)]} loading={false} error={null} onRetry={jest.fn()} hasFilter={false} selectedId={null} onSelect={jest.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
    const link = screen.getByRole('link', { name: /Mở chi tiết dự án PRJ-001/ });
    expect(link.getAttribute('href')).toBe('/projects/p-1');
  });

  it('render ô thật (mã/tên/trạng thái/subtitle) + placeholder trung thực', async () => {
    renderList();
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
    expect(screen.getByText('PRJ-001')).not.toBeNull();
    // ACTIVE → emerald "Đang chạy" (không dùng StatusBadge cam cũ).
    expect(screen.getByText('Đang chạy')).not.toBeNull();
    expect(screen.getAllByText(/Cập nhật /).length).toBe(2);
    // 4 cột không-data là '—', không literal giả kiểu %/tỷ.
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
    expect(screen.queryByText(/%/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/48\.2|24\.5|80% tải|Sunshine Plaza/);
  });

  it('selected row có aria-selected + checkbox + chevron xanh', async () => {
    const onSelect = jest.fn();
    renderList({ selectedId: 'p-1', onSelect });
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
    const row = screen.getByText('Du an 1').closest('tr');
    expect(row?.getAttribute('aria-selected')).toBe('true');
    expect((screen.getByRole('checkbox', { name: 'Chọn dự án PRJ-001' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByText('Du an 2'));
    expect(onSelect).toHaveBeenCalledWith('p-2');
  });

  it('hạng mục fail → render — thay vì crash', async () => {
    renderList({ rows: [project(1)] });
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
    await waitFor(() => expect(listProjectAreasMock).toHaveBeenCalledWith('p-1'));
    expect(screen.getByTitle('Chưa có dữ liệu hạng mục')).not.toBeNull();
  });

  it('hạng mục thành công → render active/total', async () => {
    listProjectAreasMock.mockResolvedValue({
      data: [
        { id: 'a1', projectId: 'p-1', code: 'KQ-01', name: 'Sảnh', isActive: true, createdAt: '', updatedAt: '' },
        { id: 'a2', projectId: 'p-1', code: 'TM-02', name: 'TM', isActive: false, createdAt: '', updatedAt: '' },
      ],
      total: 2,
    });
    renderList({ rows: [project(1)] });
    await waitFor(() => expect(screen.getByTitle('hạng mục đang hoạt động/tổng')).not.toBeNull());
    expect(screen.getByTitle('hạng mục đang hoạt động/tổng').textContent).toBe('1/2');
  });

  it('F003: hạng mục total===0 → — (không render 0/0)', async () => {
    listProjectAreasMock.mockResolvedValue({ data: [], total: 0 });
    renderList({ rows: [project(1)] });
    await waitFor(() => expect(listProjectAreasMock).toHaveBeenCalledWith('p-1'));
    await waitFor(() => expect(screen.getByTitle('Dự án chưa có hạng mục')).not.toBeNull());
    expect(screen.getByTitle('Dự án chưa có hạng mục').textContent).toBe('—');
  });

  it('phân trang 20/trang với tổng số + Prev/Next', async () => {
    const many = Array.from({ length: 25 }, (_, i) => project(i + 1));
    renderList({ rows: many });
    await waitFor(() => expect(screen.getByText(/Tổng 25 dự án/)).not.toBeNull());
    expect(screen.getByText(/Trang 1\/2/)).not.toBeNull();
    expect(screen.queryByText('Du an 25')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await waitFor(() => expect(screen.getByText('Du an 25')).not.toBeNull());
    expect(screen.getByText(/Trang 2\/2/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Trước' }));
    await waitFor(() => expect(screen.getByText('Du an 1')).not.toBeNull());
  });

  it('empty khi không có dự án và không có filter giữ copy cũ', async () => {
    renderList({ rows: [] });
    await waitFor(() => expect(screen.getByText('Bạn chưa là thành viên dự án nào')).not.toBeNull());
  });

  it('403 giữ permission card + retry', async () => {
    const onRetry = jest.fn();
    renderList({ rows: [], error: { status: 403, message: 'Forbidden' }, onRetry });
    await waitFor(() => expect(screen.getByText('Bạn không có quyền xem dự án')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
