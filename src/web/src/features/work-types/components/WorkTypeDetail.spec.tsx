import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkTypeDetail } from './WorkTypeDetail';
import { getWorkType, changeWorkTypeStatus } from '@/lib/api/work-types';
import { listTrades } from '@/lib/api/trades';

jest.mock('@/lib/api/work-types', () => ({
  searchWorkTypes: jest.fn(),
  listActiveWorkTypes: jest.fn(),
  getWorkType: jest.fn(),
  createWorkType: jest.fn(),
  updateWorkType: jest.fn(),
  changeWorkTypeStatus: jest.fn(),
}));
jest.mock('@/lib/api/trades', () => ({ listTrades: jest.fn() }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));

const getMock = getWorkType as jest.Mock;
const changeMock = changeWorkTypeStatus as jest.Mock;

function wt(overrides = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    code: 'WT-001',
    name: 'Do be tong',
    description: 'Mo ta cot',
    group: 'Ket cau',
    requiredTradeId: '11111111-1111-4111-8111-111111111111',
    requiredFields: [{ key: 'photos', label: 'Anh hien truong', type: 'PHOTO' }],
    configVersion: 2,
    defaultDurationMinutes: null,
    defaultPriority: 'NORMAL',
    status: 'ACTIVE',
    isActive: true,
    usableForNewWorkOrder: true,
    usage: { workOrders: 3 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
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

describe('WorkTypeDetail PRJ-SRS-004', () => {
  it('profile-card: tên + code chip + badge + def-grid + configVersion/usage + bảng requiredFields', async () => {
    getMock.mockResolvedValue(wt());
    render(<WorkTypeDetail id="44444444-4444-4444-8444-444444444444" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Do be tong' })).not.toBeNull());
    expect(screen.getByText('WT-001')).not.toBeNull();
    expect(screen.getByText('Hoạt động')).not.toBeNull();
    expect(screen.getByText('Mo ta cot')).not.toBeNull();
    expect(screen.getByText('TR-001 — Tho xay')).not.toBeNull();
    expect(screen.getByText(/v2 · Đang dùng bởi 3 work order/)).not.toBeNull();
    expect(screen.getByText('photos')).not.toBeNull();
    expect(screen.getByText('Anh hien truong')).not.toBeNull();
  });

  it('status action: warning khi usage>0 + reason bắt buộc + alreadyInState', async () => {
    getMock.mockResolvedValue(wt());
    changeMock.mockResolvedValue({ ...wt(), status: 'INACTIVE', isActive: false, alreadyInState: false });
    render(<WorkTypeDetail id="44444444-4444-4444-8444-444444444444" />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Do be tong' })).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Ngừng hoạt động' }));
    expect(screen.getByText(/đang được dùng bởi 3 work order/)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByText('Vui lòng nhập lý do chuyển trạng thái')).not.toBeNull();

    await userEvent.type(screen.getByLabelText('Lý do *'), 'Tam dung de ra soat');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(changeMock).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      { action: 'DEACTIVATE', reason: 'Tam dung de ra soat' },
    ));
    expect(await screen.findByText(/Đã chuyển sang Ngừng hoạt động/)).not.toBeNull();
  });

  it('404 hiển thị không tìm thấy + thử lại', async () => {
    getMock.mockRejectedValue({ status: 404, message: 'Not found' });
    render(<WorkTypeDetail id="nope" />);
    await waitFor(() =>
      expect(screen.getByText(/Không tìm thấy loại công việc \(404\)/)).not.toBeNull(),
    );
  });
});
