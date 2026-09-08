import { render, screen, waitFor } from '@testing-library/react';
import { WorkOrderTemplatesList } from './WorkOrderTemplatesList';
import { searchWorkOrderTemplates } from '@/lib/api/work-order-templates';
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

const searchMock = searchWorkOrderTemplates as jest.Mock;
const listActiveWorkTypesMock = listActiveWorkTypes as jest.Mock;
const listTradesMock = listTrades as jest.Mock;

function tpl(overrides = {}) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    code: 'WOT-001',
    name: 'Do be tong chuan',
    description: null,
    workTypeId: '44444444-4444-4444-8444-444444444444',
    workType: { id: '44444444-4444-4444-8444-444444444444', code: 'WT-001', name: 'Do be tong' },
    requiredTradeId: null,
    defaultDurationMinutes: 120,
    defaultPriority: 'HIGH',
    requiredSkills: [{ code: 'THO-XAY', label: 'Tho xay' }],
    checklistSnapshot: [
      { title: 'Kiem tra cop pha', answerType: 'YES_NO', isRequired: true, isBlocking: false, sequenceNo: 1 },
      { title: 'Do be tong', answerType: 'PASS_FAIL', isRequired: true, isBlocking: true, sequenceNo: 2 },
    ],
    sourceChecklistTemplateId: null,
    status: 'ACTIVE',
    version: 1,
    isActive: true,
    usableForNewWorkOrder: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  listActiveWorkTypesMock.mockResolvedValue({
    data: [{ id: '44444444-4444-4444-8444-444444444444', code: 'WT-001', name: 'Do be tong' }],
    total: 1,
  });
  listTradesMock.mockResolvedValue({ data: [], total: 0, limit: 100, offset: 0 });
});

describe('WorkOrderTemplatesList PRJ-SRS-008', () => {
  it('hiển thị loading rồi rows table (tên + code chip / loại / thời lượng / ưu tiên / checklist / badge)', async () => {
    searchMock.mockResolvedValue({ data: [tpl()], total: 1, limit: 20, offset: 0 });
    render(<WorkOrderTemplatesList />);
    expect(screen.getByText('Đang tải danh sách mẫu công việc…')).not.toBeNull();
    await waitFor(() => expect(screen.getByText('Do be tong chuan')).not.toBeNull());
    expect(screen.getByText('WOT-001')).not.toBeNull();
    expect(screen.getAllByText('WT-001 — Do be tong').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('120 phút')).not.toBeNull();
    expect(screen.getByText('Cao')).not.toBeNull();
    expect(screen.getByText('Kiem tra cop pha +1')).not.toBeNull();
    expect(screen.getAllByText('Hoạt động').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: 'Chi tiết' })).not.toBeNull();
  });

  it('badge Nháp cho DRAFT; checklist rỗng hiển thị —', async () => {
    searchMock.mockResolvedValue({
      data: [tpl({ status: 'DRAFT', isActive: false, usableForNewWorkOrder: false, checklistSnapshot: [] })],
      total: 1,
      limit: 20,
      offset: 0,
    });
    render(<WorkOrderTemplatesList />);
    await waitFor(() => expect(screen.getAllByText('Nháp').length).toBeGreaterThanOrEqual(1));
    expect(screen.getByText('—')).not.toBeNull();
  });

  it('hiển thị tên loại đã ngừng từ workType kèm sẵn (không lookup /active, không fallback id)', async () => {
    listActiveWorkTypesMock.mockResolvedValue({ data: [], total: 0 });
    searchMock.mockResolvedValue({
      data: [
        tpl({
          code: 'WOT-BT-SAN',
          workTypeId: '99999999-9999-4999-8999-999999999999',
          workType: { id: '99999999-9999-4999-8999-999999999999', code: 'WT-BE-TONG-TC', name: 'Đổ bê tông thủ công' },
        }),
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    render(<WorkOrderTemplatesList />);
    await waitFor(() => expect(screen.getByText('WT-BE-TONG-TC — Đổ bê tông thủ công')).not.toBeNull());
    expect(screen.queryByText('99999999…')).toBeNull();
  });

  it('workTypeId null → —; workType thiếu → fallback id rút gọn', async () => {
    searchMock.mockResolvedValue({
      data: [
        tpl({ code: 'WOT-NONE', workTypeId: null, workType: null }),
        tpl({ code: 'WOT-GHOST', workTypeId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', workType: null }),
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });
    render(<WorkOrderTemplatesList />);
    await waitFor(() => expect(screen.getByText('WOT-NONE')).not.toBeNull());
    expect(screen.getByText('aaaaaaaa…')).not.toBeNull();
  });

  it('empty state khi không có mẫu phù hợp', async () => {
    searchMock.mockResolvedValue({ data: [], total: 0, limit: 20, offset: 0 });
    render(<WorkOrderTemplatesList />);
    await waitFor(() =>
      expect(screen.getByText('Chưa có mẫu công việc nào phù hợp bộ lọc')).not.toBeNull(),
    );
  });

  it('403 hiển thị thiếu quyền + nút thử lại', async () => {
    searchMock.mockRejectedValue({ status: 403, message: 'Forbidden' });
    render(<WorkOrderTemplatesList />);
    await waitFor(() =>
      expect(screen.getByText('Không có quyền truy cập — cần ADMIN hoặc Điều phối (403)')).not.toBeNull(),
    );
    expect(screen.getByRole('button', { name: 'Thử lại' })).not.toBeNull();
  });
});
