/**
 * DOM-level tests for WorkerDetail (ORG-SRS-001 + ORG-SRS-004 lifecycle, issue #27):
 * detail render, status lifecycle flow (SUSPEND/TERMINATE với reason + open-work
 * warning; ACTIVATE), alreadyInState info, permission errors, timeline section
 * ('Lịch sử trạng thái') render qua audit API.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { WorkerDetail } from '@/features/workers/components/WorkerDetail';
import type { ApiError } from '@/lib/api/workers';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => routerMock }));

jest.mock('@/lib/api/workers', () => ({
  __esModule: true,
  getWorker: jest.fn(),
  updateWorker: jest.fn(),
  changeWorkerLifecycleStatus: jest.fn(),
  getWorkerOpenWork: jest.fn(),
}));

jest.mock('@/lib/api/audit-logs', () => ({
  __esModule: true,
  listAuditLogs: jest.fn(),
}));

// ORG-SRS-008 (issue #31): 'Điều kiện phân công' boolean cũ đã gộp vào
// EligibilityChecklist qua GET /api/v1/eligibility/workers/:id.
jest.mock('@/lib/api/eligibility', () => ({
  __esModule: true,
  checkWorkerEligibility: jest.fn(),
  checkCrewEligibility: jest.fn(),
  checkMyEligibility: jest.fn(),
}));

// #26: WorkerDetail hiển thị tên ngành nghề thay UUID thô qua useTradeNames.
const tradeNames = new Map([['11111111-1111-4111-8111-111111111111', 'TR-001 — Tho xay']]);
jest.mock('@/features/workers/hooks/useTradeNames', () => ({
  useTradeNames: () => ({ names: tradeNames, loading: false, failed: false }),
}));

import { getWorker, updateWorker, changeWorkerLifecycleStatus, getWorkerOpenWork } from '@/lib/api/workers';
import { listAuditLogs } from '@/lib/api/audit-logs';
import { checkWorkerEligibility } from '@/lib/api/eligibility';

const getMock = getWorker as jest.Mock;
const updateMock = updateWorker as jest.Mock;
const lifecycleMock = changeWorkerLifecycleStatus as jest.Mock;
const openWorkMock = getWorkerOpenWork as jest.Mock;
const auditMock = listAuditLogs as jest.Mock;
const eligibilityMock = checkWorkerEligibility as jest.Mock;

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

/** ORG-SRS-005 (#28): seed session ADMIN — lifecycle/edit/timeline là admin-only. */
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

function makeAuditLog(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'log-1',
    actorUserId: '11111111-1111-4111-8111-222222222222',
    action: 'ORG_WORKER_SUSPENDED',
    entityType: 'WORKER',
    entityId: 'w-1',
    beforeData: null,
    afterData: null,
    reason: 'Hết mùa cao điểm',
    result: 'SUCCESS',
    ipAddress: null,
    userAgent: null,
    correlationId: null,
    createdAt: '2026-02-01T07:30:00.000Z',
    ...overrides,
  };
}

describe('WorkerDetail (ORG-SRS-001 + #27)', () => {
  beforeEach(() => {
    getMock.mockReset();
    updateMock.mockReset();
    lifecycleMock.mockReset();
    openWorkMock.mockReset();
    auditMock.mockReset();
    eligibilityMock.mockReset();
    // Mặc định checklist có dữ liệu để các flow lifecycle/timeline không bị
    // nhiễu bởi fetch thật (jsdom không mock fetch ở suite này).
    eligibilityMock.mockResolvedValue({
      resourceType: 'WORKER',
      resourceId: 'w-1',
      eligible: true,
      checkedAt: '2026-02-01T08:00:00.000Z',
      correlationId: 'corr-default',
      conditions: [],
      crews: [],
    });
    // ORG-SRS-005 (#28): lifecycle buttons/edit/timeline là admin-only — seed
    // ADMIN để giữ intent admin-flow của suite này.
    seedAdminAuth();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('renders worker details with eligibility checklist and lifecycle buttons', async () => {
    getMock.mockResolvedValueOnce(worker);
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    eligibilityMock.mockResolvedValueOnce({
      resourceType: 'WORKER',
      resourceId: 'w-1',
      eligible: true,
      checkedAt: '2026-02-01T08:00:00.000Z',
      correlationId: 'corr-w-1',
      conditions: [
        { code: 'RESOURCE_ACTIVE', passed: true, reasonCode: 'OK', detail: 'Hồ sơ worker đang hiệu lực' },
        { code: 'TRADE_SKILL_MATCH', passed: null, reasonCode: 'NOT_REQUESTED', detail: 'Không yêu cầu kiểm tra ngành nghề' },
        { code: 'TRADE_CAPABILITY_DATA', passed: true, reasonCode: 'OK', detail: 'Worker có 1 ngành nghề hiệu lực' },
        { code: 'WORKLOAD', passed: true, reasonCode: 'OK', detail: 'Đang có 0 công việc mở' },
        { code: 'SCHEDULE_CONFLICT', passed: null, reasonCode: 'NOT_EVALUABLE', detail: 'Chưa có dữ liệu work-order' },
      ],
      crews: [],
    });
    render(<WorkerDetail id="w-1" />);
    expect(await screen.findByText('Nguyen Van Tho')).toBeTruthy();
    expect(screen.getByText('EMP-1')).toBeTruthy();
    // ORG-SRS-008: nguồn duy nhất là checklist (không còn boolean-only cũ).
    expect(await screen.findByText('Điều kiện nhận việc')).toBeTruthy();
    expect(screen.getByText('Đủ điều kiện')).toBeTruthy();
    expect(screen.getByText(/Mã đối chiếu: corr-w-1/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạm ngừng' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chấm dứt' })).toBeTruthy();
    // timeline section present
    expect(screen.getByText('Lịch sử trạng thái')).toBeTruthy();
  });

  it('shows 404 with retry for unknown id', async () => {
    getMock.mockRejectedValueOnce({ status: 404, message: 'Không tìm thấy' });
    render(<WorkerDetail id="missing" />);
    const alert404 = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Không tìm thấy công nhân (404)'));
    expect(alert404.length).toBeGreaterThan(0);
  });

  it('lifecycle SUSPEND: pre-check open work → cảnh báo → reason bắt buộc → PATCH /status → success', async () => {
    getMock.mockResolvedValue(worker);
    auditMock.mockResolvedValue({ data: [], total: 0, limit: 10, offset: 0 });
    openWorkMock.mockResolvedValueOnce({ openAssignments: 2 });
    lifecycleMock.mockResolvedValueOnce({
      ...worker,
      status: 'INACTIVE',
      eligible: false,
      alreadyInState: false,
      warning: { openAssignments: 2 },
    });
    render(<WorkerDetail id="w-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạm ngừng' }));
    expect((await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('2 công việc/lịch mở'))).length).toBeGreaterThan(0);

    // reason required before submit
    fireEvent.click(screen.getByRole('button', { name: /xác nhận tạm ngừng/i }));
    expect(screen.getByText('Lý do là bắt buộc khi tạm ngừng/chấm dứt')).toBeTruthy();
    expect(lifecycleMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: 'Hết việc' } });
    fireEvent.click(screen.getByRole('button', { name: /xác nhận tạm ngừng/i }));
    await waitFor(() => expect(lifecycleMock).toHaveBeenCalledWith('w-1', { action: 'SUSPEND', reason: 'Hết việc' }));
    expect(await screen.findByText(/Tạm ngừng thành công/)).toBeTruthy();
    expect(screen.getByText(/đang có 2 công việc\/lịch mở/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeTruthy();
  });

  it('ACTIVATE (INACTIVE worker): dialog không bắt buộc lý do, PATCH ACTIVATE', async () => {
    const inactiveWorker = { ...worker, status: 'INACTIVE', eligible: false };
    getMock.mockResolvedValueOnce(inactiveWorker);
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    lifecycleMock.mockResolvedValueOnce({ ...inactiveWorker, status: 'ACTIVE', eligible: true, alreadyInState: false });
    render(<WorkerDetail id="w-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Kích hoạt lại' }));
    fireEvent.click(screen.getByRole('button', { name: /xác nhận kích hoạt lại/i }));
    await waitFor(() => expect(lifecycleMock).toHaveBeenCalledWith('w-1', { action: 'ACTIVATE', reason: null }));
    expect(await screen.findByText(/Đã kích hoạt lại worker/)).toBeTruthy();
  });

  it('alreadyInState: true → thông tin, không phải lỗi', async () => {
    const inactiveWorker = { ...worker, status: 'INACTIVE', eligible: false };
    getMock.mockResolvedValueOnce(inactiveWorker);
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    lifecycleMock.mockResolvedValueOnce({ ...inactiveWorker, alreadyInState: true });
    render(<WorkerDetail id="w-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Kích hoạt lại' }));
    fireEvent.click(screen.getByRole('button', { name: /xác nhận kích hoạt lại/i }));
    expect(await screen.findByText(/đã ở trạng thái hoạt động — không thay đổi gì thêm/)).toBeTruthy();
  });

  it('lifecycle failure surfaces server field error (reason) inside dialog', async () => {
    getMock.mockResolvedValueOnce(worker);
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    openWorkMock.mockResolvedValueOnce({ openAssignments: 0 });
    lifecycleMock.mockRejectedValueOnce({
      status: 400,
      message: 'Lý do là bắt buộc khi tạm ngừng/chấm dứt',
      fieldErrors: { reason: ['Lý do là bắt buộc khi tạm ngừng/chấm dứt'] },
    } as ApiError);
    render(<WorkerDetail id="w-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chấm dứt' }));
    fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /xác nhận chấm dứt/i }));
    const err = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Lý do là bắt buộc khi tạm ngừng/chấm dứt'));
    expect(err.length).toBeGreaterThan(0);
  });

  it('status change 403 surfaces ADMIN message', async () => {
    getMock.mockResolvedValueOnce(worker);
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    openWorkMock.mockResolvedValueOnce({ openAssignments: 0 });
    lifecycleMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' } as ApiError);
    render(<WorkerDetail id="w-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạm ngừng' }));
    fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: 'Kiểm tra' } });
    fireEvent.click(screen.getByRole('button', { name: /xác nhận tạm ngừng/i }));
    const err403 = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Không có quyền — cần ADMIN'));
    expect(err403.length).toBeGreaterThan(0);
  });

  it('timeline: audit API được gọi với entityType WORKER + entityId, render action/reason/actor', async () => {
    getMock.mockResolvedValueOnce(worker);
    auditMock.mockResolvedValueOnce({
      data: [makeAuditLog({ id: 'log-1' })],
      total: 1,
      limit: 10,
      offset: 0,
    });
    render(<WorkerDetail id="w-1" />);
    expect(await screen.findByText('Nguyen Van Tho')).toBeTruthy();
    await waitFor(() => expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'WORKER', entityId: 'w-1', limit: 10, result: 'SUCCESS' }),
    ));
    // lifecycle row: action label + reason + actor (button 'Tạm ngừng' cũng tồn tại → đếm text)
    expect((await screen.findAllByText('Tạm ngừng')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Lý do: Hết mùa cao điểm/)).toBeTruthy();
    // link xem tất cả trên audit logs
    const allLink = screen.getByRole('link', { name: /Xem trên Nhật ký thao tác/ }) as HTMLAnchorElement;
    expect(allLink.getAttribute('href')).toContain('/admin/audit-logs?entityType=WORKER');
    expect(allLink.getAttribute('href')).toContain('entityId=w-1');
    // B5 regression: link KHÔNG kèm action prefix (API audit exact-match → 0 dòng)
    expect(allLink.getAttribute('href')).toContain('result=SUCCESS');
    expect(allLink.getAttribute('href')).not.toContain('action=');
  });

  it('timeline empty state khi chưa có bản ghi', async () => {
    getMock.mockResolvedValueOnce(worker);
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    render(<WorkerDetail id="w-1" />);
    expect(await screen.findByText('Chưa có lịch sử thay đổi trạng thái')).toBeTruthy();
  });

  it('ORG-SRS-005 (#28): PROJECT_MANAGER đọc được nhưng ẩn lifecycle buttons/edit/timeline', async () => {
    window.localStorage.setItem(
      'buildflow.auth.v1',
      JSON.stringify({
        accessToken: 'jwt-test',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        user: { id: 'u-pm', email: 'pm@example.com', fullName: 'PM', status: 'ACTIVE', userType: 'STAFF' },
        roles: [{ id: 'r-2', code: 'PROJECT_MANAGER', name: 'PM' }],
        projectIds: [],
      }),
    );
    getMock.mockResolvedValueOnce(worker);
    render(<WorkerDetail id="w-1" />);
    expect(await screen.findByText('Nguyen Van Tho')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tạm ngừng' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Chấm dứt' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sửa hồ sơ' })).toBeNull();
    expect(screen.getByText(/cần quyền ADMIN — tài khoản hiện tại chỉ xem/)).toBeTruthy();
    expect(screen.getByText(/Lịch sử trạng thái chỉ dành cho ADMIN/)).toBeTruthy();
    expect(auditMock).not.toHaveBeenCalled();
  });
});