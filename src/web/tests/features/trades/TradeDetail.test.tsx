/**
 * DOM-level tests for TradeDetail (ORG-SRS-003, issue #26).
 * Covers: detail render with assignable state, 404, status toggle flow with
 * confirm dialog, in-use deactivate warning surfaced from API response, errors.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TradeDetail } from '@/features/trades/components/TradeDetail';

jest.mock('@/lib/api/trades', () => ({
  __esModule: true,
  getTrade: jest.fn(),
  changeTradeStatus: jest.fn(),
}));

import { getTrade, changeTradeStatus, type Trade } from '@/lib/api/trades';

const getMock = getTrade as jest.Mock;
const statusMock = changeTradeStatus as jest.Mock;

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'TR-001',
    name: 'Tho xay',
    description: 'Xay dung dan dung',
    status: 'ACTIVE',
    assignable: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const IN_USE_WARNING = 'Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực';

describe('TradeDetail (ORG-SRS-003)', () => {
  beforeEach(() => {
    getMock.mockReset();
    statusMock.mockReset();
  });

  afterEach(cleanup);

  it('renders trade details with assignable state', async () => {
    getMock.mockResolvedValueOnce(makeTrade());
    render(<TradeDetail id="11111111-1111-4111-8111-111111111111" />);
    expect(await screen.findByText('Tho xay')).toBeTruthy();
    expect(screen.getByText('TR-001')).toBeTruthy();
    expect(screen.getByText('Được phép — chọn được cho worker/loại công việc/work order mới')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chuyển sang Ngừng hoạt động' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sửa danh mục' })).toBeTruthy();
  });

  it('renders inactive trade with blocked assignment info', async () => {
    getMock.mockResolvedValueOnce(makeTrade({ status: 'INACTIVE', assignable: false }));
    render(<TradeDetail id="11111111-1111-4111-8111-111111111111" />);
    expect(await screen.findByText('Ngừng hoạt động')).toBeTruthy();
    expect(screen.getByText(/Bị chặn — danh mục ngừng hiệu lực không dùng cho phân công\/tự nhận mới/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeTruthy();
  });

  it('shows 404 with retry for unknown id', async () => {
    getMock.mockRejectedValueOnce({ status: 404, message: 'Không tìm thấy' });
    render(<TradeDetail id="missing" />);
    const alert404 = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Không tìm thấy ngành nghề (404)'));
    expect(alert404.length).toBeGreaterThan(0);
  });

  it('status toggle: confirm -> PATCH /status -> success note', async () => {
    getMock.mockResolvedValueOnce(makeTrade());
    statusMock.mockResolvedValueOnce(makeTrade({ status: 'INACTIVE', assignable: false }));
    render(<TradeDetail id="11111111-1111-4111-8111-111111111111" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển sang Ngừng hoạt động' }));
    expect(await screen.findByText(/Xác nhận chuyển trạng thái danh mục/)).toBeTruthy();
    fireEvent.click(screen.getByText('Xác nhận'));
    await waitFor(() => expect(statusMock).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', { status: 'INACTIVE' }));
    expect(await screen.findByText(/Đã chuyển sang Ngừng hoạt động/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeTruthy();
  });

  it('deactivate in-use trade surfaces API warning on detail', async () => {
    getMock.mockResolvedValueOnce(makeTrade());
    statusMock.mockResolvedValueOnce(makeTrade({ status: 'INACTIVE', assignable: false, warning: IN_USE_WARNING }));
    render(<TradeDetail id="11111111-1111-4111-8111-111111111111" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển sang Ngừng hoạt động' }));
    fireEvent.click(screen.getByText('Xác nhận'));
    const warn = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('đang được tham chiếu'));
    expect(warn.length).toBeGreaterThan(0);
  });

  it('status toggle failure surfaces error', async () => {
    getMock.mockResolvedValueOnce(makeTrade());
    statusMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' });
    render(<TradeDetail id="11111111-1111-4111-8111-111111111111" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chuyển sang Ngừng hoạt động' }));
    fireEvent.click(screen.getByText('Xác nhận'));
    const err = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Không có quyền — cần ADMIN'));
    expect(err.length).toBeGreaterThan(0);
  });
});
