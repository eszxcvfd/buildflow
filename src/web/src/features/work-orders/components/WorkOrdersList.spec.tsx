import { render, screen, waitFor, within } from '@testing-library/react';
import { WorkOrdersList } from './WorkOrdersList';
import { searchWorkOrders } from '@/lib/api/work-orders';

jest.mock('@/lib/api/work-orders', () => ({
  searchWorkOrders: jest.fn(),
  getWorkOrder: jest.fn(),
  createWorkOrder: jest.fn(),
  updateWorkOrder: jest.fn(),
  newCorrelationId: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
}));

const searchMock = searchWorkOrders as jest.Mock;

function wo(overrides = {}) {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'WO-ABC123',
    projectId: '22222222-2222-4222-8222-222222222222',
    projectName: 'Du an 1',
    areaId: null,
    workTypeId: '44444444-4444-4444-8444-444444444444',
    workTypeName: 'Do be tong',
    requiredTradeId: null,
    title: 'Do be tong cot C1',
    description: null,
    instructions: null,
    priority: 'HIGH',
    status: 'DRAFT',
    plannedStartAt: null,
    plannedEndAt: null,
    dueAt: null,
    plannedHeadcount: null,
    createdBy: 'u-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 1,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('WorkOrdersList', () => {
  it('hiển thị loading rồi rows table (tiêu đề + code chip / dự án / loại / badge Nháp / ưu tiên / Chi tiết)', async () => {
    searchMock.mockResolvedValue({ data: [wo()], total: 1, limit: 20, offset: 0 });
    render(<WorkOrdersList />);
    expect(screen.getByText('Đang tải danh sách công việc…')).not.toBeNull();
    await waitFor(() => expect(screen.getByText('Do be tong cot C1')).not.toBeNull());
    const table = screen.getByRole('table');
    expect(within(table).getByText('WO-ABC123')).not.toBeNull();
    expect(within(table).getByText('Du an 1')).not.toBeNull();
    expect(within(table).getByText('Do be tong')).not.toBeNull();
    expect(within(table).getByText('Nháp')).not.toBeNull();
    expect(within(table).getByText('Cao')).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Chi tiết' })).not.toBeNull();
    expect(screen.getByRole('link', { name: 'Chi tiết' }).getAttribute('href')).toBe(
      '/work-orders/33333333-3333-4333-8333-333333333333',
    );
    expect(searchMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ALL', limit: 20, offset: 0 }),
    );
  });

  it('badge đủ 8 trạng thái với nhãn tiếng Việt', async () => {
    const statuses: Array<[string, string]> = [
      ['DRAFT', 'Nháp'],
      ['READY', 'Sẵn sàng'],
      ['OPEN', 'Mở'],
      ['ASSIGNED', 'Đã gán'],
      ['IN_PROGRESS', 'Đang làm'],
      ['WORK_DONE', 'Hoàn tất'],
      ['CLOSED', 'Đóng'],
      ['CANCELLED', 'Hủy'],
    ];
    searchMock.mockResolvedValue({
      data: statuses.map(([status], i) =>
        wo({ id: `id-${i}-0000-4000-8000-000000000000`, status, title: `Viec ${status}` }),
      ),
      total: 8,
      limit: 20,
      offset: 0,
    });
    render(<WorkOrdersList />);
    await waitFor(() => expect(screen.getByRole('table')).not.toBeNull());
    const table = screen.getByRole('table');
    for (const [, label] of statuses) {
      expect(within(table).getByText(label)).not.toBeNull();
    }
  });

  it('fallback id rút gọn khi thiếu projectName/workTypeName', async () => {
    searchMock.mockResolvedValue({
      data: [wo({ projectName: null, workTypeName: null })],
      total: 1,
      limit: 20,
      offset: 0,
    });
    render(<WorkOrdersList />);
    await waitFor(() => expect(screen.getByText('Do be tong cot C1')).not.toBeNull());
    expect(screen.getByText('22222222…')).not.toBeNull();
    expect(screen.getByText('44444444…')).not.toBeNull();
  });

  it('empty state khi không có công việc phù hợp', async () => {
    searchMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    render(<WorkOrdersList />);
    await waitFor(() =>
      expect(screen.getByText('Chưa có công việc nào phù hợp bộ lọc')).not.toBeNull(),
    );
  });

  it('401 → link đăng nhập; 403 → message thành viên dự án', async () => {
    searchMock.mockRejectedValueOnce({ status: 401, message: 'Phiên hết hạn' });
    const { unmount } = render(<WorkOrdersList />);
    await waitFor(() => expect(screen.getByText(/Phiên hết hạn/)).not.toBeNull());
    expect(screen.getByRole('link', { name: 'Đến trang đăng nhập' })).not.toBeNull();
    unmount();

    searchMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' });
    render(<WorkOrdersList />);
    await waitFor(() => expect(screen.getByText(/cần là thành viên dự án/)).not.toBeNull());
  });

  it('lỗi khác → message + nút Thử lại', async () => {
    searchMock.mockRejectedValueOnce({ status: 500, message: 'Lỗi máy chủ' });
    render(<WorkOrdersList />);
    await waitFor(() => expect(screen.getByText('Lỗi máy chủ')).not.toBeNull());
    expect(screen.getByRole('button', { name: 'Thử lại' })).not.toBeNull();
  });

  it('deep-link initialProjectId/initialStatus truyền vào search + hiện note lọc', async () => {
    searchMock.mockResolvedValue({ data: [wo()], total: 1, limit: 20, offset: 0 });
    render(<WorkOrdersList initialProjectId="22222222-2222-4222-8222-222222222222" initialStatus="OPEN" />);
    await waitFor(() => expect(screen.getByText('Do be tong cot C1')).not.toBeNull());
    expect(searchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: '22222222-2222-4222-8222-222222222222',
        status: 'OPEN',
      }),
    );
    expect(screen.getByText(/Đang lọc theo dự án/)).not.toBeNull();
  });

  it('initialStatus lạ → ALL', async () => {
    searchMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    render(<WorkOrdersList initialStatus="WRONG" />);
    await waitFor(() => expect(searchMock).toHaveBeenCalled());
    expect(searchMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'ALL' }));
  });
});
