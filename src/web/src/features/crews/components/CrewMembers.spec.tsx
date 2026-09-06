import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrewMembers } from './CrewMembers';
import { listCrewMembers, addCrewMember, removeCrewMember } from '@/lib/api/crews';
import { listWorkers } from '@/lib/api/workers';

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

const listMembersMock = listCrewMembers as jest.Mock;
const addMemberMock = addCrewMember as jest.Mock;
const removeMemberMock = removeCrewMember as jest.Mock;
const listWorkersMock = listWorkers as jest.Mock;

const CREW_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function member(overrides = {}) {
  return {
    id: MEMBER_ID,
    userId: USER_ID,
    memberRole: 'MEMBER',
    effectiveFrom: '2026-02-01',
    effectiveTo: null,
    isActive: true,
    addedBy: 'u-admin',
    createdAt: '2026-02-01T08:00:00.000Z',
    userName: 'Nguyen Van M',
    userCode: 'NV-002',
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

describe('CrewMembers ORG-SRS-007 (issue #30)', () => {
  it('hiển thị loading rồi danh sách active kèm role badge + hiệu lực', async () => {
    render(<CrewMembers crewId={CREW_ID} crewStatus="ACTIVE" />);
    expect(screen.getByText('Đang tải danh sách thành viên…')).not.toBeNull();
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    expect(screen.getByText('THÀNH VIÊN')).not.toBeNull();
    expect(screen.getByText(/2026-02-01 → nay/)).not.toBeNull();
    expect(listMembersMock).toHaveBeenCalledWith(CREW_ID, {});
  });

  it('empty state khi chưa có thành viên', async () => {
    listMembersMock.mockResolvedValue({ data: [], total: 0 });
    render(<CrewMembers crewId={CREW_ID} crewStatus="ACTIVE" />);
    await waitFor(
      () => expect(screen.getByText('Chưa có thành viên — thêm thành viên đầu tiên')).not.toBeNull(),
    );
  });

  it('LEAD row có hint đổi trưởng nhóm và không có nút xóa', async () => {
    listMembersMock.mockResolvedValue({
      data: [member({ id: 'lead-row', memberRole: 'LEAD', userName: 'Lead N', userCode: 'NV-001' })],
      total: 1,
    });
    render(<CrewMembers crewId={CREW_ID} crewStatus="ACTIVE" />);
    await waitFor(() => expect(screen.getByText('TRƯỞNG NHÓM')).not.toBeNull());
    expect(screen.getByText('Đổi trưởng nhóm qua form sửa hồ sơ đội.')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa khỏi đội' })).toBeNull();
  });

  it('add happy path gọi addCrewMember với payload đúng + báo thành công', async () => {
    addMemberMock.mockResolvedValue({ ...member(), warning: null });
    render(<CrewMembers crewId={CREW_ID} crewStatus="ACTIVE" />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Công nhân'), { target: { value: USER_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào đội' }));
    await waitFor(() =>
      expect(addMemberMock).toHaveBeenCalledWith(CREW_ID, { userId: USER_ID, effectiveFrom: null }),
    );
    await waitFor(() => expect(screen.getByText(/Đã thêm .* vào đội/)).not.toBeNull());
    expect(listMembersMock).toHaveBeenCalledTimes(2);
  });

  it('duplicate 409 hiển thị field error Thành viên đã trong đội', async () => {
    addMemberMock.mockRejectedValue({ status: 409, code: 'MEMBER_DUPLICATE', message: 'Thành viên đã thuộc đội' });
    render(<CrewMembers crewId={CREW_ID} crewStatus="ACTIVE" />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Công nhân'), { target: { value: USER_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào đội' }));
    await waitFor(() => expect(screen.getByText('Thành viên đã trong đội')).not.toBeNull());
  });

  it('warning MEMBER_IN_OTHER_CREW render banner liệt kê đội khác nhưng vẫn thành công', async () => {
    addMemberMock.mockResolvedValue({
      ...member(),
      warning: {
        code: 'MEMBER_IN_OTHER_CREW',
        otherCrews: [{ crewId: 'c-2', crewCode: 'TEAM-002', crewName: 'Doi hoan thien' }],
      },
    });
    render(<CrewMembers crewId={CREW_ID} crewStatus="ACTIVE" />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Công nhân'), { target: { value: USER_ID } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào đội' }));
    await waitFor(
      () => expect(screen.getByText(/Thành viên đang thuộc đội khác: Doi hoan thien \(TEAM-002\)/)).not.toBeNull(),
    );
    expect(screen.getByText(/Đã thêm .* vào đội/)).not.toBeNull();
  });

  it('remove flow: confirm dialog → removeCrewMember với effectiveTo + reason', async () => {
    removeMemberMock.mockResolvedValue({ ...member(), effectiveTo: '2026-03-01', isActive: false, alreadyRemoved: false });
    render(<CrewMembers crewId={CREW_ID} crewStatus="ACTIVE" />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Xóa khỏi đội' }));
    expect(screen.getByRole('dialog')).not.toBeNull();
    const reason = screen.getByLabelText(/Lý do/);
    fireEvent.change(reason, { target: { value: 'Dieu chuyen sang doi khac' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));
    await waitFor(() =>
      expect(removeMemberMock).toHaveBeenCalledWith(
        CREW_ID,
        MEMBER_ID,
        expect.objectContaining({ reason: 'Dieu chuyen sang doi khac' }),
      ),
    );
    await waitFor(() => expect(screen.getByText(/Đã xóa .* khỏi đội/)).not.toBeNull());
  });

  it('alreadyRemoved hiển thị info notice, không báo lỗi', async () => {
    removeMemberMock.mockResolvedValue({ ...member(), isActive: false, alreadyRemoved: true });
    render(<CrewMembers crewId={CREW_ID} crewStatus="ACTIVE" />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Xóa khỏi đội' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));
    await waitFor(() => expect(screen.getByText(/đã rời đội trước đó — không thay đổi gì thêm/)).not.toBeNull());
  });

  it('đội INACTIVE disable form thêm + báo không thể thêm', async () => {
    render(<CrewMembers crewId={CREW_ID} crewStatus="INACTIVE" />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    expect(screen.getByText('Đội đang không hoạt động nên không thể thêm thành viên.')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Thêm vào đội' }).hasAttribute('disabled')).toBe(true);
    expect((screen.getByLabelText('Công nhân') as HTMLSelectElement).disabled).toBe(true);
  });

  it('lịch sử: toggle includeInactive + mốc at gọi API đúng param', async () => {
    render(<CrewMembers crewId={CREW_ID} crewStatus="ACTIVE" />);
    await waitFor(() => expect(screen.getByText(/Nguyen Van M/)).not.toBeNull());
    fireEvent.click(screen.getByLabelText(/Xem toàn bộ lịch sử/));
    await waitFor(() => expect(listMembersMock).toHaveBeenLastCalledWith(CREW_ID, { includeInactive: true }));
    fireEvent.change(screen.getByLabelText('Danh sách tại ngày'), { target: { value: '2026-01-15' } });
    await waitFor(() => expect(listMembersMock).toHaveBeenLastCalledWith(CREW_ID, { at: '2026-01-15' }));
  });

  it('403 hiển thị permission message + retry', async () => {
    listMembersMock.mockRejectedValueOnce({ status: 403, message: 'Forbidden' });
    render(<CrewMembers crewId={CREW_ID} crewStatus="ACTIVE" />);
    await waitFor(
      () => expect(screen.getByText('Không có quyền truy cập — cần ADMIN hoặc PROJECT_MANAGER (403)')).not.toBeNull(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(listMembersMock).toHaveBeenCalledTimes(2));
  });
});
