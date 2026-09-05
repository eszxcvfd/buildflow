/**
 * DOM-level tests for TradeList (ORG-SRS-003, issue #26).
 * Covers: loading, list rendering with status badge, empty state, 401/403,
 * deactivate flow with confirm dialog, in-use warning from API, pagination.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { TradeList } from '@/features/trades/components/TradeList';

jest.mock('@/lib/api/trades', () => ({
  __esModule: true,
  listTrades: jest.fn(),
  changeTradeStatus: jest.fn(),
}));

import { listTrades, changeTradeStatus } from '@/lib/api/trades';

const listMock = listTrades as jest.Mock;
const statusMock = changeTradeStatus as jest.Mock;

const tradeA = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'TR-001',
  name: 'Tho xay',
  description: null,
  status: 'ACTIVE',
  assignable: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const tradeB = {
  ...tradeA,
  id: '22222222-2222-4222-8222-222222222222',
  code: 'TR-002',
  name: 'Tho son',
  status: 'INACTIVE',
  assignable: false,
};

describe('TradeList (ORG-SRS-003)', () => {
  beforeEach(() => {
    listMock.mockReset();
    statusMock.mockReset();
  });

  afterEach(cleanup);

  it('renders loaded trades with status badge and detail links', async () => {
    listMock.mockResolvedValueOnce({ data: [tradeA, tradeB], total: 2, limit: 20, offset: 0 });
    render(<TradeList />);
    expect(await screen.findByText('Tho xay')).toBeTruthy();
    expect(screen.getByText('Tho son')).toBeTruthy();
    expect(screen.getByText('TR-001')).toBeTruthy();
    expect(screen.getAllByText('ACTIVE').length).toBeGreaterThan(0);
    expect(screen.getAllByText('INACTIVE').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Ngừng hoạt động' })).toBeTruthy(); // tradeA row
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeTruthy(); // tradeB row
  });

  it('shows empty state when no trade matches filter', async () => {
    listMock.mockResolvedValueOnce({ data: [], total: 0, limit: 20, offset: 0 });
    render(<TradeList />);
    expect(await screen.findByText(/Chưa có ngành nghề nào phù hợp bộ lọc/)).toBeTruthy();
  });

  it('shows 401 login link on session expiry', async () => {
    listMock.mockRejectedValueOnce({ status: 401, message: 'Phiên hết hạn' });
    render(<TradeList />);
    const alert401 = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Phiên hết hạn, vui lòng đăng nhập lại (401)'));
    expect(alert401.length).toBeGreaterThan(0);
  });

  it('shows 403 permission error with retry', async () => {
    listMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền truy cập' });
    render(<TradeList />);
    const alert403 = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('cần vai trò ADMIN (403)'));
    expect(alert403.length).toBeGreaterThan(0);
  });

  it('deactivate flow: confirm dialog -> PATCH /status -> row updated', async () => {
    listMock.mockResolvedValueOnce({ data: [tradeA], total: 1, limit: 20, offset: 0 });
    statusMock.mockResolvedValueOnce({ ...tradeA, status: 'INACTIVE', assignable: false });
    render(<TradeList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ngừng hoạt động' }));
    // confirm dialog mentions the trade
    expect(await screen.findByText(/Xác nhận chuyển trạng thái danh mục/)).toBeTruthy();
    fireEvent.click(screen.getByText('Xác nhận'));
    await waitFor(() => expect(statusMock).toHaveBeenCalledWith(tradeA.id, { status: 'INACTIVE' }));
    // row flipped to inactive
    await screen.findByText('Tho xay');
    expect(screen.queryByRole('button', { name: 'Ngừng hoạt động' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeTruthy();
  });

  it('deactivate in-use trade surfaces warning returned by API', async () => {
    listMock.mockResolvedValueOnce({ data: [tradeA], total: 1, limit: 20, offset: 0 });
    statusMock.mockResolvedValueOnce({
      ...tradeA,
      status: 'INACTIVE',
      assignable: false,
      warning: 'Danh mục đang được tham chiếu bởi resource/loại công việc/work order đang hiệu lực',
    });
    render(<TradeList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ngừng hoạt động' }));
    fireEvent.click(await screen.findByText('Xác nhận'));
    const warn = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('đang được tham chiếu'));
    expect(warn.length).toBeGreaterThan(0);
  });

  it('status change failure surfaces error message', async () => {
    listMock.mockResolvedValueOnce({ data: [tradeA], total: 1, limit: 20, offset: 0 });
    statusMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' });
    render(<TradeList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ngừng hoạt động' }));
    fireEvent.click(await screen.findByText('Xác nhận'));
    const err = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Không có quyền — cần ADMIN'));
    expect(err.length).toBeGreaterThan(0);
  });

  it('shows pagination controls when total exceeds page size', async () => {
    listMock.mockResolvedValueOnce({ data: [tradeA], total: 45, limit: 20, offset: 0 });
    render(<TradeList />);
    await screen.findByText('Tho xay');
    expect(screen.getByText(/Trang 1\/3/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sau' })).toBeTruthy();
    // Sau -> offset 20
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    expect(listMock.mock.calls[1][0]).toMatchObject({ offset: 20, limit: 20 });
  });
});
