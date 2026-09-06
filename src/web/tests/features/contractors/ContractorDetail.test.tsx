/**
 * DOM-level tests cho ContractorDetail (ORG-SRS-002 + ORG-SRS-004 lifecycle, #27):
 * render chi tiết, lifecycle SUSPEND/TERMINATE với reason bắt buộc + open-work
 * warning, ACTIVATE, alreadyInState → info, lỗi 401/403/404, timeline audit.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { ContractorDetail } from '@/features/contractors/components/ContractorDetail';
import type { ApiError } from '@/lib/api/contractors';
import type { Contractor } from '@/lib/api/contractors';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => routerMock }));

jest.mock('@/lib/api/contractors', () => ({
  __esModule: true,
  getContractor: jest.fn(),
  changeContractorLifecycleStatus: jest.fn(),
  getContractorOpenWork: jest.fn(),
}));

jest.mock('@/lib/api/audit-logs', () => ({
  __esModule: true,
  listAuditLogs: jest.fn(),
}));

import { getContractor, changeContractorLifecycleStatus, getContractorOpenWork } from '@/lib/api/contractors';
import { listAuditLogs } from '@/lib/api/audit-logs';

const getMock = getContractor as jest.Mock;
const lifecycleMock = changeContractorLifecycleStatus as jest.Mock;
const openWorkMock = getContractorOpenWork as jest.Mock;
const auditMock = listAuditLogs as jest.Mock;

const CONTRACTOR_ID = '11111111-1111-4111-8111-111111111111';

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

function makeContractor(overrides: Partial<Contractor> = {}): Contractor {
  return {
    id: CONTRACTOR_ID,
    code: 'CTR-001',
    name: 'Alpha',
    contactName: 'Nguyen Van A',
    phone: '+84901234567',
    email: 'a@example.com',
    status: 'ACTIVE',
    scope: 'Thi cong phan tho',
    eligible: true,
    createdBy: 'u-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ContractorDetail (ORG-SRS-002 + #27)', () => {
  beforeEach(() => {
    getMock.mockReset();
    lifecycleMock.mockReset();
    openWorkMock.mockReset();
    auditMock.mockReset();
    // ORG-SRS-005 (#28): lifecycle buttons/edit/timeline là admin-only — seed
    // ADMIN để giữ intent admin-flow của suite này.
    seedAdminAuth();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('renders contractor details + lifecycle buttons + timeline section', async () => {
    getMock.mockResolvedValueOnce(makeContractor());
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    render(<ContractorDetail id={CONTRACTOR_ID} />);
    expect(await screen.findByText('Alpha')).toBeTruthy();
    expect(screen.getAllByText((_, el) => (el?.textContent ?? '').includes('CTR-001')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Tạm ngừng' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Chấm dứt' })).toBeTruthy();
    expect(screen.getByText('Lịch sử trạng thái')).toBeTruthy();
  });

  it('shows 401/403/404 states with retry', async () => {
    getMock.mockRejectedValueOnce({ status: 401, message: 'Phiên hết hạn' });
    const { unmount } = render(<ContractorDetail id={CONTRACTOR_ID} />);
    expect(await screen.findByText(/Phiên hết hạn, vui lòng đăng nhập lại \(401\)/)).toBeTruthy();
    unmount();

    getMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' });
    const { unmount: unmount2 } = render(<ContractorDetail id={CONTRACTOR_ID} />);
    expect(await screen.findByText(/Không có quyền truy cập — cần ADMIN hoặc PROJECT_MANAGER \(403\)/)).toBeTruthy();
    unmount2();

    getMock.mockRejectedValueOnce({ status: 404, message: 'Không tìm thấy' });
    render(<ContractorDetail id={CONTRACTOR_ID} />);
    expect(await screen.findByText(/Không tìm thấy nhà thầu \(404\)/)).toBeTruthy();
  });

  it('TERMINATE flow: pre-check open work → cảnh báo → reason bắt buộc → PATCH lifecycle → success note', async () => {
    getMock.mockResolvedValueOnce(makeContractor());
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    openWorkMock.mockResolvedValueOnce({ openAssignments: 4 });
    lifecycleMock.mockResolvedValueOnce({
      ...makeContractor({ status: 'INACTIVE', eligible: false }),
      alreadyInState: false,
      warning: { openAssignments: 4 },
    });
    render(<ContractorDetail id={CONTRACTOR_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chấm dứt' }));
    expect((await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('4 công việc/lịch mở'))).length).toBeGreaterThan(0);

    // reason bắt buộc — không nhập thì không gọi API
    fireEvent.click(screen.getByRole('button', { name: /xác nhận chấm dứt/i }));
    expect(screen.getByText('Lý do là bắt buộc khi tạm ngừng/chấm dứt')).toBeTruthy();
    expect(lifecycleMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: 'Hết hợp đồng tổng thầu' } });
    fireEvent.click(screen.getByRole('button', { name: /xác nhận chấm dứt/i }));
    await waitFor(() => expect(lifecycleMock).toHaveBeenCalledWith(CONTRACTOR_ID, { action: 'TERMINATE', reason: 'Hết hợp đồng tổng thầu' }));
    expect(await screen.findByText(/Chấm dứt thành công/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Kích hoạt lại' })).toBeTruthy();
  });

  it('SUSPEND without open work → no warning, success note', async () => {
    getMock.mockResolvedValueOnce(makeContractor());
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    openWorkMock.mockResolvedValueOnce({ openAssignments: 0 });
    lifecycleMock.mockResolvedValueOnce({
      ...makeContractor({ status: 'INACTIVE', eligible: false }),
      alreadyInState: false,
    });
    render(<ContractorDetail id={CONTRACTOR_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạm ngừng' }));
    fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: 'Nghỉ theo mùa' } });
    fireEvent.click(screen.getByRole('button', { name: /xác nhận tạm ngừng/i }));
    await waitFor(() => expect(lifecycleMock).toHaveBeenCalledWith(CONTRACTOR_ID, { action: 'SUSPEND', reason: 'Nghỉ theo mùa' }));
    expect(await screen.findByText(/Tạm ngừng thành công/)).toBeTruthy();
  });

  it('ACTIVATE (INACTIVE): không bắt buộc reason, gọi ACTIVATE', async () => {
    const inactive = makeContractor({ status: 'INACTIVE', eligible: false });
    getMock.mockResolvedValueOnce(inactive);
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    lifecycleMock.mockResolvedValueOnce({ ...inactive, status: 'ACTIVE', eligible: true, alreadyInState: false });
    render(<ContractorDetail id={CONTRACTOR_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Kích hoạt lại' }));
    fireEvent.click(screen.getByRole('button', { name: /xác nhận kích hoạt lại/i }));
    await waitFor(() => expect(lifecycleMock).toHaveBeenCalledWith(CONTRACTOR_ID, { action: 'ACTIVATE', reason: null }));
    expect(await screen.findByText(/Đã kích hoạt lại nhà thầu/)).toBeTruthy();
  });

  it('alreadyInState: true → info, không phải lỗi', async () => {
    const inactive = makeContractor({ status: 'INACTIVE', eligible: false });
    getMock.mockResolvedValueOnce(inactive);
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    lifecycleMock.mockResolvedValueOnce({ ...inactive, alreadyInState: true });
    render(<ContractorDetail id={CONTRACTOR_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Kích hoạt lại' }));
    fireEvent.click(screen.getByRole('button', { name: /xác nhận kích hoạt lại/i }));
    expect(await screen.findByText(/đã ở trạng thái hoạt động — không thay đổi gì thêm/)).toBeTruthy();
  });

  it('lifecycle 403 → server message trong dialog (cần ADMIN)', async () => {
    getMock.mockResolvedValueOnce(makeContractor());
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    openWorkMock.mockResolvedValueOnce({ openAssignments: 0 });
    lifecycleMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' } as ApiError);
    render(<ContractorDetail id={CONTRACTOR_ID} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Tạm ngừng' }));
    fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: 'Kiểm tra' } });
    fireEvent.click(screen.getByRole('button', { name: /xác nhận tạm ngừng/i }));
    const err = await screen.findAllByText((_, el) => (el?.textContent ?? '').includes('Không có quyền — cần ADMIN'));
    expect(err.length).toBeGreaterThan(0);
  });

  it('timeline: audit API với entityType CONTRACTOR, render action + reason', async () => {
    getMock.mockResolvedValueOnce(makeContractor());
    auditMock.mockResolvedValueOnce({
      data: [{
        id: 'log-1',
        actorUserId: 'u-admin',
        action: 'ORG_CONTRACTOR_SUSPENDED',
        entityType: 'CONTRACTOR',
        entityId: CONTRACTOR_ID,
        beforeData: null,
        afterData: null,
        reason: 'Vi phạm hợp đồng',
        result: 'SUCCESS',
        ipAddress: null,
        userAgent: null,
        correlationId: null,
        createdAt: '2026-02-01T07:30:00.000Z',
      }],
      total: 1,
      limit: 10,
      offset: 0,
    });
    render(<ContractorDetail id={CONTRACTOR_ID} />);
    await waitFor(() => expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'CONTRACTOR', entityId: CONTRACTOR_ID, limit: 10 }),
    ));
    expect((await screen.findAllByText('Tạm ngừng')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Lý do: Vi phạm hợp đồng/)).toBeTruthy();
    const link = screen.getByRole('link', { name: /Xem trên Nhật ký thao tác/ }) as HTMLAnchorElement;
    // B5 regression: link KHÔNG kèm action prefix (API audit exact-match → 0 dòng)
    expect(link.getAttribute('href')).toContain('entityType=CONTRACTOR');
    expect(link.getAttribute('href')).toContain('result=SUCCESS');
    expect(link.getAttribute('href')).not.toContain('action=');
  });

  it('timeline empty state', async () => {
    getMock.mockResolvedValueOnce(makeContractor());
    auditMock.mockResolvedValueOnce({ data: [], total: 0, limit: 10, offset: 0 });
    render(<ContractorDetail id={CONTRACTOR_ID} />);
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
    getMock.mockResolvedValueOnce(makeContractor());
    render(<ContractorDetail id={CONTRACTOR_ID} />);
    expect(await screen.findByText('Alpha')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tạm ngừng' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Chấm dứt' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sửa hồ sơ' })).toBeNull();
    expect(screen.getByText(/cần quyền ADMIN — tài khoản hiện tại chỉ xem/)).toBeTruthy();
    expect(screen.getByText(/Lịch sử trạng thái chỉ dành cho ADMIN/)).toBeTruthy();
    expect(auditMock).not.toHaveBeenCalled();
  });
});