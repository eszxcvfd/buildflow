import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderTemplateEditDialog } from './WorkOrderTemplateEditDialog';
import { getWorkOrderTemplate, updateWorkOrderTemplate } from '@/lib/api/work-order-templates';
import { listActiveWorkTypes } from '@/lib/api/work-types';
import { listTrades } from '@/lib/api/trades';

jest.mock('@/lib/api/work-order-templates', () => ({
  searchWorkOrderTemplates: jest.fn(),
  listActiveWorkOrderTemplates: jest.fn(),
  getWorkOrderTemplate: jest.fn(),
  createWorkOrderTemplate: jest.fn(),
  updateWorkOrderTemplate: jest.fn(),
  changeWorkOrderTemplateStatus: jest.fn(),
}));
jest.mock('@/lib/api/work-types', () => ({ listActiveWorkTypes: jest.fn() }));
jest.mock('@/lib/api/trades', () => ({ listTrades: jest.fn() }));
const mockRefresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: mockRefresh }) }));

const getMock = getWorkOrderTemplate as jest.Mock;
const updateMock = updateWorkOrderTemplate as jest.Mock;

function tpl() {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'WOT-001',
    name: 'Do be tong chuan',
    description: 'Mo ta',
    workTypeId: null,
    requiredTradeId: null,
    defaultDurationMinutes: 90,
    defaultPriority: 'URGENT',
    requiredSkills: [{ code: 'THO-XAY', label: 'Tho xay' }],
    checklistSnapshot: [
      { title: 'Kiem tra cop pha', answerType: 'YES_NO', isRequired: true, isBlocking: false, requiresPhoto: false, sequenceNo: 1 },
    ],
    sourceChecklistTemplateId: null,
    status: 'DRAFT',
    version: 3,
    isActive: false,
    usableForNewWorkOrder: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (listActiveWorkTypes as jest.Mock).mockResolvedValue({ data: [], total: 0 });
  (listTrades as jest.Mock).mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

describe('WorkOrderTemplateEditDialog PRJ-SRS-008', () => {
  it('prefill đủ fields incl. skills + checklist builder + gửi expectedVersion', async () => {
    getMock.mockResolvedValue(tpl());
    updateMock.mockResolvedValue({ workOrderTemplate: tpl(), versionChanged: false });
    const onUpdated = jest.fn();
    render(<WorkOrderTemplateEditDialog id="55555555-5555-4555-8555-555555555555" open onClose={jest.fn()} onUpdated={onUpdated} />);

    await waitFor(() => expect(screen.getByLabelText('Mã mẫu công việc *')).not.toBeNull());
    expect((screen.getByLabelText('Mã mẫu công việc *') as HTMLInputElement).value).toBe('WOT-001');
    expect((screen.getByLabelText('Tên mẫu công việc *') as HTMLInputElement).value).toBe('Do be tong chuan');
    expect((screen.getByLabelText('Kỹ năng 1: code') as HTMLInputElement).value).toBe('THO-XAY');
    expect((screen.getByLabelText('Checklist mục 1: tiêu đề') as HTMLInputElement).value).toBe('Kiem tra cop pha');

    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      expect.objectContaining({ expectedVersion: 3 }),
    ));
    expect(onUpdated).toHaveBeenCalled();
  });

  it('prefill thời lượng/ưu tiên + preview trạng thái + gửi kèm payload', async () => {
    getMock.mockResolvedValue(tpl());
    updateMock.mockResolvedValue({ workOrderTemplate: tpl(), versionChanged: true });
    render(<WorkOrderTemplateEditDialog id="55555555-5555-4555-8555-555555555555" open onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Thời lượng mặc định (phút)')).not.toBeNull());
    expect((screen.getByLabelText('Thời lượng mặc định (phút)') as HTMLInputElement).value).toBe('90');
    expect((screen.getByLabelText('Ưu tiên mặc định') as HTMLSelectElement).value).toBe('URGENT');
    expect(screen.getByText('Xem trước cấu hình')).not.toBeNull();
    expect(screen.getByText('90 phút')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      expect.objectContaining({ defaultDurationMinutes: 90, defaultPriority: 'URGENT', expectedVersion: 3 }),
    ));
  });

  it('409 conflict hiển thị notice + nút tải lại', async () => {
    getMock.mockResolvedValue(tpl());
    updateMock.mockRejectedValue({
      status: 409,
      code: 'WORK_ORDER_TEMPLATE_CONFIG_CONFLICT',
      message: 'Mẫu đã được người khác cập nhật — tải lại',
      fieldErrors: { expectedVersion: ['Mẫu đã được người khác cập nhật — tải lại'] },
    });
    render(<WorkOrderTemplateEditDialog id="55555555-5555-4555-8555-555555555555" open onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('Mã mẫu công việc *')).not.toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect((await screen.findAllByText(/Mẫu đã được người khác cập nhật/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: 'Tải lại' }).length).toBeGreaterThanOrEqual(2);
  });
});
