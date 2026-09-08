import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ProjectDetail } from './ProjectDetail';
import { getProject, changeProjectStatus, listProjectMembers } from '@/lib/api/projects';
import { listWorkers } from '@/lib/api/workers';
import { listAuditLogs } from '@/lib/api/audit-logs';

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
jest.mock('@/lib/api/audit-logs', () => ({ listAuditLogs: jest.fn() }));
// Dialog Sửa hồ sơ mount ProjectForm (dùng useRouter) — mock như CrewForm.spec.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}));

const getProjectMock = getProject as jest.Mock;
const changeProjectStatusMock = changeProjectStatus as jest.Mock;
const listProjectMembersMock = listProjectMembers as jest.Mock;
const listWorkersMock = listWorkers as jest.Mock;
const listAuditLogsMock = listAuditLogs as jest.Mock;

function project(overrides = {}) {
  return {
    id: 'p-1',
    code: 'PRJ-001',
    name: 'Du an 1',
    status: 'DRAFT',
    managerId: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-01T00:00:00.000Z',
    ...overrides,
  };
}

function setSessionRoles(codes: string[]) {
  window.localStorage.setItem(
    'buildflow.auth.v1',
    JSON.stringify({
      accessToken: 'token',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: { id: 'u-1', email: 'a@b.c', fullName: 'A', status: 'ACTIVE', userType: 'STAFF' },
      roles: codes.map((code, i) => ({ id: `r-${i}`, code, name: code })),
      projectIds: [],
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  getProjectMock.mockResolvedValue(project());
  listProjectMembersMock.mockResolvedValue({ data: [], total: 0 });
  listWorkersMock.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
  listAuditLogsMock.mockResolvedValue({ data: [], total: 0, limit: 10, offset: 0 });
});

describe('ProjectDetail PRJ-SRS-001 (issue #32)', () => {
  it('render profile: code/name/status badge/ngày + note vòng đời PRJ-SRS-002', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Du an 1').length).toBeGreaterThan(0);
    expect(screen.getByText('DRAFT')).not.toBeNull();
    expect(screen.getByText(/Vòng đời dự án — PRJ-SRS-002/)).not.toBeNull();
  });

  it('ADMIN thấy nút Sửa hồ sơ (popup, không còn link /edit)', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    const btn = screen.getByRole('button', { name: 'Sửa hồ sơ' });
    expect(btn.tagName).toBe('BUTTON');
    expect(screen.queryByRole('link', { name: 'Sửa hồ sơ' })).toBeNull();
  });

  it('PROJECT_MANAGER thấy nút Sửa hồ sơ', async () => {
    setSessionRoles(['PROJECT_MANAGER']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Sửa hồ sơ' })).not.toBeNull();
  });

  it('WORKER không thấy nút Sửa hồ sơ (fail-closed)', async () => {
    setSessionRoles(['WORKER']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: 'Sửa hồ sơ' })).toBeNull();
  });

  it('bấm Sửa hồ sơ → mở dialog Sửa dự án + prefill tên (route /edit giữ standalone)', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: 'Sửa hồ sơ' }));
    await waitFor(() => expect(screen.getByText('Sửa dự án PRJ-001')).not.toBeNull());
    expect((screen.getByLabelText(/Tên dự án/) as HTMLInputElement).value).toBe('Du an 1');
  });

  it('404 hiển thị not-found', async () => {
    setSessionRoles(['ADMIN']);
    getProjectMock.mockRejectedValue({ status: 404, message: 'Not found' });
    render(<ProjectDetail id="missing" />);
    await waitFor(() => expect(screen.getByText(/Không tìm thấy dự án \(404\)/)).not.toBeNull());
  });

  it('nhúng section Thành viên dự án (PRJ-SRS-005, issue #36)', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText('Thành viên dự án')).not.toBeNull());
    expect(listProjectMembersMock).toHaveBeenCalledWith('p-1', {});
  });
});

describe('ProjectDetail status actions PRJ-SRS-002 (issue #33)', () => {
  it('DRAFT + ADMIN: hiện nút Kích hoạt/Đóng theo map L1', async () => {
    setSessionRoles(['ADMIN']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    expect(screen.getByText('Chuyển trạng thái:')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Kích hoạt' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Đóng' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Tạm dừng' })).toBeNull();
  });

  it('ACTIVE + PROJECT_MANAGER: hiện nút Tạm dừng/Hoàn thành', async () => {
    setSessionRoles(['PROJECT_MANAGER']);
    getProjectMock.mockResolvedValue(project({ status: 'ACTIVE' }));
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạm dừng' })).not.toBeNull());
    expect(screen.getByRole('button', { name: 'Hoàn thành' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Kích hoạt' })).toBeNull();
  });

  it('WORKER không thấy actions chuyển trạng thái (fail-closed)', async () => {
    setSessionRoles(['WORKER']);
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getAllByText('PRJ-001').length).toBeGreaterThan(0));
    expect(screen.queryByText('Chuyển trạng thái:')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kích hoạt' })).toBeNull();
  });

  it('CLOSED: note Work Order + nút Mở lại', async () => {
    setSessionRoles(['ADMIN']);
    getProjectMock.mockResolvedValue(project({ status: 'CLOSED' }));
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mở lại' })).not.toBeNull());
    expect(screen.getByText(/Dự án Đóng không nhận Work Order mới/)).not.toBeNull();
  });

  it('PAUSE thành công → dùng full profile từ response, không re-fetch', async () => {
    setSessionRoles(['ADMIN']);
    getProjectMock.mockResolvedValue(project({ status: 'ACTIVE' }));
    changeProjectStatusMock.mockResolvedValue({
      id: 'p-1',
      code: 'PRJ-001',
      name: 'Du an 1',
      description: null,
      address: '123 Duong Lang',
      timezone: 'Asia/Ho_Chi_Minh',
      plannedStartDate: '2026-09-01',
      plannedEndDate: '2026-12-31',
      managerId: '11111111-1111-4111-8111-111111111111',
      managerName: null,
      status: 'PAUSED',
      createdBy: 'u-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedBy: 'u-1',
      updatedAt: '2026-03-01T00:00:00.000Z',
      alreadyInState: false,
    });
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạm dừng' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'Bao tri' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạm dừng' }));
    await waitFor(() => expect(changeProjectStatusMock).toHaveBeenCalledWith('p-1', { action: 'PAUSE', reason: 'Bao tri' }));
    await waitFor(() => expect(screen.getByText('Tạm dừng dự án thành công.')).not.toBeNull());
    // Direct update từ response: chỉ 1 lần getProject (initial load), không re-fetch.
    expect(getProjectMock.mock.calls.length).toBe(1);
    // State cập nhật trực tiếp: actions chuyển sang map của PAUSED (Tiếp tục hoạt động).
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tiếp tục hoạt động' })).not.toBeNull());
  });

  it('response thiếu shape profile → fallback re-fetch summary', async () => {
    setSessionRoles(['ADMIN']);
    getProjectMock.mockResolvedValue(project({ status: 'ACTIVE' }));
    changeProjectStatusMock.mockResolvedValue({ status: 'PAUSED', updatedAt: '2026-03-01T00:00:00.000Z', alreadyInState: false });
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạm dừng' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'Bao tri' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạm dừng' }));
    await waitFor(() => expect(changeProjectStatusMock).toHaveBeenCalledWith('p-1', { action: 'PAUSE', reason: 'Bao tri' }));
    await waitFor(() => expect(screen.getByText('Tạm dừng dự án thành công.')).not.toBeNull());
    expect(getProjectMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('alreadyInState → notice info, không báo lỗi', async () => {
    setSessionRoles(['ADMIN']);
    getProjectMock.mockResolvedValue(project({ status: 'ACTIVE' }));
    changeProjectStatusMock.mockResolvedValue({ status: 'ACTIVE', alreadyInState: true });
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hoàn thành' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn thành' }));
    await waitFor(() => expect(screen.getByText('Dự án đã ở trạng thái này — không thay đổi gì thêm.')).not.toBeNull());
  });

  it('409 INVALID_TRANSITION → message kèm actions cho phép', async () => {
    setSessionRoles(['ADMIN']);
    getProjectMock.mockResolvedValue(project({ status: 'ACTIVE' }));
    changeProjectStatusMock.mockRejectedValue({
      status: 409,
      code: 'INVALID_TRANSITION',
      message: 'Không thể chuyển',
      allowedTransitions: ['PAUSE', 'COMPLETE'],
    });
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hoàn thành' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn thành' }));
    await waitFor(() => expect(screen.getByText(/chỉ cho phép: Tạm dừng, Hoàn thành/)).not.toBeNull());
  });

  it('403 → message quyền trong dialog', async () => {
    setSessionRoles(['ADMIN']);
    getProjectMock.mockResolvedValue(project({ status: 'ACTIVE' }));
    changeProjectStatusMock.mockRejectedValue({ status: 403, message: 'Forbidden' });
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hoàn thành' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Hoàn thành' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hoàn thành' }));
    await waitFor(() => expect(screen.getByText(/Không có quyền chuyển trạng thái/)).not.toBeNull());
  });

  it('400 fieldErrors reason → lỗi dưới textarea', async () => {
    setSessionRoles(['ADMIN']);
    getProjectMock.mockResolvedValue(project({ status: 'ACTIVE' }));
    changeProjectStatusMock.mockRejectedValue({
      status: 400,
      message: 'Lý do là bắt buộc khi tạm dừng/đóng/mở lại dự án',
      fieldErrors: { reason: ['Lý do là bắt buộc khi tạm dừng/đóng/mở lại dự án'] },
    });
    render(<ProjectDetail id="p-1" />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạm dừng' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
    // Client chặn reason rỗng trước; gửi reason hợp lệ để server 400 lộ ra.
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'ok' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạm dừng' }));
    await waitFor(() => expect(screen.getByText('Lý do là bắt buộc khi tạm dừng/đóng/mở lại dự án')).not.toBeNull());
  });
});
