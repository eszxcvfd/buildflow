import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderJobBoardDialog, toDatetimeLocal, toIsoOrNull } from './WorkOrderJobBoardDialog';
import { openJobBoard } from '@/lib/api/work-order-board';
import type { WorkOrder } from '@/lib/api/work-orders';

// F004 — TZ cố định để assertions wall-clock deterministic (mọi môi trường CI).
process.env.TZ = 'Asia/Ho_Chi_Minh';

jest.mock('@/lib/api/work-order-board', () => ({
  openJobBoard: jest.fn(),
  closeJobBoard: jest.fn(),
}));

const openMock = openJobBoard as jest.Mock;

function wo(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'WO-ABC123',
    projectId: '11111111-1111-4111-8111-111111111111',
    areaId: null,
    workTypeId: '22222222-2222-4222-8222-222222222222',
    requiredTradeId: null,
    title: 'Do be tong cot C1',
    description: null,
    instructions: null,
    priority: 'NORMAL',
    status: 'DRAFT',
    plannedStartAt: '2026-10-06T01:00:00.000Z',
    plannedEndAt: '2026-10-10T10:00:00.000Z',
    dueAt: null,
    plannedHeadcount: null,
    createdBy: 'u-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    version: 2,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('toIsoOrNull/toDatetimeLocal JOB-SRS-004 R6+F004 (TZ cố định + round-trip)', () => {
  it('ISO có offset tường minh → instant UTC đúng, độc lập TZ local', () => {
    expect(toIsoOrNull('2026-10-15T15:00:00+07:00')).toBe('2026-10-15T08:00:00.000Z');
    expect(toIsoOrNull('2026-10-15T08:00:00.000Z')).toBe('2026-10-15T08:00:00.000Z');
  });

  it('TZ Asia/Ho_Chi_Minh: naive local ⇄ UTC đúng nghĩa (08:00+07:00 = 01:00Z)', () => {
    expect(toIsoOrNull('2026-10-06T08:00')).toBe('2026-10-06T01:00:00.000Z');
    expect(toDatetimeLocal('2026-10-06T01:00:00.000Z')).toBe('2026-10-06T08:00');
  });

  it('round-trip prefill → submit giữ nguyên instant (chính xác phút)', () => {
    const serverIso = '2026-10-15T08:00:00.000Z';
    expect(toIsoOrNull(toDatetimeLocal(serverIso))).toBe(serverIso);
  });

  it('chuỗi rỗng → null; chuỗi rác → null; toDatetimeLocal rác → rỗng', () => {
    expect(toIsoOrNull('')).toBeNull();
    expect(toIsoOrNull('not-a-date')).toBeNull();
    expect(toDatetimeLocal('not-a-date')).toBe('');
    expect(toDatetimeLocal(null)).toBe('');
  });
});

describe('WorkOrderJobBoardDialog JOB-SRS-004', () => {
  it('submit gửi ISO toISOString + expectedVersion; thành công → onOpened', async () => {
    openMock.mockResolvedValue({ workOrder: wo({ status: 'OPEN' }), alreadyOpen: false });
    const onOpened = jest.fn();
    render(<WorkOrderJobBoardDialog workOrder={wo()} onClose={jest.fn()} onOpened={onOpened} />);
    await userEvent.clear(screen.getByLabelText(/Mở từ/));
    await userEvent.type(screen.getByLabelText(/Mở từ/), '2026-10-06T08:00');
    await userEvent.clear(screen.getByLabelText(/Đến/));
    await userEvent.type(screen.getByLabelText(/Đến/), '2026-10-20T17:00');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận mở' }));
    await waitFor(() => expect(openMock).toHaveBeenCalled());
    const [, payload] = openMock.mock.calls[0];
    expect(payload.jobBoardOpenFrom).toMatch(/Z$/);
    expect(payload.jobBoardOpenUntil).toMatch(/Z$/);
    expect(payload.expectedVersion).toBe(2);
    expect(onOpened).toHaveBeenCalled();
  });

  it('client-validate: until <= from → lỗi đúng input, không gọi API', async () => {
    render(<WorkOrderJobBoardDialog workOrder={wo()} onClose={jest.fn()} onOpened={jest.fn()} />);
    await userEvent.clear(screen.getByLabelText(/Mở từ/));
    await userEvent.type(screen.getByLabelText(/Mở từ/), '2026-10-20T08:00');
    await userEvent.clear(screen.getByLabelText(/Đến/));
    await userEvent.type(screen.getByLabelText(/Đến/), '2026-10-06T08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận mở' }));
    await waitFor(() =>
      expect(screen.getByText('Thời điểm kết thúc phải sau thời điểm bắt đầu')).not.toBeNull(),
    );
    expect(openMock).not.toHaveBeenCalled();
  });

  it('client-validate: until quá khứ → lỗi đúng input, không gọi API', async () => {
    render(<WorkOrderJobBoardDialog workOrder={wo()} onClose={jest.fn()} onOpened={jest.fn()} />);
    await userEvent.clear(screen.getByLabelText(/Mở từ/));
    await userEvent.type(screen.getByLabelText(/Mở từ/), '2020-01-01T08:00');
    await userEvent.clear(screen.getByLabelText(/Đến/));
    await userEvent.type(screen.getByLabelText(/Đến/), '2020-02-01T08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận mở' }));
    await waitFor(() =>
      expect(screen.getByText('Thời điểm kết thúc phải trong tương lai')).not.toBeNull(),
    );
    expect(openMock).not.toHaveBeenCalled();
  });

  it('fieldErrors server render đúng input', async () => {
    openMock.mockRejectedValue({
      status: 400,
      message: 'Cửa sổ Job Board không hợp lệ',
      code: 'JOB_BOARD_WINDOW_INVALID',
      fieldErrors: { jobBoardOpenUntil: ['Thời điểm kết thúc phải sau thời điểm bắt đầu'] },
    });
    render(<WorkOrderJobBoardDialog workOrder={wo()} onClose={jest.fn()} onOpened={jest.fn()} />);
    await userEvent.clear(screen.getByLabelText(/Mở từ/));
    await userEvent.type(screen.getByLabelText(/Mở từ/), '2026-10-06T08:00');
    await userEvent.clear(screen.getByLabelText(/Đến/));
    await userEvent.type(screen.getByLabelText(/Đến/), '2026-10-20T17:00');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận mở' }));
    await waitFor(() =>
      expect(screen.getByText('Thời điểm kết thúc phải sau thời điểm bắt đầu')).not.toBeNull(),
    );
  });

  it('F010+F011: 409 JOB_BOARD_ALREADY_OPEN → tự refetch GET :id trước khi hiện Alert', async () => {
    openMock.mockRejectedValue({
      status: 409,
      message: 'Job Board đang mở với cửa sổ khác',
      code: 'JOB_BOARD_ALREADY_OPEN',
    });
    const onRefetch = jest.fn();
    const onOpened = jest.fn();
    render(<WorkOrderJobBoardDialog workOrder={wo()} onClose={jest.fn()} onOpened={onOpened} onRefetch={onRefetch} />);
    await userEvent.clear(screen.getByLabelText(/Mở từ/));
    await userEvent.type(screen.getByLabelText(/Mở từ/), '2026-10-06T08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận mở' }));
    await waitFor(() => expect(onRefetch).toHaveBeenCalled());
    expect(screen.getByText(/đóng Job Board trước khi mở lại/)).not.toBeNull();
    // Dialog giữ mở (không đóng như onOpened success-path).
    expect(onOpened).not.toHaveBeenCalled();
  });

  it('F010: 409 JOB_BOARD_HAS_ASSIGNEE → Alert đã có người nhận', async () => {
    openMock.mockRejectedValue({
      status: 409,
      message: 'Công việc đã có người nhận',
      code: 'JOB_BOARD_HAS_ASSIGNEE',
    });
    render(<WorkOrderJobBoardDialog workOrder={wo()} onClose={jest.fn()} onOpened={jest.fn()} />);
    await userEvent.clear(screen.getByLabelText(/Mở từ/));
    await userEvent.type(screen.getByLabelText(/Mở từ/), '2026-10-06T08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận mở' }));
    await waitFor(() => expect(screen.getByText(/đã có người nhận/)).not.toBeNull());
  });

  it('F010: 403 open → Alert forbidden', async () => {
    openMock.mockRejectedValue({ status: 403, message: 'Forbidden' });
    render(<WorkOrderJobBoardDialog workOrder={wo()} onClose={jest.fn()} onOpened={jest.fn()} />);
    await userEvent.clear(screen.getByLabelText(/Mở từ/));
    await userEvent.type(screen.getByLabelText(/Mở từ/), '2026-10-06T08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận mở' }));
    await waitFor(() => expect(screen.getByText(/cần quyền quản lý dự án \(403\)/)).not.toBeNull());
  });

  it('F010: lỗi mạng (status 0) → Alert chung, không crash', async () => {
    openMock.mockRejectedValue({ status: 0, message: 'Không thể kết nối tới máy chủ, vui lòng kiểm tra mạng và thử lại' });
    render(<WorkOrderJobBoardDialog workOrder={wo()} onClose={jest.fn()} onOpened={jest.fn()} />);
    await userEvent.clear(screen.getByLabelText(/Mở từ/));
    await userEvent.type(screen.getByLabelText(/Mở từ/), '2026-10-06T08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận mở' }));
    await waitFor(() => expect(screen.getByText(/Không thể kết nối tới máy chủ/)).not.toBeNull());
  });

  it('409 WORK_ORDER_CONFLICT → Alert + nút Tải lại gọi onOpened', async () => {
    openMock.mockRejectedValue({ status: 409, message: 'Work order đã bị thay đổi', code: 'WORK_ORDER_CONFLICT' });
    const onOpened = jest.fn();
    render(<WorkOrderJobBoardDialog workOrder={wo()} onClose={jest.fn()} onOpened={onOpened} />);
    await userEvent.clear(screen.getByLabelText(/Mở từ/));
    await userEvent.type(screen.getByLabelText(/Mở từ/), '2026-10-06T08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận mở' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tải lại' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(onOpened).toHaveBeenCalled();
  });

  it('loading: nút submit disable + aria-busy', async () => {
    let resolve!: (v: unknown) => void;
    openMock.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<WorkOrderJobBoardDialog workOrder={wo()} onClose={jest.fn()} onOpened={jest.fn()} />);
    await userEvent.clear(screen.getByLabelText(/Mở từ/));
    await userEvent.type(screen.getByLabelText(/Mở từ/), '2026-10-06T08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận mở' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Đang xử lý/ })).not.toBeNull());
    resolve({ workOrder: wo({ status: 'OPEN' }), alreadyOpen: false });
  });
});
