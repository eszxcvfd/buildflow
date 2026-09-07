import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectMembers } from './ProjectMembers';
import { listProjectMembers, addProjectMember, removeProjectMember } from '@/lib/api/projects';
import { listWorkers } from '@/lib/api/workers';

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
}));
jest.mock('@/lib/api/workers', () => ({ listWorkers: jest.fn() }));

const listMembersMock = listProjectMembers as jest.Mock;
const addMemberMock = addProjectMember as jest.Mock;
const removeMemberMock = removeProjectMember as jest.Mock;
const listWorkersMock = listWorkers as jest.Mock;

const PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const MANAGER_ID = '99999999-9999-4999-8999-999999999999';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function member(overrides = {}) {
  return {
    id: MEMBER_ID,
    userId: USER_ID,
    userName: 'Nguyen Van M',
    userCode: 'NV-002',
    projectRole: 'WORKER',
    joinedAt: '2026-02-01T08:00:00.000Z',
    leftAt: null,
    isActive: true,
    addedBy: 'u-admin',
    createdAt: '2026-02-01T08:00:00.000Z',
    ...overrides,
  };
}

function worker(overrides = {}) {
  return {
    id: USER_ID,
    email: 'moi@example.com',
    fullName: 'Tran Thi Moi',
    phone: null,
    avatarUrl: null,
    employeeCode: 'NV-009',
    userType: 'WORKER',
    contractorId: null,
    status: 'ACTIVE',
    trades: [],
    eligible: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  listMembersMock.mockResolvedValue({ data: [member()], total: 1 });
  listWorkersMock.mockResolvedValue({ data: [worker()], total: 1, limit: 100, offset: 0 });
});

/**
 * Ark Select interaction: open the labelled combobox, then choose the option.
 * Replaces native fireEvent.change on <select>.
 */
async function chooseOption(comboboxName: string, optionName: string) {
  const user = userEvent.setup();
  if (screen.queryByRole('listbox')) await user.keyboard('{Escape}');
  await user.click(await screen.findByRole('combobox', { name: comboboxName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
}

describe('ProjectMembers PRJ-SRS-005 (issue #36)', () => {
  it('add happy path gọi addProjectMember với payload đúng + báo thành công', async () => {
    addMemberMock.mockResolvedValue(member());
    render(<ProjectMembers projectId={PROJECT_ID} managerId={MANAGER_ID} />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    await chooseOption('Người dùng', 'Tran Thi Moi · NV-009');
    await chooseOption('Vai trò trong dự án', 'THÀNH VIÊN');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào dự án' }));
    await waitFor(() =>
      expect(addMemberMock).toHaveBeenCalledWith(PROJECT_ID, { userId: USER_ID, projectRole: 'WORKER' }),
    );
    await waitFor(() => expect(screen.getByText(/Đã thêm .* vào dự án/)).not.toBeNull());
    expect(listMembersMock).toHaveBeenCalledTimes(2);
  });

  it('duplicate 409 hiển thị field error Thành viên đã trong dự án', async () => {
    addMemberMock.mockRejectedValue({ status: 409, code: 'MEMBER_DUPLICATE', message: 'Thành viên đã thuộc dự án' });
    render(<ProjectMembers projectId={PROJECT_ID} managerId={MANAGER_ID} />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    await chooseOption('Người dùng', 'Tran Thi Moi · NV-009');
    await chooseOption('Vai trò trong dự án', 'QC');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào dự án' }));
    await waitFor(() => expect(screen.getByText('Thành viên đã trong dự án')).not.toBeNull());
  });

  it('MANAGER bị chặn client-side (không có trong select vai trò)', async () => {
    render(<ProjectMembers projectId={PROJECT_ID} managerId={MANAGER_ID} />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    const user = userEvent.setup();
    await user.click(await screen.findByRole('combobox', { name: 'Vai trò trong dự án' }));
    const options = await screen.findAllByRole('option');
    const values = options.map((o) => o.getAttribute('data-value') ?? '');
    expect(values).not.toContain('MANAGER');
    expect(values).toEqual(expect.arrayContaining(['COORDINATOR', 'QC', 'WORKER', 'VIEWER']));
    expect(screen.getByText(/Vai trò Quản lý chỉ đặt qua Sửa hồ sơ/)).not.toBeNull();
  });

  it('remove flow: confirm dialog → removeProjectMember với reason', async () => {
    removeMemberMock.mockResolvedValue({ ...member(), isActive: false, alreadyRemoved: false });
    render(<ProjectMembers projectId={PROJECT_ID} managerId={MANAGER_ID} />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Xóa khỏi dự án' }));
    expect(screen.getByRole('dialog')).not.toBeNull();
    const reason = screen.getByLabelText(/Lý do/);
    fireEvent.change(reason, { target: { value: 'Ket thuc phan cong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));
    await waitFor(() =>
      expect(removeMemberMock).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID, { reason: 'Ket thuc phan cong' }),
    );
    await waitFor(() => expect(screen.getByText(/Đã xóa .* khỏi dự án/)).not.toBeNull());
  });

  it('alreadyRemoved hiển thị info notice, không báo lỗi', async () => {
    removeMemberMock.mockResolvedValue({ ...member(), isActive: false, alreadyRemoved: true });
    render(<ProjectMembers projectId={PROJECT_ID} managerId={MANAGER_ID} />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Xóa khỏi dự án' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));
    await waitFor(() => expect(screen.getByText(/đã rời dự án trước đó — không thay đổi gì thêm/)).not.toBeNull());
  });

  it('409 MANAGER_MEMBER hiển thị message actionable đổi quản lý qua Sửa hồ sơ', async () => {
    removeMemberMock.mockRejectedValue({ status: 409, code: 'MANAGER_MEMBER', message: 'Không thể xóa quản lý dự án' });
    render(<ProjectMembers projectId={PROJECT_ID} managerId={MANAGER_ID} />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Xóa khỏi dự án' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));
    await waitFor(
      () => expect(screen.getByText('Thành viên này là quản lý hiện tại của dự án — đổi quản lý qua Sửa hồ sơ.')).not.toBeNull(),
    );
  });

  it('row của manager hiện tại có hint và ẩn nút xóa', async () => {
    listMembersMock.mockResolvedValue({
      data: [member({ id: 'mgr-row', userId: MANAGER_ID, projectRole: 'MANAGER', userName: 'Quan Ly', userCode: 'NV-001' })],
      total: 1,
    });
    render(<ProjectMembers projectId={PROJECT_ID} managerId={MANAGER_ID} />);
    await waitFor(() => expect(screen.getByText('QUẢN LÝ')).not.toBeNull());
    expect(screen.getByText('Đổi quản lý qua Sửa hồ sơ.')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa khỏi dự án' })).toBeNull();
  });

  it('lịch sử: toggle Xem lịch sử gọi API includeInactive + badge Đã rời', async () => {
    render(<ProjectMembers projectId={PROJECT_ID} managerId={MANAGER_ID} />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    listMembersMock.mockResolvedValue({
      data: [
        member(),
        member({ id: 'old-row', userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', userName: 'Nguoi Cu', userCode: 'NV-003', isActive: false, leftAt: '2026-03-01T08:00:00.000Z' }),
      ],
      total: 2,
    });
    fireEvent.click(screen.getByLabelText(/Xem lịch sử/));
    await waitFor(() => expect(listMembersMock).toHaveBeenLastCalledWith(PROJECT_ID, { includeInactive: true }));
    await waitFor(() => expect(screen.getByText('Đã rời')).not.toBeNull());
  });

  it('403 hiển thị permission message + retry', async () => {
    listMembersMock.mockRejectedValueOnce({ status: 403, message: 'Forbidden' });
    render(<ProjectMembers projectId={PROJECT_ID} managerId={MANAGER_ID} />);
    await waitFor(
      () => expect(screen.getByText('Không có quyền truy cập — cần ADMIN hoặc PROJECT_MANAGER (403)')).not.toBeNull(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(listMembersMock).toHaveBeenCalledTimes(2));
  });
});
