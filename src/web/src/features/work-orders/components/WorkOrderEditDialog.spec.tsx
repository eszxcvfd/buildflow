import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderEditDialog, editableFieldsForStatus } from './WorkOrderEditDialog';
import { updateWorkOrder, type WorkOrder } from '@/lib/api/work-orders';
import { listActiveWorkTypes } from '@/lib/api/work-types';
import { listTrades } from '@/lib/api/trades';

jest.mock('@/lib/api/work-orders', () => ({
  getWorkOrder: jest.fn(),
  createWorkOrder: jest.fn(),
  updateWorkOrder: jest.fn(),
  newCorrelationId: jest.fn(() => 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa'),
}));
jest.mock('@/lib/api/work-types', () => ({ listActiveWorkTypes: jest.fn() }));
jest.mock('@/lib/api/trades', () => ({ listTrades: jest.fn() }));

const updateMock = updateWorkOrder as jest.Mock;

function wo(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    code: 'WO-ABC123',
    projectId: '11111111-1111-4111-8111-111111111111',
    areaId: null,
    workTypeId: '22222222-2222-4222-8222-222222222222',
    requiredTradeId: null,
    title: 'Do be tong cot C1',
    description: 'Mo ta cu',
    instructions: null,
    priority: 'NORMAL',
    status: 'DRAFT',
    plannedStartAt: null,
    plannedEndAt: null,
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
  (listActiveWorkTypes as jest.Mock).mockResolvedValue({ data: [], total: 0 });
  (listTrades as jest.Mock).mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

describe('editableFieldsForStatus JOB-SRS-003', () => {
  it('DRAFT/READY full 9 fields (8 cũ + customFields J8)', () => {
    expect(editableFieldsForStatus('DRAFT', false).size).toBe(9);
    expect(editableFieldsForStatus('READY', false).size).toBe(9);
  });

  it('OPEN chỉ description/instructions/dueAt/customFields', () => {
    const s = editableFieldsForStatus('OPEN', false);
    expect([...s].sort()).toEqual(['customFields', 'description', 'dueAt', 'instructions'].sort());
  });

  it('ASSIGNED gồm desc/instructions/customFields + lịch/skill/work-type (không priority/dueAt)', () => {
    const s = editableFieldsForStatus('ASSIGNED', false);
    expect(s.has('plannedStartAt')).toBe(true);
    expect(s.has('requiredTradeId')).toBe(true);
    expect(s.has('workTypeId')).toBe(true);
    expect(s.has('customFields')).toBe(true);
    expect(s.has('priority')).toBe(false);
    expect(s.has('dueAt')).toBe(false);
  });

  it('WORK_DONE non-ADMIN rỗng, ADMIN full', () => {
    expect(editableFieldsForStatus('WORK_DONE', false).size).toBe(0);
    expect(editableFieldsForStatus('WORK_DONE', true).size).toBe(9);
    expect(editableFieldsForStatus('CLOSED', false).size).toBe(0);
  });
});

describe('WorkOrderEditDialog JOB-SRS-003', () => {
  it('OPEN: priority/dueAt-lịch khóa read-only + tooltip, description gửi kèm expectedVersion', async () => {
    updateMock.mockResolvedValue(wo({ status: 'OPEN', version: 3 }));
    const onUpdated = jest.fn();
    render(<WorkOrderEditDialog workOrder={wo({ status: 'OPEN' })} isAdmin={false} onClose={jest.fn()} onUpdated={onUpdated} />);

    const priority = screen.getByLabelText(/Ưu tiên/) as HTMLSelectElement;
    expect(priority.disabled).toBe(true);
    expect(priority.title).toBe('Khóa ở trạng thái OPEN');
    expect(screen.getAllByText('Khóa ở trạng thái OPEN').length).toBeGreaterThanOrEqual(1);

    await userEvent.clear(screen.getByLabelText(/Mô tả/));
    await userEvent.type(screen.getByLabelText(/Mô tả/), 'Mo ta moi');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        wo().id,
        expect.objectContaining({ description: 'Mo ta moi', expectedVersion: 2 }),
      ),
    );
    expect(onUpdated).toHaveBeenCalled();
  });

  it('ASSIGNED: đổi lịch không reason → chặn client, có reason → gửi', async () => {
    updateMock.mockResolvedValue(wo({ status: 'ASSIGNED', version: 3 }));
    render(<WorkOrderEditDialog workOrder={wo({ status: 'ASSIGNED' })} isAdmin={false} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Lịch bắt đầu/), { target: { value: '2026-03-01T08:00' } });
    fireEvent.change(screen.getByLabelText(/Lịch kết thúc/), { target: { value: '2026-03-02T08:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText(/bắt buộc kèm lý do/)).not.toBeNull();
    expect(updateMock).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/Lý do thay đổi/), 'Doi lich theo yeu cau giam sat');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        wo().id,
        expect.objectContaining({ expectedVersion: 2, reason: 'Doi lich theo yeu cau giam sat' }),
      ),
    );
  });

  it('WORK_DONE exception: ADMIN thấy badge + reason <10 ký tự bị chặn', async () => {
    render(<WorkOrderEditDialog workOrder={wo({ status: 'WORK_DONE' })} isAdmin onClose={jest.fn()} />);
    expect(screen.getAllByText(/chế độ ngoại lệ/i).length).toBeGreaterThanOrEqual(1);

    await userEvent.clear(screen.getByLabelText(/Mô tả/));
    await userEvent.type(screen.getByLabelText(/Mô tả/), 'Sua ngoai le');
    await userEvent.type(screen.getByLabelText(/Lý do thay đổi/), 'ngan');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect((await screen.findAllByText(/lý do bắt buộc tối thiểu 10 ký tự/)).length).toBeGreaterThanOrEqual(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('409 conflict hiển thị notice + nút tải lại', async () => {
    updateMock.mockRejectedValue({
      status: 409,
      code: 'WORK_ORDER_CONFLICT',
      message: 'Work order đã được người khác cập nhật (version hiện tại 3)',
      fieldErrors: { expectedVersion: ['Work order đã được người khác cập nhật (version hiện tại 3)'] },
    });
    render(<WorkOrderEditDialog workOrder={wo()} isAdmin={false} onClose={jest.fn()} />);

    await userEvent.clear(screen.getByLabelText(/Mô tả/));
    await userEvent.type(screen.getByLabelText(/Mô tả/), 'Mo ta moi');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect((await screen.findAllByText(/người khác cập nhật/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Tải lại' })).not.toBeNull();
  });

  it('400 FIELD_LOCKED hiển thị lỗi đúng field', async () => {
    updateMock.mockRejectedValue({
      status: 400,
      code: 'WORK_ORDER_FIELD_LOCKED',
      message: 'Field bị khóa',
      fieldErrors: { priority: ['Ưu tiên bị khóa ở trạng thái OPEN'] },
    });
    render(<WorkOrderEditDialog workOrder={wo()} isAdmin={false} onClose={jest.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText(/Ưu tiên/), 'HIGH');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    // DRAFT cho sửa priority nên FIELD_LOCKED ở đây là race state (WO đã chuyển
    // trạng thái) — dialog vẫn hiển thị lỗi đúng field, server là source of truth.
    expect(updateMock).toHaveBeenCalledWith(wo().id, expect.objectContaining({ priority: 'HIGH' }));
    expect((await screen.findAllByText(/Ưu tiên bị khóa/)).length).toBeGreaterThanOrEqual(1);
  });

  it('J8 Dữ liệu bổ sung render từ required_fields + gửi customFields khi đổi', async () => {
    const TYPE_ID = '22222222-2222-4222-8222-222222222222';
    (listActiveWorkTypes as jest.Mock).mockResolvedValue({
      data: [
        {
          id: TYPE_ID,
          code: 'WT-OP-LAT',
          name: 'Op lat',
          requiredTradeId: null,
          requiredFields: [
            { key: 'dien_tich', label: 'Diện tích (m²)', type: 'NUMBER' },
            { key: 'anh_nghiem_thu', label: 'Ảnh nghiệm thu', type: 'PHOTO' },
          ],
        },
      ],
      total: 1,
    });
    updateMock.mockResolvedValue(wo({ version: 3 }));
    render(<WorkOrderEditDialog workOrder={wo()} isAdmin={false} onClose={jest.fn()} />);

    expect(await screen.findByText('Dữ liệu bổ sung (theo loại công việc)')).not.toBeNull();
    await userEvent.type(screen.getByLabelText(/Diện tích \(m²\)/), '120');
    await userEvent.type(screen.getByLabelText(/Ảnh nghiệm thu/), 'https://cdn.example/a.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith(
        wo().id,
        expect.objectContaining({
          customFields: { dien_tich: 120, anh_nghiem_thu: 'https://cdn.example/a.jpg' },
        }),
      ),
    );
  });

  it('J8 đổi sang workType có ngành yêu cầu → trade tự khóa Bắt buộc', async () => {
    const TYPE_ID = '22222222-2222-4222-8222-222222222222';
    const OTHER_TYPE = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
    const TRADE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    (listActiveWorkTypes as jest.Mock).mockResolvedValue({
      data: [
        { id: TYPE_ID, code: 'WT-001', name: 'Loai cu', requiredTradeId: null, requiredFields: [] },
        { id: OTHER_TYPE, code: 'WT-OP-LAT', name: 'Op lat', requiredTradeId: TRADE_ID, requiredFields: [] },
      ],
      total: 2,
    });
    (listTrades as jest.Mock).mockResolvedValue({
      data: [{ id: TRADE_ID, code: 'OP-LAT', name: 'Lat' }],
      total: 1,
      limit: 100,
      offset: 0,
    });
    updateMock.mockResolvedValue(wo({ version: 3 }));
    render(<WorkOrderEditDialog workOrder={wo()} isAdmin={false} onClose={jest.fn()} />);

    await waitFor(() => expect(listActiveWorkTypes).toHaveBeenCalled());
    expect(await screen.findByRole('option', { name: /WT-OP-LAT — Op lat/ })).not.toBeNull();
    await userEvent.selectOptions(screen.getByLabelText(/Loại công việc/), OTHER_TYPE);
    expect(await screen.findByText(/bắt buộc: OP-LAT — Lat/)).not.toBeNull();
    const trade = screen.getByLabelText(/Ngành nghề yêu cầu/) as HTMLSelectElement;
    expect(trade.disabled).toBe(true);
    expect(trade.value).toBe(TRADE_ID);
  });
});
