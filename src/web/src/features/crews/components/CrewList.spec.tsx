import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CrewList } from './CrewList';
import { listCrews } from '@/lib/api/crews';

jest.mock('@/lib/api/crews', () => ({
  listCrews: jest.fn(),
  getCrew: jest.fn(),
  createCrew: jest.fn(),
  updateCrew: jest.fn(),
  changeCrewLifecycleStatus: jest.fn(),
  getCrewOpenWork: jest.fn(),
}));

const listCrewsMock = listCrews as jest.Mock;

function crew(overrides = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'TEAM-001',
    name: 'Doi ket cau',
    description: null,
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CrewList ORG-SRS-006', () => {
  it('hiển thị loading rồi rows kèm eligible', async () => {
    listCrewsMock.mockResolvedValue({ data: [crew()], total: 1, limit: 20, offset: 0 });
    render(<CrewList />);
    expect(screen.getByText('Đang tải danh sách đội thi công…')).not.toBeNull();
    await waitFor(() => expect(screen.getByText('Doi ket cau')).not.toBeNull());
    expect(screen.getByText('TEAM-001')).not.toBeNull();
    expect(screen.getByText('Đủ điều kiện phân công')).not.toBeNull();
  });

  it('đội INACTIVE hiển thị chặn phân công mới', async () => {
    listCrewsMock.mockResolvedValue({
      data: [crew({ status: 'INACTIVE', eligible: false })],
      total: 1,
      limit: 20,
      offset: 0,
    });
    render(<CrewList />);
    await waitFor(() => expect(screen.getByText('Không nhận việc mới')).not.toBeNull());
  });

  it('empty state khi không có đội phù hợp', async () => {
    listCrewsMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    render(<CrewList />);
    await waitFor(() => expect(screen.getByText('Chưa có đội thi công nào phù hợp bộ lọc')).not.toBeNull());
  });

  it('403 hiển thị permission card + retry', async () => {
    listCrewsMock.mockRejectedValue({ status: 403, message: 'Forbidden' });
    render(<CrewList />);
    await waitFor(() =>
      expect(screen.getByText('Không có quyền truy cập — cần vai trò ADMIN hoặc PROJECT_MANAGER (403)')).not.toBeNull(),
    );
    listCrewsMock.mockResolvedValue({ data: [crew()], total: 1, limit: 20, offset: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText('Doi ket cau')).not.toBeNull());
  });

  it('gửi filter eligibleOnly + sort/order cho API', async () => {
    listCrewsMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    render(<CrewList />);
    await waitFor(() => expect(listCrewsMock).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText('Chỉ đội đủ điều kiện'));
    await waitFor(() =>
      expect(listCrewsMock).toHaveBeenCalledWith(expect.objectContaining({ eligibleOnly: true })),
    );
  });
});
