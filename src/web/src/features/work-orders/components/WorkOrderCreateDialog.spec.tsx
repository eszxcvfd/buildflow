import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderCreateDialog } from './WorkOrderCreateDialog';
import { createWorkOrder } from '@/lib/api/work-orders';
import { listActiveWorkTypes } from '@/lib/api/work-types';
import { listProjectAreas } from '@/lib/api/projects';
import { listTrades } from '@/lib/api/trades';

jest.mock('@/lib/api/work-orders', () => ({
  createWorkOrder: jest.fn(),
  getWorkOrder: jest.fn(),
}));
jest.mock('@/lib/api/work-types', () => ({ listActiveWorkTypes: jest.fn() }));
jest.mock('@/lib/api/projects', () => ({ listProjectAreas: jest.fn() }));
jest.mock('@/lib/api/trades', () => ({ listTrades: jest.fn() }));

const createMock = createWorkOrder as jest.Mock;

const TYPE_ID = '22222222-2222-4222-8222-222222222222';
const AREA_ID = '33333333-3333-4333-8333-333333333333';
const TRADE_ID = '44444444-4444-4444-8444-444444444444';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function seedPickers() {
  (listActiveWorkTypes as jest.Mock).mockResolvedValue({
    data: [{ id: TYPE_ID, code: 'WT-001', name: 'Do be tong' }],
    total: 1,
  });
  (listProjectAreas as jest.Mock).mockResolvedValue({
    data: [{ id: AREA_ID, projectId: 'p-1', code: 'A1', name: 'Tang 1' }],
    total: 1,
  });
  (listTrades as jest.Mock).mockResolvedValue({
    data: [{ id: TRADE_ID, code: 'T-NE', name: 'Be tong' }],
    total: 1,
    limit: 100,
    offset: 0,
  });
}

function createdWo(overrides = {}) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'WO-ABC123',
    projectId: 'p-1',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  seedPickers();
});

async function fillRequired() {
  await userEvent.type(screen.getByLabelText('Tiêu đề *'), 'Do be tong cot C1');
  await userEvent.selectOptions(screen.getByLabelText('Loại công việc *'), TYPE_ID);
}

describe('WorkOrderCreateDialog JOB-SRS-001', () => {
  it('render + submit happy path → payload mapped kèm requestKey + summary', async () => {
    const onCreated = jest.fn();
    createMock.mockResolvedValue({ workOrder: createdWo(), idempotentReplay: false });
    render(<WorkOrderCreateDialog open projectId="p-1" onClose={jest.fn()} onCreated={onCreated} />);

    await waitFor(() => expect(listActiveWorkTypes).toHaveBeenCalled());
    expect(listProjectAreas).toHaveBeenCalledWith('p-1', { activeOnly: true });
    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Tạo Work Order' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const payload = createMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      projectId: 'p-1',
      title: 'Do be tong cot C1',
      workTypeId: TYPE_ID,
      priority: 'NORMAL',
    });
    expect(payload.requestKey).toMatch(UUID_RE);
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ code: 'WO-ABC123' }));
    expect(await screen.findByText(/Đã tạo Work Order WO-ABC123/)).not.toBeNull();
    expect(screen.getByText(/55555555-5555-4555-8555-555555555555/)).not.toBeNull();
  });

  it('validation chặn title trống / thiếu loại công việc', async () => {
    createMock.mockResolvedValue({ workOrder: createdWo(), idempotentReplay: false });
    render(<WorkOrderCreateDialog open projectId="p-1" onClose={jest.fn()} />);
    await waitFor(() => expect(listActiveWorkTypes).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: 'Tạo Work Order' }));
    expect(await screen.findByText('Tiêu đề công việc không được để trống')).not.toBeNull();
    expect(await screen.findByText('Loại công việc không được để trống')).not.toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('409 trùng mã hiển thị lỗi theo field Mã', async () => {
    createMock.mockRejectedValue({
      status: 409,
      message: 'Mã công việc đã tồn tại',
      code: 'WORK_ORDER_CODE_DUPLICATE',
      fieldErrors: { code: ['Mã công việc đã tồn tại'] },
    });
    render(<WorkOrderCreateDialog open projectId="p-1" onClose={jest.fn()} />);
    await waitFor(() => expect(listActiveWorkTypes).toHaveBeenCalled());

    await fillRequired();
    await userEvent.type(screen.getByLabelText('Mã'), 'WO-DUP');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo Work Order' }));
    expect((await screen.findAllByText('Mã công việc đã tồn tại')).length).toBeGreaterThanOrEqual(1);
  });

  it('replay requestKey → notice đã tồn tại, giữ requestKey cố định qua retry', async () => {
    createMock
      .mockRejectedValueOnce({ status: 500, message: 'Lỗi máy chủ' })
      .mockResolvedValueOnce({ workOrder: createdWo(), idempotentReplay: true });
    render(<WorkOrderCreateDialog open projectId="p-1" onClose={jest.fn()} />);
    await waitFor(() => expect(listActiveWorkTypes).toHaveBeenCalled());

    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Tạo Work Order' }));
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));

    // Gửi lại (cùng phiên mở) → cùng requestKey
    await userEvent.click(screen.getByRole('button', { name: 'Tạo Work Order' }));
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(2));
    const first = createMock.mock.calls[0][0].requestKey;
    const second = createMock.mock.calls[1][0].requestKey;
    expect(first).toMatch(UUID_RE);
    expect(second).toBe(first);
    expect(await screen.findByText('Đã tồn tại từ lần gửi trước — không tạo bản ghi mới.')).not.toBeNull();
  });

  it('403 hiển thị alert quyền + Thử lại', async () => {
    createMock.mockRejectedValue({
      status: 403,
      message: 'Không có quyền tạo work order trong dự án này',
    });
    render(<WorkOrderCreateDialog open projectId="p-1" onClose={jest.fn()} />);
    await waitFor(() => expect(listActiveWorkTypes).toHaveBeenCalled());

    await fillRequired();
    await userEvent.click(screen.getByRole('button', { name: 'Tạo Work Order' }));
    expect(
      await screen.findByText('Không có quyền — cần quản trị hoặc quản lý/điều phối dự án (403)'),
    ).not.toBeNull();
    const retry = screen.getByRole('button', { name: 'Thử lại' });
    await userEvent.click(retry);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(2));
  });

  it('picker lỗi hiển thị retry; picker rỗng hiển thị empty option', async () => {
    (listTrades as jest.Mock).mockRejectedValueOnce({ status: 500, message: 'Lỗi' });
    (listProjectAreas as jest.Mock).mockResolvedValueOnce({ data: [], total: 0 });
    render(<WorkOrderCreateDialog open projectId="p-1" onClose={jest.fn()} />);
    expect(await screen.findByText('Không tải được danh sách ngành nghề')).not.toBeNull();
    expect(screen.getByText('Chưa có khu vực đang hoạt động')).not.toBeNull();
  });
});
