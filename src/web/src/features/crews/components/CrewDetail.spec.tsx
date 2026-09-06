import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrewDetail } from './CrewDetail';
import { getCrew, changeCrewLifecycleStatus, getCrewOpenWork, listCrewMembers } from '@/lib/api/crews';
import { listWorkers } from '@/lib/api/workers';
import { listAuditLogs } from '@/lib/api/audit-logs';

jest.mock('@/lib/api/crews', () => ({
  listCrews: jest.fn(),
  getCrew: jest.fn(),
  createCrew: jest.fn(),
  updateCrew: jest.fn(),
  changeCrewLifecycleStatus: jest.fn(),
  getCrewOpenWork: jest.fn(),
  listCrewMembers: jest.fn(),
  addCrewMember: jest.fn(),
  removeCrewMember: jest.fn(),
}));
jest.mock('@/lib/api/workers', () => ({ listWorkers: jest.fn() }));
jest.mock('@/lib/api/audit-logs', () => ({ listAuditLogs: jest.fn() }));

const getCrewMock = getCrew as jest.Mock;
const changeStatusMock = changeCrewLifecycleStatus as jest.Mock;
const getOpenWorkMock = getCrewOpenWork as jest.Mock;
const listMembersMock = listCrewMembers as jest.Mock;
const listWorkersMock = listWorkers as jest.Mock;
const listAuditLogsMock = listAuditLogs as jest.Mock;

function crew(overrides = {}) {
  return {
    id: 'crew-1',
    code: 'TEAM-001',
    name: 'Doi ket cau',
    description: 'Thi cong phan tho',
    contractorId: null,
    status: 'ACTIVE',
    eligible: true,
    leaderUserId: '11111111-1111-4111-8111-111111111111',
    createdBy: 'u-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function leadWorker() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'lead@example.com',
    fullName: 'Nguyen Van Lead',
    phone: null,
    avatarUrl: null,
    employeeCode: 'NV-001',
    userType: 'WORKER',
    contractorId: null,
    status: 'ACTIVE',
    trades: [],
    eligible: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getCrewMock.mockResolvedValue(crew());
  listMembersMock.mockResolvedValue({ data: [], total: 0 });
  listWorkersMock.mockResolvedValue({ data: [leadWorker()], total: 1, limit: 100, offset: 0 });
  listAuditLogsMock.mockResolvedValue({ data: [], total: 0, limit: 10, offset: 0 });
});

describe('CrewDetail ORG-SRS-006', () => {
  it('hiển thị profile + panel thành viên ORG-SRS-007 (issue #30)', async () => {
    render(<CrewDetail id="crew-1" />);
    await waitFor(() => expect(screen.getByText('Doi ket cau')).not.toBeNull());
    expect(screen.getByText('TEAM-001')).not.toBeNull();
    expect(screen.getByText('Thành viên')).not.toBeNull();
    // Trưởng nhóm ở profile + option trong form thêm thành viên (cùng worker ACTIVE).
    await waitFor(() => expect(screen.getAllByText('Nguyen Van Lead · NV-001').length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('Chưa có thành viên — thêm thành viên đầu tiên')).not.toBeNull();
    expect(listMembersMock).toHaveBeenCalledWith('crew-1', {});
  });

  it('404 hiển thị not-found + retry', async () => {
    getCrewMock.mockRejectedValue({ status: 404, message: 'Not found' });
    render(<CrewDetail id="missing" />);
    await waitFor(() => expect(screen.getByText(/Không tìm thấy đội thi công \(404\)/)).not.toBeNull());
  });

  it('lifecycle SUSPEND với open-work warning hiển thị success kèm số việc mở', async () => {
    getOpenWorkMock.mockResolvedValue({ openAssignments: 2 });
    changeStatusMock.mockResolvedValue({
      ...crew({ status: 'INACTIVE', eligible: false }),
      alreadyInState: false,
      warning: { openAssignments: 2 },
    });
    render(<CrewDetail id="crew-1" />);
    await waitFor(() => expect(screen.getByText('Doi ket cau')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Tạm ngừng' }));
    await waitFor(() => expect(screen.getByText('2 công việc/lịch mở của đội')).not.toBeNull());
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'Het viec' } });
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận tạm ngừng/ }));
    await waitFor(() =>
      expect(screen.getByText(/Tạm ngừng thành công\. Đội đang có 2 công việc\/lịch mở của đội/)).not.toBeNull(),
    );
  });

  it('alreadyInState hiển thị thông tin, không báo lỗi', async () => {
    getOpenWorkMock.mockResolvedValue({ openAssignments: 0 });
    changeStatusMock.mockResolvedValue({ ...crew(), alreadyInState: true, warning: null });
    render(<CrewDetail id="crew-1" />);
    await waitFor(() => expect(screen.getByText('Doi ket cau')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Tạm ngừng' }));
    await waitFor(() => expect(screen.getByLabelText(/Lý do/)).not.toBeNull());
    fireEvent.change(screen.getByLabelText(/Lý do/), { target: { value: 'Lap lai' } });
    fireEvent.click(screen.getByRole('button', { name: /Xác nhận tạm ngừng/ }));
    await waitFor(() => expect(screen.getByText('Đội đã ở trạng thái ngừng hoạt động — không thay đổi gì thêm.')).not.toBeNull());
    // dialog đóng sau success
    expect(screen.queryByLabelText(/Lý do/)).toBeNull();
  });

  it('timeline CREW gọi audit-logs với entityType CREW', async () => {
    render(<CrewDetail id="crew-1" />);
    await waitFor(() => expect(listAuditLogsMock).toHaveBeenCalled());
    expect(listAuditLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'CREW', entityId: 'crew-1' }),
    );
  });
});
