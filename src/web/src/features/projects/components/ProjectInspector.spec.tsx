import { render, screen, waitFor } from '@testing-library/react';
import { ProjectInspector } from './ProjectInspector';
import { getProject, listProjectAreas, listProjectMembers } from '@/lib/api/projects';

jest.mock('@/lib/api/projects', () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  changeProjectStatus: jest.fn(),
  listProjectAreas: jest.fn(),
  listProjectMembers: jest.fn(),
}));
jest.mock('@/lib/auth/roles', () => {
  const actual = jest.requireActual('@/lib/auth/roles');
  return { ...actual, useCanManageProjects: jest.fn(() => true) };
});

const PROJECT = {
  id: 'prt',
  code: 'PRT',
  name: 'Khu dan cu T',
  status: 'ACTIVE',
  managerId: 'm-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (getProject as jest.Mock).mockResolvedValue(PROJECT);
  (listProjectMembers as jest.Mock).mockResolvedValue({
    data: [
      {
        id: 'mb-1', userId: 'u-qt', userName: 'Tran Quoc Dieu', userCode: null,
        projectRole: 'MANAGER', joinedAt: '2026-01-02T00:00:00.000Z', leftAt: null,
        isActive: true, addedBy: 'u-ha', createdAt: '2026-01-02T00:00:00.000Z',
      },
    ],
    total: 1,
  });
  (listProjectAreas as jest.Mock).mockResolvedValue({ data: [], total: 0 });
});

describe('ProjectInspector', () => {
  it('fetch on select: header code + tên + link chi tiết, không reload', async () => {
    render(<ProjectInspector projectId="prt" onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('project-inspector')).not.toBeNull());
    expect(getProject).toHaveBeenCalledWith('prt');
    expect(screen.getByRole('heading', { name: 'Khu dan cu T' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Mở trang chi tiết dự án' }).getAttribute('href')).toBe('/projects/prt');
    expect(screen.getByRole('link', { name: /Chi tiết dự án/ }).getAttribute('href')).toBe('/projects/prt');
    expect(screen.getByRole('link', { name: /Công việc/ }).getAttribute('href')).toBe('/work-orders?projectId=prt');
  });

  it('chỉ huy trưởng từ members MANAGER; ô không-data là —', async () => {
    render(<ProjectInspector projectId="prt" onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Tran Quoc Dieu')).not.toBeNull());
    // Ngân sách / thanh toán / nhân công: placeholder trung thực.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Chưa có nhật ký hiện trường')).not.toBeNull();
  });

  it('members fail → chỉ huy trưởng —, không crash', async () => {
    (listProjectMembers as jest.Mock).mockRejectedValue({ status: 403, message: 'deny' });
    render(<ProjectInspector projectId="prt" onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Khu dan cu T' })).not.toBeNull());
    await waitFor(() => expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3));
  });

  it('không fetch khi unmount / đổi id (stale guard)', async () => {
    let resolveGet!: (v: typeof PROJECT) => void;
    (getProject as jest.Mock).mockImplementation(() => new Promise((r) => { resolveGet = r; }));
    const { unmount } = render(<ProjectInspector projectId="prt" onClose={jest.fn()} onChanged={jest.fn()} />);
    unmount();
    resolveGet(PROJECT);
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('project-inspector')).toBeNull();
  });

  it('F001: row Địa chỉ — + title trung thực', async () => {
    render(<ProjectInspector projectId="prt" onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Địa chỉ:')).not.toBeNull());
    const addr = screen.getByTitle('Chưa có dữ liệu địa chỉ');
    expect(addr.textContent).toBe('—');
  });

  it('F003: members pending → Đang tải… (aria-busy)', async () => {
    (listProjectMembers as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<ProjectInspector projectId="prt" onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Khu dan cu T' })).not.toBeNull());
    const pending = screen.getByText('Đang tải…');
    expect(pending.getAttribute('aria-busy')).toBe('true');
  });

  it('F003: userName null → — + title=userId (không render UUID như tên)', async () => {
    (listProjectMembers as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'mb-1', userId: 'u-uuid-no-name', userName: null, userCode: null,
          projectRole: 'MANAGER', joinedAt: '2026-01-02T00:00:00.000Z', leftAt: null,
          isActive: true, addedBy: 'u-ha', createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      total: 1,
    });
    render(<ProjectInspector projectId="prt" onClose={jest.fn()} onChanged={jest.fn()} />);
    await waitFor(() => expect(screen.getByTitle('u-uuid-no-name')).not.toBeNull());
    expect(screen.getByTitle('u-uuid-no-name').textContent).toBe('—');
    expect(screen.queryByText('u-uuid-no-name')).toBeNull();
  });

  it('F012: refreshSeq bump → refetch getProject (hết stale-after-edit)', async () => {
    const { rerender } = render(
      <ProjectInspector projectId="prt" refreshSeq={0} onClose={jest.fn()} onChanged={jest.fn()} />,
    );
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Khu dan cu T' })).not.toBeNull());
    expect(getProject).toHaveBeenCalledTimes(1);
    rerender(
      <ProjectInspector projectId="prt" refreshSeq={1} onClose={jest.fn()} onChanged={jest.fn()} />,
    );
    await waitFor(() => expect(getProject).toHaveBeenCalledTimes(2));
  });
});
