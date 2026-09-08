import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { WorkersView } from './WorkersView';
import { listWorkers } from '@/lib/api/workers';

jest.mock('@/lib/api/workers', () => ({
  listWorkers: jest.fn(),
  getWorker: jest.fn(),
  createWorker: jest.fn(),
  updateWorker: jest.fn(),
  changeWorkerLifecycleStatus: jest.fn(),
  getWorkerOpenWork: jest.fn(),
}));

jest.mock('@/features/workers/hooks/useTradeNames', () => ({
  useTradeNames: () => ({ names: new Map(), loading: false, failed: false }),
}));

const listWorkersMock = listWorkers as jest.Mock;

function worker(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'a@example.com',
    fullName: 'Nguyen Van A',
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
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, '', '/workers');
});

describe('WorkersView Bảng | Kanban', () => {
  it('mặc định hiển thị bảng (không cần ?view=)', async () => {
    listWorkersMock.mockResolvedValue({ data: [worker()], total: 1, limit: 20, offset: 0 });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('NV-001')).not.toBeNull());
    // bảng có header cột 'Mã NV'; kanban không có
    expect(screen.getByText('Mã NV')).not.toBeNull();
    expect(window.location.search).not.toContain('view=kanban');
  });

  it('bấm Kanban → hiện cột trạng thái + đồng bộ ?view=kanban; bấm Bảng → bỏ param', async () => {
    listWorkersMock.mockResolvedValue({ data: [worker()], total: 1, limit: 20, offset: 0 });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('NV-001')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Kanban/ }));
    expect(window.location.search).toContain('view=kanban');
    await waitFor(() => expect(screen.getByLabelText('Hoạt động (1)')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Bảng/ }));
    expect(window.location.search).not.toContain('view=kanban');
    await waitFor(() => expect(screen.getByText('Mã NV')).not.toBeNull());
  });

  it('mở trực tiếp ?view=kanban → render kanban ngay', async () => {
    window.history.replaceState(null, '', '/workers?view=kanban');
    listWorkersMock.mockResolvedValue({ data: [worker()], total: 1, limit: 20, offset: 0 });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByLabelText('Hoạt động (1)')).not.toBeNull());
  });

  it('toggle Bảng|Kanban nằm cùng hàng PageHeader với nút Thêm mới (toggle trái, nút phải)', async () => {
    listWorkersMock.mockResolvedValue({ data: [worker()], total: 1, limit: 20, offset: 0 });
    render(<WorkersView />);
    const addBtn = await screen.findByRole('button', { name: 'Thêm mới' });
    const header = addBtn.closest('header');
    expect(header).not.toBeNull();
    // toggle group và nút thêm chung một PageHeader actions row
    expect(within(header as HTMLElement).getByRole('group', { name: 'Chế độ xem' })).not.toBeNull();
  });

  it('mỗi trang chỉ một nút Thêm mới (kể cả khi danh sách rỗng)', async () => {
    listWorkersMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    render(<WorkersView />);
    await waitFor(() => expect(screen.getByText('Chưa có worker nào phù hợp bộ lọc')).not.toBeNull());
    expect(screen.getAllByRole('button', { name: 'Thêm mới' })).toHaveLength(1);
  });
});
