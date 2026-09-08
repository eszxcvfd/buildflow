import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderCreateDialog } from './WorkOrderCreateDialog';
import { createWorkOrder } from '@/lib/api/work-orders';
import { listActiveWorkTypes } from '@/lib/api/work-types';
import { listProjectAreas } from '@/lib/api/projects';
import { listTrades } from '@/lib/api/trades';
import { listActiveWorkOrderTemplates } from '@/lib/api/work-order-templates';

jest.mock('@/lib/api/work-orders', () => ({
  createWorkOrder: jest.fn(),
  getWorkOrder: jest.fn(),
}));
jest.mock('@/lib/api/work-types', () => ({ listActiveWorkTypes: jest.fn() }));
jest.mock('@/lib/api/projects', () => ({ listProjectAreas: jest.fn() }));
jest.mock('@/lib/api/trades', () => ({ listTrades: jest.fn() }));
jest.mock('@/lib/api/work-order-templates', () => ({ listActiveWorkOrderTemplates: jest.fn() }));

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
  (listActiveWorkOrderTemplates as jest.Mock).mockResolvedValue({ data: [], total: 0 });
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

function inputValue(label: string | RegExp): string {
  return (screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
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

  it('J8 loại có ngành yêu cầu → trade tự khóa Bắt buộc + Dữ liệu bổ sung gửi kèm customFields', async () => {
    const REQ_TRADE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    (listActiveWorkTypes as jest.Mock).mockResolvedValue({
      data: [
        {
          id: TYPE_ID,
          code: 'WT-OP-LAT',
          name: 'Op lat',
          requiredTradeId: REQ_TRADE,
          requiredFields: [
            { key: 'dien_tich', label: 'Diện tích (m²)', type: 'NUMBER' },
            { key: 'anh_nghiem_thu', label: 'Ảnh nghiệm thu', type: 'PHOTO' },
          ],
        },
      ],
      total: 1,
    });
    (listTrades as jest.Mock).mockResolvedValue({
      data: [{ id: REQ_TRADE, code: 'OP-LAT', name: 'Lat' }],
      total: 1,
      limit: 100,
      offset: 0,
    });
    createMock.mockResolvedValue({ workOrder: createdWo(), idempotentReplay: false });
    render(<WorkOrderCreateDialog open projectId="p-1" onClose={jest.fn()} />);
    await waitFor(() => expect(listActiveWorkTypes).toHaveBeenCalled());

    await fillRequired();
    // Trade tự khóa theo yêu cầu của loại công việc.
    expect(await screen.findByText(/bắt buộc: OP-LAT — Lat/)).not.toBeNull();
    const trade = screen.getByLabelText(/Ngành nghề yêu cầu/) as HTMLSelectElement;
    expect(trade.disabled).toBe(true);
    expect(trade.value).toBe(REQ_TRADE);

    // Khu dữ liệu bổ sung render từ required_fields.
    expect(screen.getByText('Dữ liệu bổ sung (theo loại công việc)')).not.toBeNull();
    await userEvent.type(screen.getByLabelText(/Diện tích \(m²\)/), '120');
    await userEvent.type(screen.getByLabelText(/Ảnh nghiệm thu/), 'https://cdn.example/a.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo Work Order' }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock.mock.calls[0][0]).toMatchObject({
      requiredTradeId: REQ_TRADE,
      customFields: { dien_tich: 120, anh_nghiem_thu: 'https://cdn.example/a.jpg' },
    });
  });

  it('picker lỗi hiển thị retry; picker rỗng hiển thị empty option', async () => {
    (listTrades as jest.Mock).mockRejectedValueOnce({ status: 500, message: 'Lỗi' });
    (listProjectAreas as jest.Mock).mockResolvedValueOnce({ data: [], total: 0 });
    render(<WorkOrderCreateDialog open projectId="p-1" onClose={jest.fn()} />);
    expect(await screen.findByText('Không tải được danh sách ngành nghề')).not.toBeNull();
    expect(screen.getByText('Chưa có khu vực đang hoạt động')).not.toBeNull();
  });

  it('Tạo từ mẫu: chọn mẫu prefill snapshot + notice + chỉnh được + không lưu templateId', async () => {
    (listActiveWorkOrderTemplates as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          code: 'WOT-001',
          name: 'Mau be tong',
          description: 'Mo ta tu mau',
          workTypeId: TYPE_ID,
          requiredTradeId: TRADE_ID,
          defaultDurationMinutes: 120,
          defaultPriority: 'HIGH',
          requiredSkills: [],
          checklistSnapshot: [],
          status: 'ACTIVE',
        },
      ],
      total: 1,
    });
    createMock.mockResolvedValue({ workOrder: createdWo(), idempotentReplay: false });
    render(<WorkOrderCreateDialog open projectId="p-1" onClose={jest.fn()} />);

    await waitFor(() => expect(listActiveWorkOrderTemplates).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Ngày kế hoạch bắt đầu'), {
      target: { value: '2026-09-10T08:00' },
    });
    await fillRequired();
    await userEvent.selectOptions(
      screen.getByLabelText('Tạo từ mẫu'),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );

    // Notice snapshot-copy + prefill đúng.
    expect(
      await screen.findByText('Đã áp dụng mẫu Mau be tong — bạn có thể chỉnh sửa trước khi lưu'),
    ).not.toBeNull();
    expect(inputValue('Mô tả')).toBe('Mo ta tu mau');
    expect(inputValue('Ưu tiên')).toBe('HIGH');
    expect(inputValue(/Ngành nghề yêu cầu/)).toBe(TRADE_ID);
    expect(inputValue('Ngày kế hoạch kết thúc')).toBe('2026-09-10T10:00');

    // Chỉnh được sau khi áp dụng.
    const desc = screen.getByLabelText('Mô tả');
    await userEvent.clear(desc);
    await userEvent.type(desc, 'Mo ta sua tay');
    expect(inputValue('Mô tả')).toBe('Mo ta sua tay');

    await userEvent.click(screen.getByRole('button', { name: 'Tạo Work Order' }));
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const payload = createMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      description: 'Mo ta sua tay',
      priority: 'HIGH',
      requiredTradeId: TRADE_ID,
      plannedEndAt: new Date('2026-09-10T10:00').toISOString(),
    });
    // Snapshot-copy: KHÔNG FK templateId trong payload WO.
    expect(payload).not.toHaveProperty('templateId');
  });

  it('đổi mẫu chỉ prefill lại field chưa user-edit', async () => {
    const base = {
      code: 'WOT',
      workTypeId: TYPE_ID,
      requiredTradeId: TRADE_ID,
      requiredSkills: [],
      checklistSnapshot: [],
      status: 'ACTIVE',
    };
    (listActiveWorkOrderTemplates as jest.Mock).mockResolvedValue({
      data: [
        {
          ...base,
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          code: 'WOT-001',
          name: 'Mau mot',
          description: 'Mo ta mau mot',
          defaultDurationMinutes: 60,
          defaultPriority: 'HIGH',
        },
        {
          ...base,
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          code: 'WOT-002',
          name: 'Mau hai',
          description: 'Mo ta mau hai',
          defaultDurationMinutes: 30,
          defaultPriority: 'URGENT',
        },
      ],
      total: 2,
    });
    render(<WorkOrderCreateDialog open projectId="p-1" onClose={jest.fn()} />);
    await waitFor(() => expect(listActiveWorkOrderTemplates).toHaveBeenCalled());

    // User gõ mô tả TRƯỚC khi chọn mẫu → field đã user-edit.
    await userEvent.type(screen.getByLabelText('Mô tả'), 'Mo ta tay');
    const picker = screen.getByLabelText('Tạo từ mẫu');
    await userEvent.selectOptions(picker, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    await screen.findByText('Đã áp dụng mẫu Mau mot — bạn có thể chỉnh sửa trước khi lưu');
    // Mô tả giữ tay gõ; ưu tiên prefill từ mẫu.
    expect(inputValue('Mô tả')).toBe('Mo ta tay');
    expect(inputValue('Ưu tiên')).toBe('HIGH');

    // Đổi sang mẫu hai → mô tả vẫn giữ, ưu tiên prefill lại.
    await userEvent.selectOptions(picker, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    await screen.findByText('Đã áp dụng mẫu Mau hai — bạn có thể chỉnh sửa trước khi lưu');
    expect(inputValue('Mô tả')).toBe('Mo ta tay');
    expect(inputValue('Ưu tiên')).toBe('URGENT');
  });
});
