import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkerCrews } from './WorkerCrews';
import { getWorkerCrews } from '@/lib/api/workers';
import { listCrews, listCrewMembers, addCrewMember, removeCrewMember } from '@/lib/api/crews';

jest.mock('@/lib/api/workers', () => ({
  getWorkerCrews: jest.fn(),
}));
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

const getCrewsMock = getWorkerCrews as jest.Mock;
const listCrewsMock = listCrews as jest.Mock;
const listMembersMock = listCrewMembers as jest.Mock;
const addMemberMock = addCrewMember as jest.Mock;
const removeMemberMock = removeCrewMember as jest.Mock;

const WORKER_ID = '11111111-1111-4111-8111-111111111111';
const WORKER_NAME = 'Nguyen Van Tho';

function membership(overrides = {}) {
  return {
    crewId: '33333333-3333-4333-8333-333333333333',
    crewCode: 'TEAM-001',
    crewName: 'Doi ket cau',
    crewStatus: 'ACTIVE',
    memberRole: 'MEMBER',
    effectiveFrom: '2026-02-01',
    effectiveTo: null,
    ...overrides,
  };
}

function crew(overrides = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    code: 'TEAM-009',
    name: 'Doi moi',
    description: null,
    contractorId: null,
    status: 'ACTIVE',
    eligible: true,
    leaderUserId: 'u-lead',
    createdBy: 'u-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Crews write mở ADMIN + PROJECT_MANAGER — seed ADMIN để hiện nút Thêm/Kết thúc. */
function seedAdminAuth() {
  window.localStorage.setItem(
    'buildflow.auth.v1',
    JSON.stringify({
      accessToken: 'jwt-test',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: 'u-admin', email: 'admin@example.com', fullName: 'Admin', status: 'ACTIVE', userType: 'STAFF' },
      roles: [{ id: 'r-1', code: 'ADMIN', name: 'Admin' }],
      projectIds: [],
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  seedAdminAuth();
  getCrewsMock.mockResolvedValue([]);
  listCrewsMock.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

afterEach(() => {
  window.localStorage.clear();
});

/**
 * Thay fireEvent.change trên <select> native (wrapper là Ark Select).
 */
async function chooseOption(comboboxName: string, optionName: string) {
  const user = userEvent.setup();
  if (screen.queryByRole('listbox')) await user.keyboard('{Escape}');
  await user.click(await screen.findByRole('combobox', { name: comboboxName }));
  await user.click(await screen.findByRole('option', { name: optionName }));
}

describe('WorkerCrews ORG-03/ORG-05/BR-06', () => {
  it('hiển thị loading rồi bảng memberships kèm link/vai trò/hiệu lực', async () => {
    getCrewsMock.mockResolvedValue([membership()]);
    render(<WorkerCrews workerId={WORKER_ID} workerName={WORKER_NAME} />);
    expect(screen.getByText('Đang tải đội thi công…')).not.toBeNull();
    await waitFor(() => expect(getCrewsMock).toHaveBeenCalledWith(WORKER_ID));
    const link = screen.getByRole('link', { name: 'TEAM-001 — Doi ket cau' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/crews/33333333-3333-4333-8333-333333333333');
    expect(screen.getByText('Thành viên')).not.toBeNull();
    expect(screen.getByText('2026-02-01 → đến nay')).not.toBeNull();
  });

  it('role LEAD hiển thị badge Trưởng nhóm tone info', async () => {
    getCrewsMock.mockResolvedValue([membership({ memberRole: 'LEAD' })]);
    render(<WorkerCrews workerId={WORKER_ID} workerName={WORKER_NAME} />);
    await waitFor(() => expect(screen.getByText('Trưởng nhóm')).not.toBeNull());
  });

  it('empty state khi chưa tham gia đội nào', async () => {
    render(<WorkerCrews workerId={WORKER_ID} workerName={WORKER_NAME} />);
    await waitFor(() => expect(screen.getByText('Chưa tham gia đội nào')).not.toBeNull());
  });

  it('lỗi tải có retry', async () => {
    getCrewsMock.mockRejectedValueOnce({ status: 500, message: 'Lỗi máy chủ' });
    render(<WorkerCrews workerId={WORKER_ID} workerName={WORKER_NAME} />);
    await waitFor(() => expect(screen.getByText('Lỗi máy chủ')).not.toBeNull());
    getCrewsMock.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText('Chưa tham gia đội nào')).not.toBeNull());
  });

  it('add happy path: submit gọi addCrewMember(crewId, {userId}) + refresh', async () => {
    listCrewsMock.mockResolvedValue({ data: [crew()], total: 1, limit: 100, offset: 0 });
    addMemberMock.mockResolvedValue({
      id: 'm-1',
      userId: WORKER_ID,
      memberRole: 'MEMBER',
      effectiveFrom: '2026-09-08',
      effectiveTo: null,
      isActive: true,
      addedBy: 'u-admin',
      createdAt: '2026-09-08T00:00:00.000Z',
      userName: null,
      userCode: null,
      warning: null,
    });
    render(<WorkerCrews workerId={WORKER_ID} workerName={WORKER_NAME} />);
    await waitFor(() => expect(getCrewsMock).toHaveBeenCalledWith(WORKER_ID));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào đội' }));
    await waitFor(() =>
      expect(listCrewsMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'ACTIVE' })),
    );
    await chooseOption('Đội thi công', 'TEAM-009 — Doi moi');
    // Dialog modal ẩn nền khỏi accessibility tree (Ark) → chỉ còn nút submit.
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào đội' }));
    await waitFor(() =>
      expect(addMemberMock).toHaveBeenCalledWith('44444444-4444-4444-8444-444444444444', {
        userId: WORKER_ID,
      }),
    );
    expect(getCrewsMock).toHaveBeenCalledTimes(2);
  });

  it('add 409 hiển thị field error đã là thành viên', async () => {
    listCrewsMock.mockResolvedValue({ data: [crew()], total: 1, limit: 100, offset: 0 });
    addMemberMock.mockRejectedValue({ status: 409, code: 'MEMBER_DUPLICATE', message: 'Đã là thành viên' });
    render(<WorkerCrews workerId={WORKER_ID} workerName={WORKER_NAME} />);
    await waitFor(() => expect(getCrewsMock).toHaveBeenCalledWith(WORKER_ID));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào đội' }));
    await chooseOption('Đội thi công', 'TEAM-009 — Doi moi');
    // Dialog modal ẩn nền khỏi accessibility tree (Ark) → chỉ còn nút submit.
    fireEvent.click(screen.getByRole('button', { name: 'Thêm vào đội' }));
    await waitFor(() =>
      expect(screen.getByText('Công nhân đã là thành viên của đội này')).not.toBeNull(),
    );
  });

  it('remove flow: Kết thúc → confirm + reason → removeCrewMember + refresh', async () => {
    const m = membership();
    getCrewsMock.mockResolvedValue([m]);
    listMembersMock.mockResolvedValue({
      data: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          userId: WORKER_ID,
          memberRole: 'MEMBER',
          effectiveFrom: '2026-02-01',
          effectiveTo: null,
          isActive: true,
          addedBy: 'u-admin',
          createdAt: '2026-02-01T08:00:00.000Z',
          userName: null,
          userCode: null,
        },
      ],
      total: 1,
    });
    removeMemberMock.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      userId: WORKER_ID,
      memberRole: 'MEMBER',
      effectiveFrom: '2026-02-01',
      effectiveTo: '2026-09-08',
      isActive: false,
      addedBy: 'u-admin',
      createdAt: '2026-02-01T08:00:00.000Z',
      userName: null,
      userCode: null,
      alreadyRemoved: false,
    });
    render(<WorkerCrews workerId={WORKER_ID} workerName={WORKER_NAME} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Kết thúc' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Kết thúc' }));
    expect(screen.getByText(/Kết thúc hiệu lực, lịch sử giữ nguyên/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận kết thúc' }));
    await waitFor(() =>
      expect(removeMemberMock).toHaveBeenCalledWith(
        m.crewId,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        expect.objectContaining({ reason: null }),
      ),
    );
    expect(getCrewsMock).toHaveBeenCalledTimes(2);
  });

  it('WORKER-role ẩn nút Thêm vào đội/Kết thúc', async () => {
    window.localStorage.setItem(
      'buildflow.auth.v1',
      JSON.stringify({
        accessToken: 'jwt-test',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        user: { id: 'u-w', email: 'w@example.com', fullName: 'W', status: 'ACTIVE', userType: 'WORKER' },
        roles: [{ id: 'r-3', code: 'WORKER', name: 'Worker' }],
        projectIds: [],
      }),
    );
    getCrewsMock.mockResolvedValue([membership()]);
    render(<WorkerCrews workerId={WORKER_ID} workerName={WORKER_NAME} />);
    await waitFor(() => expect(screen.getByText('TEAM-001 — Doi ket cau')).not.toBeNull());
    expect(screen.queryByRole('button', { name: 'Thêm vào đội' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Kết thúc' })).toBeNull();
  });
});
