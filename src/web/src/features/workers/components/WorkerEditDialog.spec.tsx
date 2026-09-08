import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkerEditDialog } from './WorkerEditDialog';
import { getWorker, updateWorker } from '@/lib/api/workers';
import { listTrades } from '@/lib/api/trades';

jest.mock('@/lib/api/workers', () => ({
  listWorkers: jest.fn(),
  getWorker: jest.fn(),
  createWorker: jest.fn(),
  updateWorker: jest.fn(),
  changeWorkerLifecycleStatus: jest.fn(),
  getWorkerOpenWork: jest.fn(),
}));
jest.mock('@/lib/api/trades', () => ({
  listTrades: jest.fn(),
}));
jest.mock('@/features/workers/hooks/useTradeNames', () => ({
  useTradeNames: () => ({ names: new Map(), loading: false, failed: false }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}));

const getWorkerMock = getWorker as jest.Mock;
const updateWorkerMock = updateWorker as jest.Mock;
const listTradesMock = listTrades as jest.Mock;

function worker(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'a@example.com',
    fullName: 'Nguyen Van A',
    phone: '0901000001',
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

const W_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
  getWorkerMock.mockResolvedValue(worker());
  updateWorkerMock.mockResolvedValue(worker());
  listTradesMock.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

describe('WorkerEditDialog (CRUD popup)', () => {
  it('mở dialog → load theo id + prefill giá trị (title Sửa công nhân)', async () => {
    render(<WorkerEditDialog id={W_ID} open onClose={() => {}} />);
    await waitFor(() => expect(getWorkerMock).toHaveBeenCalledWith(W_ID));
    await waitFor(() => expect(screen.getByText('Sửa công nhân')).not.toBeNull());
    expect((screen.getByLabelText('Họ tên *') as HTMLInputElement).value).toBe('Nguyen Van A');
    expect((screen.getByLabelText('Mã nhân viên') as HTMLInputElement).value).toBe('NV-001');
  });

  it('sửa tên + Lưu → PATCH updateWorker + đóng dialog + báo onUpdated', async () => {
    const onClose = jest.fn();
    const onUpdated = jest.fn();
    render(<WorkerEditDialog id={W_ID} open onClose={onClose} onUpdated={onUpdated} />);
    await waitFor(() => expect(screen.getByText('Sửa công nhân')).not.toBeNull());
    fireEvent.change(screen.getByLabelText('Họ tên *'), { target: { value: 'Nguyen Van B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updateWorkerMock).toHaveBeenCalledWith(
      W_ID,
      expect.objectContaining({ fullName: 'Nguyen Van B' }),
    ));
    expect(onClose).toHaveBeenCalled();
    expect(onUpdated).toHaveBeenCalled();
  });

  it('lỗi per-field từ PATCH giữ nguyên trong dialog (không đóng)', async () => {
    const onClose = jest.fn();
    updateWorkerMock.mockRejectedValue({
      status: 400,
      message: 'Dữ liệu không hợp lệ',
      fieldErrors: { fullName: ['Họ tên bắt buộc'] },
    });
    render(<WorkerEditDialog id={W_ID} open onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Sửa công nhân')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(screen.getByText('Họ tên bắt buộc')).not.toBeNull());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('đóng (open=false) → không render + không load', () => {
    render(<WorkerEditDialog id={W_ID} open={false} onClose={() => {}} />);
    expect(screen.queryByText('Sửa công nhân')).toBeNull();
    expect(getWorkerMock).not.toHaveBeenCalled();
  });

  it('404 khi load → thông báo + nút Thử lại', async () => {
    getWorkerMock.mockRejectedValue({ status: 404, message: 'Not found' });
    render(<WorkerEditDialog id={W_ID} open onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Không tìm thấy công nhân (404)')).not.toBeNull());
    expect(screen.getByRole('button', { name: 'Thử lại' })).not.toBeNull();
  });
});
