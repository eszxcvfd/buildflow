import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkOrderTemplateDetail } from './WorkOrderTemplateDetail';
import { getWorkOrderTemplate, changeWorkOrderTemplateStatus } from '@/lib/api/work-order-templates';
import { listActiveWorkTypes } from '@/lib/api/work-types';
import { listTrades } from '@/lib/api/trades';

jest.mock('@/lib/api/work-order-templates', () => ({
  searchWorkOrderTemplates: jest.fn(),
  listActiveWorkOrderTemplates: jest.fn(),
  getWorkOrderTemplate: jest.fn(),
  createWorkOrderTemplate: jest.fn(),
  updateWorkOrderTemplate: jest.fn(),
  changeWorkOrderTemplateStatus: jest.fn(),
  WORK_ORDER_TEMPLATE_STATUS_LABELS: { DRAFT: 'Nháp', ACTIVE: 'Hoạt động', INACTIVE: 'Ngừng hoạt động' },
}));
jest.mock('@/lib/api/work-types', () => ({ listActiveWorkTypes: jest.fn() }));
jest.mock('@/lib/api/trades', () => ({ listTrades: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

const getMock = getWorkOrderTemplate as jest.Mock;
const changeMock = changeWorkOrderTemplateStatus as jest.Mock;

function tpl(overrides = {}) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'WOT-001',
    name: 'Do be tong chuan',
    description: 'Mo ta mau',
    workTypeId: '44444444-4444-4444-8444-444444444444',
    requiredTradeId: '11111111-1111-4111-8111-111111111111',
    defaultDurationMinutes: 120,
    defaultPriority: 'HIGH',
    requiredSkills: [{ code: 'THO-XAY', label: 'Tho xay' }],
    checklistSnapshot: [
      { title: 'Kiem tra cop pha', answerType: 'YES_NO', isRequired: true, isBlocking: false, requiresPhoto: true, sequenceNo: 1 },
    ],
    sourceChecklistTemplateId: null,
    status: 'DRAFT',
    version: 2,
    isActive: false,
    usableForNewWorkOrder: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (listActiveWorkTypes as jest.Mock).mockResolvedValue({
    data: [{ id: '44444444-4444-4444-8444-444444444444', code: 'WT-001', name: 'Do be tong' }],
    total: 1,
  });
  (listTrades as jest.Mock).mockResolvedValue({
    data: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        code: 'TR-001',
        name: 'Tho xay',
        description: null,
        status: 'ACTIVE',
        assignable: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    total: 1,
    limit: 100,
    offset: 0,
  });
});

describe('WorkOrderTemplateDetail PRJ-SRS-008', () => {
  it('profile-card: tên + code chip + badge Nháp + def-grid + version + checklist + note snapshot', async () => {
    getMock.mockResolvedValue(tpl());
    render(<WorkOrderTemplateDetail id="55555555-5555-4555-8555-555555555555" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Do be tong chuan' })).not.toBeNull());
    expect(screen.getByText('WOT-001')).not.toBeNull();
    expect(screen.getByText('Nháp')).not.toBeNull();
    expect(screen.getByText('Mo ta mau')).not.toBeNull();
    expect(screen.getByText('WT-001 — Do be tong')).not.toBeNull();
    expect(screen.getByText('TR-001 — Tho xay')).not.toBeNull();
    expect(screen.getByText('v2')).not.toBeNull();
    expect(screen.getByText('Tho xay')).not.toBeNull();
    expect(screen.getByText('Kiem tra cop pha')).not.toBeNull();
    expect(screen.getByText(/Sửa mẫu không thay đổi Work Order đã tạo/)).not.toBeNull();
  });

  it('status action DRAFT→kích hoạt: confirm + alreadyInState', async () => {
    getMock.mockResolvedValue(tpl());
    changeMock.mockResolvedValue({ ...tpl(), status: 'ACTIVE', isActive: true, usableForNewWorkOrder: true, alreadyInState: false });
    render(<WorkOrderTemplateDetail id="55555555-5555-4555-8555-555555555555" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Do be tong chuan' })).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Kích hoạt' }));
    expect(screen.getByText(/phải có ít nhất một kỹ năng yêu cầu hoặc một mục checklist/)).not.toBeNull();

    await userEvent.type(screen.getByLabelText('Lý do (tùy chọn)'), 'Da ra soat xong');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(changeMock).toHaveBeenCalledWith(
      '55555555-5555-4555-8555-555555555555',
      { action: 'ACTIVATE', reason: 'Da ra soat xong' },
    ));
    expect(await screen.findByText(/Đã kích hoạt — có thể dùng cho work order mới/)).not.toBeNull();
  });

  it('404 hiển thị không tìm thấy + thử lại', async () => {
    getMock.mockRejectedValue({ status: 404, message: 'Not found' });
    render(<WorkOrderTemplateDetail id="nope" />);
    await waitFor(() =>
      expect(screen.getByText(/Không tìm thấy mẫu công việc \(404\)/)).not.toBeNull(),
    );
  });
});
