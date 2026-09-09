import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderJobBoardCard, JOB_BOARD_STATE_LABELS } from './WorkOrderJobBoardCard';
import { closeJobBoard } from '@/lib/api/work-order-board';
import type { WorkOrder } from '@/lib/api/work-orders';

jest.mock('@/lib/api/work-order-board', () => ({
  openJobBoard: jest.fn(),
  closeJobBoard: jest.fn(),
}));

const closeMock = closeJobBoard as jest.Mock;

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

function boarded(state: string, open: boolean, status = 'DRAFT') {
  return wo({
    status,
    jobBoard: { open, openFrom: open ? '2026-10-06T01:00:00.000Z' : null, openUntil: null, hasActiveAssignment: false, state: state as never },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('WorkOrderJobBoardCard JOB-SRS-004', () => {
  it.each([
    ['AVAILABLE', 'Đang nhận việc'],
    ['CLOSED', 'Đã đóng'],
    ['EXPIRED', 'Hết hạn'],
    ['ASSIGNED', 'Đã có người nhận'],
    ['SCHEDULED', 'Chưa mở cửa sổ'],
  ])('badge state %s → "%s" (server-derived)', (state, label) => {
    expect(JOB_BOARD_STATE_LABELS[state as keyof typeof JOB_BOARD_STATE_LABELS]).toBe(label);
    render(
      <WorkOrderJobBoardCard workOrder={boarded(state, state !== 'CLOSED')} canManage onRefresh={jest.fn()} onRequestOpen={jest.fn()} />,
    );
    expect(screen.getByText(label)).not.toBeNull();
  });

  it('DRAFT board đóng → nút "Mở Job Board"; OPEN board đóng → "Mở lại Job Board"', () => {
    const onRequestOpen = jest.fn();
    const { rerender } = render(
      <WorkOrderJobBoardCard workOrder={boarded('CLOSED', false, 'DRAFT')} canManage onRefresh={jest.fn()} onRequestOpen={onRequestOpen} />,
    );
    expect(screen.getByRole('button', { name: 'Mở Job Board' })).not.toBeNull();
    rerender(
      <WorkOrderJobBoardCard workOrder={boarded('CLOSED', false, 'OPEN')} canManage onRefresh={jest.fn()} onRequestOpen={onRequestOpen} />,
    );
    expect(screen.getByRole('button', { name: 'Mở lại Job Board' })).not.toBeNull();
  });

  it('board mở → nút "Đóng Job Board" + confirm note; xác nhận gọi closeJobBoard rồi refresh', async () => {
    closeMock.mockResolvedValue({ workOrder: boarded('CLOSED', false, 'READY'), alreadyClosed: false });
    const onRefresh = jest.fn();
    render(
      <WorkOrderJobBoardCard workOrder={boarded('AVAILABLE', true, 'OPEN')} canManage onRefresh={onRefresh} onRequestOpen={jest.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Đóng Job Board' }));
    expect(screen.getByText(/việc đã phân công không bị hủy/)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng' }));
    await waitFor(() => expect(closeMock).toHaveBeenCalledWith(boarded('AVAILABLE', true, 'OPEN').id, { expectedVersion: 2 }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('EXPIRED → cảnh báo đóng rồi mở lại', () => {
    render(
      <WorkOrderJobBoardCard workOrder={boarded('EXPIRED', true, 'OPEN')} canManage onRefresh={jest.fn()} onRequestOpen={jest.fn()} />,
    );
    expect(screen.getByText(/đóng rồi mở lại để đặt cửa sổ mới/)).not.toBeNull();
  });

  it('WORKER/VIEWER (canManage=false) → ẩn nút', () => {
    render(
      <WorkOrderJobBoardCard workOrder={boarded('CLOSED', false, 'DRAFT')} canManage={false} onRefresh={jest.fn()} onRequestOpen={jest.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Mở Job Board' })).toBeNull();
  });

  it('F011: state lạ ngoài enum → fallback "Không xác định", không crash, không badge sai', () => {
    render(
      <WorkOrderJobBoardCard workOrder={boarded('WEIRD_STATE' as never, false, 'DRAFT')} canManage onRefresh={jest.fn()} onRequestOpen={jest.fn()} />,
    );
    expect(screen.getByText('Không xác định')).not.toBeNull();
    expect(screen.queryByText('Đã đóng')).toBeNull();
  });

  it('F010: 409 JOB_BOARD_ALREADY_OPEN → Alert + Tải lại gọi onRefresh (refetch)', async () => {
    closeMock.mockRejectedValue({ status: 409, message: 'Job Board đang mở', code: 'JOB_BOARD_ALREADY_OPEN' });
    const onRefresh = jest.fn();
    render(
      <WorkOrderJobBoardCard workOrder={boarded('AVAILABLE', true, 'OPEN')} canManage onRefresh={onRefresh} onRequestOpen={jest.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Đóng Job Board' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng' }));
    await waitFor(() => expect(screen.getByText(/tải lại để xem trạng thái mới nhất/)).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('F010: 409 JOB_BOARD_HAS_ASSIGNEE → Alert đã có người nhận', async () => {
    closeMock.mockRejectedValue({ status: 409, message: 'đã có người nhận', code: 'JOB_BOARD_HAS_ASSIGNEE' });
    render(
      <WorkOrderJobBoardCard workOrder={boarded('AVAILABLE', true, 'OPEN')} canManage onRefresh={jest.fn()} onRequestOpen={jest.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Đóng Job Board' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng' }));
    await waitFor(() => expect(screen.getByText(/không thể mở Job Board/)).not.toBeNull());
  });

  it('F010: loading đóng → nút Đang xử lý, xong → refresh', async () => {
    let resolve!: (v: unknown) => void;
    closeMock.mockReturnValue(new Promise((r) => { resolve = r; }));
    const onRefresh = jest.fn();
    render(
      <WorkOrderJobBoardCard workOrder={boarded('AVAILABLE', true, 'OPEN')} canManage onRefresh={onRefresh} onRequestOpen={jest.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Đóng Job Board' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Đang xử lý/ })).not.toBeNull());
    resolve({ workOrder: boarded('CLOSED', false, 'READY'), alreadyClosed: false });
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });

  it('F010: lỗi mạng (status 0) → Alert chung, không crash', async () => {
    closeMock.mockRejectedValue({ status: 0, message: 'Không thể kết nối tới máy chủ, vui lòng kiểm tra mạng và thử lại' });
    render(
      <WorkOrderJobBoardCard workOrder={boarded('AVAILABLE', true, 'OPEN')} canManage onRefresh={jest.fn()} onRequestOpen={jest.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Đóng Job Board' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng' }));
    await waitFor(() => expect(screen.getByText(/Không thể kết nối tới máy chủ/)).not.toBeNull());
  });

  it('409 WORK_ORDER_CONFLICT → Alert + nút Tải lại gọi onRefresh', async () => {
    closeMock.mockRejectedValue({ status: 409, message: 'Work order đã bị thay đổi', code: 'WORK_ORDER_CONFLICT' });
    const onRefresh = jest.fn();
    render(
      <WorkOrderJobBoardCard workOrder={boarded('AVAILABLE', true, 'OPEN')} canManage onRefresh={onRefresh} onRequestOpen={jest.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Đóng Job Board' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Tải lại' })).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Tải lại' }));
    expect(onRefresh).toHaveBeenCalled();
  });

  it('403 → Alert forbidden', async () => {
    closeMock.mockRejectedValue({ status: 403, message: 'Forbidden', code: 'FORBIDDEN' });
    render(
      <WorkOrderJobBoardCard workOrder={boarded('AVAILABLE', true, 'OPEN')} canManage onRefresh={jest.fn()} onRequestOpen={jest.fn()} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Đóng Job Board' }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng' }));
    await waitFor(() => expect(screen.getByText(/cần quyền quản lý dự án \(403\)/)).not.toBeNull());
  });
});
