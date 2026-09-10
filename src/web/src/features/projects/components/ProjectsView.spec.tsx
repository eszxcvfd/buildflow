import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProjectsView } from './ProjectsView';
import { listProjectAreas, listProjectMembers, listProjects, getProject } from '@/lib/api/projects';

jest.mock('@/lib/api/projects', () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  changeProjectStatus: jest.fn(),
  listProjectAreas: jest.fn(),
  listProjectMembers: jest.fn(),
}));
jest.mock('@/lib/api/workers', () => ({ listWorkers: jest.fn().mockResolvedValue({ data: [] }) }));
jest.mock('@/lib/auth/roles', () => {
  const actual = jest.requireActual('@/lib/auth/roles');
  return { ...actual, useCanManageProjects: jest.fn(() => true) };
});
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), refresh: jest.fn() }),
}));

const listProjectsMock = listProjects as jest.Mock;
const getProjectMock = getProject as jest.Mock;

function fixture() {
  const base = { managerId: 'm-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z' };
  return [
    { id: 'pra', code: 'PRA', name: 'Trung tam A', status: 'ACTIVE', ...base },
    { id: 'prb', code: 'PRB', name: 'Chung cu B', status: 'ACTIVE', ...base },
    { id: 'prc', code: 'PRC', name: 'Nha may C', status: 'DRAFT', ...base },
    { id: 'prd', code: 'PRD', name: 'Benh vien D', status: 'ACTIVE', ...base },
    { id: 'prt', code: 'PRT', name: 'Khu dan cu T', status: 'ACTIVE', ...base },
  ];
}

beforeEach(() => {
  jest.clearAllMocks();
  // useViewMode doc ?view=kanban tu URL (kanban test dung replaceState) —
  // reset de moi test bat dau tu table view, tranh nhieu loan test-order.
  window.history.replaceState(null, '', '/');
  listProjectsMock.mockResolvedValue(fixture());
  (listProjectAreas as jest.Mock).mockRejectedValue({ status: 500, message: 'no areas' });
  (listProjectMembers as jest.Mock).mockResolvedValue({ data: [], total: 0 });
});

describe('ProjectsView workspace', () => {
  it('metric strip đếm đúng từ fixture 5 projects', async () => {
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText('Trung tam A')).not.toBeNull());
    expect(screen.getByTestId('projects-metric-total').textContent).toMatch(/05/);
    expect(screen.getByTestId('projects-metric-active').textContent).toMatch(/04/);
    // Hai ô phải là placeholder trung thực.
    expect(screen.getByTestId('projects-metric-budget').textContent).toMatch(/Chưa có dữ liệu ngân sách/);
    expect(screen.getByTestId('projects-metric-delay').textContent).toMatch(/Chưa có dữ liệu tiến độ/);
  });

  it('tabs đổi filter + count; search và select giữ id driver', async () => {
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText('Trung tam A')).not.toBeNull());
    fireEvent.click(screen.getByRole('tab', { name: /Bản nháp/ }));
    await waitFor(() => expect(screen.queryByText('Trung tam A')).toBeNull());
    expect(screen.getByText('Nha may C')).not.toBeNull();
    // Trở lại Tất cả rồi lọc bằng search.
    fireEvent.click(screen.getByRole('tab', { name: /Tất cả/ }));
    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'PRB' } });
    await waitFor(() => expect(screen.queryByText('Trung tam A')).toBeNull());
    expect(screen.getByText('Chung cu B')).not.toBeNull();
    // Giữ hooks cho E2E driver: #projects-search + projects-status combobox.
    expect(document.getElementById('projects-search')).not.toBeNull();
    expect(screen.getByRole('combobox', { name: 'Trạng thái' })).not.toBeNull();
    // NOTE: không mở combobox trong jsdom — mở Ark Select treo vô hạn ở
    // cả baseline 8ca03f5 (đã chứng minh qua worktree /tmp/bf-baseline),
    // nên tương tác option do tabs + search đại diện; Select wrapper giữ
    // nguyên và E2E driver thật vẫn dùng được.
  });

  it('click row → Inspector render không reload (fetch on select)', async () => {
    const p = fixture()[4];
    getProjectMock.mockResolvedValue(p);
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText('Khu dan cu T')).not.toBeNull());
    expect(screen.queryByTestId('project-inspector')).toBeNull();
    fireEvent.click(screen.getByText('Khu dan cu T'));
    await waitFor(() => expect(screen.getByTestId('project-inspector')).not.toBeNull());
    expect(getProjectMock).toHaveBeenCalledWith('prt');
    // External-link tới /projects/:id, không router.push.
    expect(screen.getByRole('link', { name: 'Mở trang chi tiết dự án' }).getAttribute('href')).toBe('/projects/prt');
    // Nhật ký hiện trường empty-state trung thực.
    expect(screen.getByText('Chưa có nhật ký hiện trường')).not.toBeNull();
  });

  it('sang kanban → xóa selection + ẩn Inspector', async () => {
    const p = fixture()[4];
    getProjectMock.mockResolvedValue(p);
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText('Khu dan cu T')).not.toBeNull());
    fireEvent.click(screen.getByText('Khu dan cu T'));
    await waitFor(() => expect(screen.getByTestId('project-inspector')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }));
    await waitFor(() => expect(screen.queryByTestId('project-inspector')).toBeNull());
    // Kanban render lại cùng tên dưới dạng card chỉ đọc (không còn hàng bảng/inspector).
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('CTA Thêm dự án mở ProjectCreateDialog', async () => {
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText('Trung tam A')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Thêm dự án' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeNull());
  });

  it('F012: mount + select/deselect chỉ fetch list một lần (không double-fetch)', async () => {
    const p = fixture()[4];
    getProjectMock.mockResolvedValue(p);
    render(<ProjectsView />);
    await waitFor(() => expect(screen.getByText('Trung tam A')).not.toBeNull());
    expect(listProjectsMock).toHaveBeenCalledTimes(1);
    const box = screen.getByRole('checkbox', { name: 'Chọn dự án PRT' });
    fireEvent.click(box);
    await waitFor(() => expect(screen.getByTestId('project-inspector')).not.toBeNull());
    fireEvent.click(box);
    await waitFor(() => expect(screen.queryByTestId('project-inspector')).toBeNull());
    expect(listProjectsMock).toHaveBeenCalledTimes(1);
  });
});
