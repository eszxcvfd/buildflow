/**
 * DOM-level tests for WorkerDetail (ORG-SRS-001): detail render, status toggle flow,
 * confirm dialog, audit-note copy, permission errors.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { WorkerDetail } from '@/features/workers/components/WorkerDetail';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => routerMock }));

jest.mock('@/lib/api/workers', () => ({
  __esModule: true,
  getWorker: jest.fn(),
  updateWorker: jest.fn(),
}));

jest.mock('@/lib/api/admin-users', () => ({
  __esModule: true,
  updateAdminUserStatus: jest.fn(),
}));

// #26: WorkerDetail hiển thị tên ngành nghề thay UUID thô qua useTradeNames.
const tradeNames = new Map([['11111111-1111-4111-8111-111111111111', 'TR-001 — Tho xay']]);
jest.mock('@/features/workers/hooks/useTradeNames', () => ({
  useTradeNames: () => ({ names: tradeNames, loading: false, failed: false }),
}));

import { getWorker, updateWorker } from '@/lib/api/workers';
import { updateAdminUserStatus } from '@/lib/api/admin-users';

const getMock = getWorker as jest.Mock;
const updateMock = updateWorker as jest.Mock;
const statusMock = updateAdminUserStatus as jest.Mock;

const worker = {
  id: 'w-1',
  email: 'a@b.com',
  fullName: 'Nguyen Van Tho',
  phone: '0900000000',
  avatarUrl: null,
  employeeCode: 'EMP-1',
  userType: 'WORKER',
  contractorId: null,
  status: 'ACTIVE',
  trades: [{ tradeId: '11111111-1111-4111-8111-111111111111', skillLevel: 3 }],
  eligible: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('WorkerDetail (ORG-SRS-001)', () => {
  beforeEach(() => {
    getMock.mockReset();
    updateMock.mockReset();
    statusMock.mockReset();
  });

  afterEach(cleanup);

  it('renders worker details with eligible state', async () => {
    getMock.mockResolvedValueOnce(worker);
    render(<WorkerDetail id="w-1" />);
    expect(await screen.findByText('Nguyen Van Tho')).toBeTruthy();
    expect(screen.getByText('EMP-1')).toBeTruthy();
    expect(screen.getByText('Đủ điều kiện — cho phép phân công')).toBeTruthy();
    expect(screen.getByText('Chuyển sang Ngừng hoạt động')).toBeTruthy();
  });

  it('shows 404 with retry for unknown id', async () => {
    getMock.mockRejectedValueOnce({ status: 404, message: 'Không tìm thấy' });
    render(<WorkerDetail id="missing" />);
    const alert404 = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Không tìm thấy công nhân (404)'));
    expect(alert404.length).toBeGreaterThan(0);
  });

  it('status toggle: confirm -> PATCH admin status -> success note', async () => {
    getMock.mockResolvedValue(worker);
    statusMock.mockResolvedValueOnce({ id: 'w-1', status: 'INACTIVE' });
    render(<WorkerDetail id="w-1" />);
    fireEvent.click(await screen.findByText('Chuyển sang Ngừng hoạt động'));
    expect(await screen.findByText(/Xác nhận chuyển trạng thái từ ACTIVE sang INACTIVE/)).toBeTruthy();
    expect(screen.getByText(/chặn phân công mới/)).toBeTruthy();
    fireEvent.click(screen.getByText('Xác nhận'));
    await waitFor(() => expect(statusMock).toHaveBeenCalledWith('w-1', { status: 'INACTIVE' }));
    expect(await screen.findByText(/Đã chuyển sang Ngừng hoạt động/)).toBeTruthy();
    expect(screen.getByText('Kích hoạt lại')).toBeTruthy();
  });

  it('status toggle failure surfaces error', async () => {
    getMock.mockResolvedValue(worker);
    statusMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' });
    render(<WorkerDetail id="w-1" />);
    fireEvent.click(await screen.findByText('Chuyển sang Ngừng hoạt động'));
    fireEvent.click(screen.getByText('Xác nhận'));
    const alert403d = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Không có quyền — cần ADMIN'));
    expect(alert403d.length).toBeGreaterThan(0);
  });
});
