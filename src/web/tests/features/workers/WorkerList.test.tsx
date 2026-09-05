/**
 * DOM-level tests for WorkerList (ORG-SRS-001).
 * Covers: loading, list rendering with status + eligible flag, status change flow
 * (confirm -> PATCH admin users status -> UI update), 403 permission, action error.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { WorkerList } from '@/features/workers/components/WorkerList';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => routerMock }));

jest.mock('@/lib/api/workers', () => ({
  __esModule: true,
  listWorkers: jest.fn(),
}));

jest.mock('@/lib/api/admin-users', () => ({
  __esModule: true,
  updateAdminUserStatus: jest.fn(),
}));

// #26: WorkerList hiển thị tên ngành nghề thay UUID thô qua useTradeNames.
const tradeNames = new Map([['11111111-1111-4111-8111-111111111111', 'TR-001 — Tho xay']]);
jest.mock('@/features/workers/hooks/useTradeNames', () => ({
  useTradeNames: () => ({ names: tradeNames, loading: false, failed: false }),
}));

import { listWorkers } from '@/lib/api/workers';
import { updateAdminUserStatus } from '@/lib/api/admin-users';

const listMock = listWorkers as jest.Mock;
const statusMock = updateAdminUserStatus as jest.Mock;

const workerA = {
  id: 'w-1',
  email: 'a@b.com',
  fullName: 'Nguyen Van Tho',
  phone: null,
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

const workerB = {
  ...workerA,
  id: 'w-2',
  email: 'b@b.com',
  fullName: 'Tran Thi Tho',
  status: 'INACTIVE',
  eligible: false,
};

describe('WorkerList (ORG-SRS-001)', () => {
  beforeEach(() => {
    listMock.mockReset();
    statusMock.mockReset();
  });

  afterEach(cleanup);

  it('renders loaded workers with status, eligible flag and action links', async () => {
    listMock.mockResolvedValueOnce({ data: [workerA, workerB], total: 2, limit: 20, offset: 0 });
    render(<WorkerList />);
    expect(await screen.findByText('Nguyen Van Tho')).toBeTruthy();
    expect(screen.getByText('Tran Thi Tho')).toBeTruthy();
    expect(screen.getByText('Đủ điều kiện phân công')).toBeTruthy();
    expect(screen.getByText('Không đủ điều kiện (inactive/locked)')).toBeTruthy();
    expect(screen.getByText('Chặn phân công')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ngừng hoạt động' })).toBeTruthy(); // action on workerA row
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeTruthy(); // action on workerB row
  });

  it('shows empty state when no workers match filter', async () => {
    listMock.mockResolvedValueOnce({ data: [], total: 0, limit: 20, offset: 0 });
    render(<WorkerList />);
    expect(await screen.findByText(/Chưa có worker nào phù hợp bộ lọc/)).toBeTruthy();
  });

  it('shows 401 login link on session expiry', async () => {
    listMock.mockRejectedValueOnce({ status: 401, message: 'Phiên hết hạn' });
    render(<WorkerList />);
    const alert401 = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Phiên hết hạn, vui lòng đăng nhập lại (401)'));
    expect(alert401.length).toBeGreaterThan(0);
  });

  it('shows 403 permission error with retry', async () => {
    listMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền truy cập' });
    render(<WorkerList />);
    const alert403l = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('cần vai trò ADMIN (403)'));
    expect(alert403l.length).toBeGreaterThan(0);
  });

  it('status change: confirm -> PATCH admin status -> row updates', async () => {
    listMock.mockResolvedValueOnce({ data: [workerA], total: 1, limit: 20, offset: 0 });
    statusMock.mockResolvedValueOnce({ id: 'w-1', status: 'INACTIVE' });
    render(<WorkerList />);
    const btn = await screen.findByRole('button', { name: 'Ngừng hoạt động' });
    fireEvent.click(btn);
    // confirm dialog appears
    const confirmBtn = await screen.findByText('Xác nhận');
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(statusMock).toHaveBeenCalledWith('w-1', { status: 'INACTIVE' }));
    // row updated: eligible flag flips
    await screen.findByText('Không đủ điều kiện (inactive/locked)');
    expect(screen.queryByText('Xác nhận')).toBeNull();
  });

  it('status change failure surfaces error message', async () => {
    listMock.mockResolvedValueOnce({ data: [workerA], total: 1, limit: 20, offset: 0 });
    statusMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' });
    render(<WorkerList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Ngừng hoạt động' }));
    fireEvent.click(await screen.findByText('Xác nhận'));
    const alert403b = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Không có quyền — cần ADMIN'));
    expect(alert403b.length).toBeGreaterThan(0);
  });
});
