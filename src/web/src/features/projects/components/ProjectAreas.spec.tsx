import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectAreas } from './ProjectAreas';
import { listProjectAreas, createProjectArea, updateProjectArea } from '@/lib/api/projects';
import { useCanManageProjects } from '@/lib/auth/roles';

jest.mock('@/lib/api/projects', () => ({
  listProjects: jest.fn(),
  getProject: jest.fn(),
  createProject: jest.fn(),
  updateProject: jest.fn(),
  changeProjectStatus: jest.fn(),
  listProjectMembers: jest.fn(),
  addProjectMember: jest.fn(),
  removeProjectMember: jest.fn(),
  ADDABLE_PROJECT_MEMBER_ROLES: ['COORDINATOR', 'QC', 'WORKER', 'VIEWER'],
  listProjectAreas: jest.fn(),
  createProjectArea: jest.fn(),
  updateProjectArea: jest.fn(),
}));
jest.mock('@/lib/auth/roles', () => {
  const actual = jest.requireActual('@/lib/auth/roles');
  return { ...actual, useCanManageProjects: jest.fn(() => true) };
});

const listAreasMock = listProjectAreas as jest.Mock;
const createAreaMock = createProjectArea as jest.Mock;
const updateAreaMock = updateProjectArea as jest.Mock;
const canManageMock = useCanManageProjects as jest.Mock;

const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const AREA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function area(overrides = {}) {
  return {
    id: AREA_ID,
    projectId: PROJECT_ID,
    code: 'T1-A',
    name: 'Tang 1 — Khu A',
    isActive: true,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  canManageMock.mockReturnValue(true);
  listAreasMock.mockResolvedValue({ data: [area()], total: 1 });
});

describe('ProjectAreas PRJ-SRS-003 (issue #34)', () => {
  it('render danh sách: tên + mã + không badge ngừng sử dụng khi active', async () => {
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Tang 1 — Khu A')).not.toBeNull());
    expect(screen.getByText('T1-A')).not.toBeNull();
    // Badge 'Ngừng sử dụng' là span — nút cùng tên vẫn hiện cho hàng active.
    expect(screen.queryByText('Ngừng sử dụng', { selector: 'span' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ngừng sử dụng' })).not.toBeNull();
    expect(listAreasMock).toHaveBeenCalledWith(PROJECT_ID, {});
  });

  it('inactive: badge Ngừng sử dụng + hàng xám, có nút Kích hoạt lại', async () => {
    listAreasMock.mockResolvedValue({ data: [area({ isActive: false })], total: 1 });
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Ngừng sử dụng')).not.toBeNull());
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Ngừng sử dụng' })).toBeNull();
  });

  it('empty state khi chưa có khu vực', async () => {
    listAreasMock.mockResolvedValue({ data: [], total: 0 });
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText(/Chưa có khu vực/)).not.toBeNull());
  });

  it('lỗi fetch có nút Thử lại; retry gọi lại API', async () => {
    listAreasMock.mockRejectedValueOnce({ status: 500, message: 'Lỗi máy chủ' });
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Thử lại' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(listAreasMock).toHaveBeenCalledTimes(2));
  });

  it('toggle activeOnly gọi list với { activeOnly: true }', async () => {
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(listAreasMock).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByLabelText('Chỉ hiện khu vực đang sử dụng'));
    await waitFor(() =>
      expect(listAreasMock).toHaveBeenCalledWith(PROJECT_ID, { activeOnly: true }),
    );
  });

  it('thêm thành công gọi createProjectArea + báo thành công', async () => {
    createAreaMock.mockResolvedValue(area({ id: 'b-2', name: 'Khu B', code: null }));
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Tang 1 — Khu A')).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Tên khu vực'), { target: { value: 'Khu B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm khu vực' }));
    await waitFor(() =>
      expect(createAreaMock).toHaveBeenCalledWith(PROJECT_ID, { name: 'Khu B' }),
    );
    await waitFor(() => expect(screen.getByText(/Đã thêm khu vực/)).not.toBeNull());
  });

  it('trùng tên 409 AREA_DUPLICATE → lỗi theo field name', async () => {
    createAreaMock.mockRejectedValue({
      status: 409,
      code: 'AREA_DUPLICATE',
      message: 'Tên khu vực đã tồn tại trong dự án',
      fieldErrors: { name: ['Tên khu vực đã tồn tại trong dự án'] },
    });
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Tang 1 — Khu A')).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Tên khu vực'), { target: { value: 'Tang 1 — Khu A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm khu vực' }));
    await waitFor(() =>
      expect(screen.getByText('Tên khu vực đã tồn tại trong dự án')).not.toBeNull(),
    );
  });

  it('validate client: tên trống thì nút submit disable', async () => {
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Tang 1 — Khu A')).not.toBeNull());
    expect(screen.getByRole('button', { name: 'Thêm khu vực' }).hasAttribute('disabled')).toBe(true);
    expect(createAreaMock).not.toHaveBeenCalled();
  });

  it('ngừng sử dụng: confirm + reason optional, alreadyInactive → notice info', async () => {
    updateAreaMock.mockResolvedValue({ ...area(), isActive: false, alreadyInactive: true });
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Tang 1 — Khu A')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng sử dụng' }));
    expect(screen.getByRole('dialog')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ngừng sử dụng' }));
    await waitFor(() =>
      expect(updateAreaMock).toHaveBeenCalledWith(PROJECT_ID, AREA_ID, { isActive: false, reason: null }),
    );
    await waitFor(() => expect(screen.getByText(/đã ngừng sử dụng trước đó/)).not.toBeNull());
  });

  it('ngừng sử dụng: warning kèm usage.workOrders → notice info có số work order (PRJ-SRS-007 #38)', async () => {
    updateAreaMock.mockResolvedValue({
      ...area(),
      isActive: false,
      alreadyInactive: false,
      usage: { workOrders: 2 },
      warning: 'Khu vực đang được tham chiếu bởi work order đang hiệu lực',
    });
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Tang 1 — Khu A')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng sử dụng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ngừng sử dụng' }));
    await waitFor(() =>
      expect(updateAreaMock).toHaveBeenCalledWith(PROJECT_ID, AREA_ID, { isActive: false, reason: null }),
    );
    await waitFor(() =>
      expect(screen.getByText(/đang có 2 work order đang hiệu lực/)).not.toBeNull(),
    );
  });

  it('ngừng sử dụng: reason đã nhập được gửi kèm (optional, vào audit)', async () => {
    updateAreaMock.mockResolvedValue({ ...area(), isActive: false, alreadyInactive: false });
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Tang 1 — Khu A')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng sử dụng' }));
    fireEvent.change(screen.getByLabelText('Lý do (không bắt buộc)'), {
      target: { value: 'Gộp khu A vào khu B' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận ngừng sử dụng' }));
    await waitFor(() =>
      expect(updateAreaMock).toHaveBeenCalledWith(PROJECT_ID, AREA_ID, {
        isActive: false,
        reason: 'Gộp khu A vào khu B',
      }),
    );
    await waitFor(() => expect(screen.getByText(/Đã ngừng sử dụng khu vực/)).not.toBeNull());
  });
  it('đổi tên inline: Lưu gọi updateProjectArea với name mới', async () => {
    updateAreaMock.mockResolvedValue({ ...area(), name: 'Tang 1 — Khu A mới', alreadyInactive: false });
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Tang 1 — Khu A')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên' }));
    // Form tạo vẫn render song song → scope vào input inline qua selector id.
    fireEvent.change(
      screen.getByLabelText('Tên khu vực', { selector: `input#area-edit-name-${AREA_ID}` }),
      { target: { value: 'Tang 1 — Khu A mới' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(updateAreaMock).toHaveBeenCalledWith(PROJECT_ID, AREA_ID, {
        name: 'Tang 1 — Khu A mới',
        code: 'T1-A',
      }),
    );
  });

  it('permission gating: non-manager không thấy form thêm và nút sửa', async () => {
    canManageMock.mockReturnValue(false);
    render(<ProjectAreas projectId={PROJECT_ID} />);
    await waitFor(() => expect(screen.getByText('Tang 1 — Khu A')).not.toBeNull());
    expect(screen.queryByLabelText('Tên khu vực')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Đổi tên' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ngừng sử dụng' })).toBeNull();
    expect(screen.getByText(/Chỉ ADMIN và PROJECT_MANAGER/)).not.toBeNull();
  });
});
