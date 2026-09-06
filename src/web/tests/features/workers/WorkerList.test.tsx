/**
 * DOM-level tests for WorkerList (ORG-SRS-001 + ORG-SRS-004 lifecycle, issue #27).
 * Covers: loading, list rendering with status + eligible flag, lifecycle action
 * flow (SUSPEND/TERMINATE confirm dialog có reason bắt buộc + pre-check open-work
 * warning; ACTIVATE), alreadyInState → info không lỗi, 401/403/generic error.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { WorkerList } from '@/features/workers/components/WorkerList';
import type { ApiError } from '@/lib/api/workers';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => routerMock }));

jest.mock('@/lib/api/workers', () => ({
  __esModule: true,
  listWorkers: jest.fn(),
  changeWorkerLifecycleStatus: jest.fn(),
  getWorkerOpenWork: jest.fn(),
}));

// #26: WorkerList hiển thị tên ngành nghề thay UUID thô qua useTradeNames.
const tradeNames = new Map([['11111111-1111-4111-8111-111111111111', 'TR-001 — Tho xay']]);
jest.mock('@/features/workers/hooks/useTradeNames', () => ({
  useTradeNames: () => ({ names: tradeNames, loading: false, failed: false }),
}));

import { listWorkers, changeWorkerLifecycleStatus, getWorkerOpenWork } from '@/lib/api/workers';

const listMock = listWorkers as jest.Mock;
const lifecycleMock = changeWorkerLifecycleStatus as jest.Mock;
const openWorkMock = getWorkerOpenWork as jest.Mock;

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

const LOCKED_REASON = 'Lý do là bắt buộc khi tạm ngừng/chấm dứt';

/** ORG-SRS-005 (#28): seed session ADMIN — lifecycle buttons là admin-only. */
function seedAdminAuth() {
  window.localStorage.setItem(
    'buildflow.auth.v1',
    JSON.stringify({
      accessToken: 'jwt-test',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      user: { id: 'u-admin', email: 'admin@example.com', fullName: 'Admin', status: 'ACTIVE', userType: 'STAFF' },
      roles: [{ id: 'r-1', code: 'ADMIN', name: 'Admin' }],
      projectIds: [],
    }),
  );
}

describe('WorkerList (ORG-SRS-001 + #27)', () => {
  beforeEach(() => {
    listMock.mockReset();
    lifecycleMock.mockReset();
    openWorkMock.mockReset();
    // ORG-SRS-005 (#28): lifecycle buttons là admin-only — seed ADMIN để giữ
    // intent admin-flow của suite này.
    seedAdminAuth();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('renders loaded workers with status, eligible flag and lifecycle action links', async () => {
    listMock.mockResolvedValueOnce({ data: [workerA, workerB], total: 2, limit: 20, offset: 0 });
    render(<WorkerList />);
    expect(await screen.findByText('Nguyen Van Tho')).toBeTruthy();
    expect(screen.getByText('Tran Thi Tho')).toBeTruthy();
    expect(screen.getByText('Đang hoạt động')).toBeTruthy();
    expect(screen.getByText('Không hoạt động (không nhận việc mới)')).toBeTruthy();
    expect(screen.getByText('Không nhận việc mới')).toBeTruthy();
    // ACTIVE row: SUSPEND + TERMINATE buttons
    expect(screen.getByRole('button', { name: 'Tạm ngừng' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chấm dứt' })).toBeTruthy();
    // INACTIVE row: ACTIVATE
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeTruthy();
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
    const alert403l = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('cần vai trò ADMIN hoặc PROJECT_MANAGER (403)'));
    expect(alert403l.length).toBeGreaterThan(0);
  });

  it('SUSPEND flow: pre-check open work → cảnh báo ảnh hưởng → reason bắt buộc → PATCH lifecycle', async () => {
    listMock.mockResolvedValueOnce({ data: [workerA], total: 1, limit: 20, offset: 0 });
    openWorkMock.mockResolvedValueOnce({ openAssignments: 3 });
    lifecycleMock.mockResolvedValueOnce({
      ...workerA,
      status: 'INACTIVE',
      eligible: false,
      alreadyInState: false,
      warning: { openAssignments: 3 },
    });
    render(<WorkerList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạm ngừng' }));

    // dialog có pre-check + cảnh báo ảnh hưởng (text bị ngắt bởi <strong> nên match theo
    // function chứ không match chuỗi liền)
    expect((await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('đang có') && (el?.textContent ?? '').includes('3 công việc/lịch mở'))).length).toBeGreaterThan(0);
    expect(screen.getByText(/lịch sử đã phát sinh vẫn được giữ nguyên/i)).toBeTruthy();
    // lý do bắt buộc: submit rỗng → lỗi field, không gọi API
    fireEvent.click(screen.getByRole('button', { name: /xác nhận tạm ngừng/i }));
    expect(screen.getByText(LOCKED_REASON)).toBeTruthy();
    expect(lifecycleMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: 'Hết mùa cao điểm' } });
    fireEvent.click(screen.getByRole('button', { name: /xác nhận tạm ngừng/i }));

    await waitFor(() => expect(lifecycleMock).toHaveBeenCalledWith('w-1', { action: 'SUSPEND', reason: 'Hết mùa cao điểm' }));
    // row updated: eligible flag flips + thông báo có open work
    expect(await screen.findByText(/Worker đang có 3 công việc\/lịch mở/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tạm ngừng' })).toBeNull();
    expect(screen.queryByText(LOCKED_REASON)).toBeNull();
  });

  it('ACTIVATE flow không cần reason và cập nhật lại danh sách', async () => {
    listMock.mockResolvedValueOnce({ data: [workerB], total: 1, limit: 20, offset: 0 });
    lifecycleMock.mockResolvedValueOnce({ ...workerB, status: 'ACTIVE', eligible: true, alreadyInState: false });
    render(<WorkerList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Kích hoạt lại' }));
    // dialog không bắt buộc lý do — có thể xác nhận ngay
    fireEvent.click(screen.getByRole('button', { name: /xác nhận kích hoạt lại/i }));
    await waitFor(() => expect(lifecycleMock).toHaveBeenCalledWith('w-2', { action: 'ACTIVATE', reason: null }));
    expect(await screen.findByText(/Đã kích hoạt lại worker/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạm ngừng' })).toBeTruthy();
  });

  it('alreadyInState: true từ API → info, không báo lỗi', async () => {
    listMock.mockResolvedValueOnce({ data: [workerB], total: 1, limit: 20, offset: 0 });
    lifecycleMock.mockResolvedValueOnce({ ...workerB, alreadyInState: true });
    render(<WorkerList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Kích hoạt lại' }));
    fireEvent.click(screen.getByRole('button', { name: /xác nhận kích hoạt lại/i }));
    const info = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('đã ở trạng thái hoạt động'));
    expect(info.length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert', { hidden: true })).toBeNull();
  });

  it('TERMINATE thiếu lý do từ API → lỗi hiện theo field reason trong dialog', async () => {
    listMock.mockResolvedValueOnce({ data: [workerA], total: 1, limit: 20, offset: 0 });
    openWorkMock.mockResolvedValueOnce({ openAssignments: 0 });
    lifecycleMock.mockRejectedValueOnce({
      status: 400,
      message: LOCKED_REASON,
      fieldErrors: { reason: [LOCKED_REASON] },
    } as ApiError);
    render(<WorkerList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chấm dứt' }));
    fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /xác nhận chấm dứt/i }));
    await waitFor(() => expect(lifecycleMock).toHaveBeenCalledTimes(1));
    const err = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes(LOCKED_REASON));
    expect(err.length).toBeGreaterThan(0);
  });

  it('status change failure surfaces server message (403 → cần ADMIN)', async () => {
    listMock.mockResolvedValueOnce({ data: [workerA], total: 1, limit: 20, offset: 0 });
    openWorkMock.mockResolvedValueOnce({ openAssignments: 0 });
    lifecycleMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' } as ApiError);
    render(<WorkerList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạm ngừng' }));
    fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: 'Kiểm tra' } });
    fireEvent.click(screen.getByRole('button', { name: /xác nhận tạm ngừng/i }));
    const alert403b = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Không có quyền — cần ADMIN'));
    expect(alert403b.length).toBeGreaterThan(0);
  });

  it('pre-check open work thất bại → dialog vẫn dùng được (cảnh báo từ response sau transition)', async () => {
    listMock.mockResolvedValueOnce({ data: [workerA], total: 1, limit: 20, offset: 0 });
    openWorkMock.mockRejectedValueOnce({ status: 500, message: 'Lỗi hệ thống' } as ApiError);
    lifecycleMock.mockResolvedValueOnce({
      ...workerA,
      status: 'INACTIVE',
      eligible: false,
      alreadyInState: false,
      warning: { openAssignments: 1 },
    });
    render(<WorkerList />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chấm dứt' }));
    expect(await screen.findByText(/Chưa kiểm tra được công việc\/lịch đang mở/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: 'Đóng cửa cơ sở' } });
    fireEvent.click(screen.getByRole('button', { name: /xác nhận chấm dứt/i }));
    await waitFor(() => expect(lifecycleMock).toHaveBeenCalledWith('w-1', { action: 'TERMINATE', reason: 'Đóng cửa cơ sở' }));
    expect(await screen.findByText(/Worker đang có 1 công việc\/lịch mở/)).toBeTruthy();
    expect(screen.queryByText('Đang xử lý…')).toBeNull();
  });
});