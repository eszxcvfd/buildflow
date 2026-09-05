/**
 * DOM-level tests cho AuditLogList (IAM-SRS-008, GitHub issue #23).
 * Covers: loading → loaded rows (badge FAILED, 'Hệ thống' khi actor null), empty,
 * 403/401/generic error + retry, pagination (offset 0→20→40, disabled at bounds),
 * filter 'Lọc' (applies draft + reset offset), deep-link ?action= qua useSearchParams.
 * Không assert output toLocaleString('vi-VN') — chỉ assert marker ổn định.
 */
import * as React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { AuditLogList } from '@/features/audit-logs/components/AuditLogList';

const routerMock = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
let mockSearch = '';

jest.mock('next/navigation', () => ({
  __esModule: true,
  usePathname: () => '/',
  useRouter: () => routerMock,
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock('@/lib/api/audit-logs', () => ({
  __esModule: true,
  listAuditLogs: jest.fn(),
}));

import { listAuditLogs } from '@/lib/api/audit-logs';

const listMock = listAuditLogs as jest.Mock;

function makeLog(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'log-1',
    actorUserId: '0e9b6b9f-1111-4aaa-8ccc-123456789abc',
    action: 'AUTH_LOGIN_SUCCESS',
    entityType: 'User',
    entityId: '0e9b6b9f-1111-4aaa-8ccc-123456789abc',
    beforeData: null,
    afterData: null,
    reason: 'Sai mật khẩu',
    result: 'FAILED',
    ipAddress: '10.0.0.1',
    userAgent: 'jest',
    correlationId: '11111111-2222-4333-8444-555555555555',
    createdAt: '2026-02-01T07:30:00.000Z',
    ...overrides,
  };
}

function makePage(rows: number, total: number, offset: number, limit = 20) {
  return {
    data: Array.from({ length: rows }, (_, i) => makeLog({ id: `log-${offset + i}` })),
    total,
    limit,
    offset,
  };
}

describe('AuditLogList (IAM-SRS-008)', () => {
  beforeEach(() => {
    listMock.mockReset();
    routerMock.replace.mockClear();
    mockSearch = '';
  });

  afterEach(cleanup);

  it('hiển thị Đang tải… rồi render rows sau khi load', async () => {
    listMock.mockResolvedValueOnce(makePage(1, 1, 0));
    render(<AuditLogList />);
    expect(screen.getByText(/Đang tải/)).toBeTruthy();
    expect(await screen.findByText(/Tổng: 1 bản ghi/)).toBeTruthy();
    // action code xuất hiện cả trong <option> của select nên dùng getAllByText
    expect(screen.getAllByText('AUTH_LOGIN_SUCCESS').length).toBeGreaterThan(0);
  });

  it('rows: action code hiển thị, actor null → Hệ thống, StatusBadge FAILED (bf-badge-risk)', async () => {
    listMock.mockResolvedValueOnce({
      data: [
        makeLog({ id: 'log-1', actorUserId: null, action: 'AUTH_LOGIN_FAILED', result: 'FAILED' }),
        makeLog({ id: 'log-2', action: 'AUTH_LOGOUT', result: 'SUCCESS' }),
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });
    render(<AuditLogList />);
    expect(await screen.findByText('Hệ thống')).toBeTruthy();
    expect(screen.getAllByText('AUTH_LOGIN_FAILED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('FAILED').length).toBeGreaterThan(0);
    expect(document.querySelector('.bf-badge-risk')).toBeTruthy();
    expect(screen.getAllByText('AUTH_LOGOUT').length).toBeGreaterThan(0);
  });

  it('empty data → EmptyState tiêu đề', async () => {
    listMock.mockResolvedValueOnce({ data: [], total: 0, limit: 20, offset: 0 });
    render(<AuditLogList />);
    expect(await screen.findByText('Chưa có bản ghi nào phù hợp bộ lọc')).toBeTruthy();
  });

  it('403 → Alert info + EmptyState + nút Thử lại', async () => {
    listMock.mockRejectedValueOnce({ status: 403, message: 'Không có quyền' });
    render(<AuditLogList />);
    expect(await screen.findByText('Không có quyền truy cập — cần vai trò ADMIN (403)')).toBeTruthy();
    expect(screen.getByText('Bạn không thể xem nhật ký thao tác')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });

  it('401 → link Đến trang đăng nhập trỏ /login', async () => {
    listMock.mockRejectedValueOnce({ status: 401, message: 'Phiên hết hạn' });
    render(<AuditLogList />);
    const link = (await screen.findByText('Đến trang đăng nhập')) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('lỗi khác → Alert message + Thử lại gọi listAuditLogs lần nữa', async () => {
    listMock.mockRejectedValueOnce({ status: 500, message: 'Lỗi hệ thống' });
    listMock.mockResolvedValueOnce(makePage(1, 1, 0));
    render(<AuditLogList />);
    expect(await screen.findByText('Lỗi hệ thống')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => {
      expect(listMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(screen.getAllByText('AUTH_LOGIN_SUCCESS').length).toBeGreaterThan(0);
    });
  });

  it('pagination: total=45 → prev disabled, next → offset=20, hết trang → next disabled', async () => {
    listMock
      .mockResolvedValueOnce(makePage(20, 45, 0))
      .mockResolvedValueOnce(makePage(20, 45, 20))
      .mockResolvedValueOnce(makePage(5, 45, 40));
    render(<AuditLogList />);
    expect(await screen.findByText('Trang 1 / 3 (tổng 45)')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await screen.findByText('Trang 2 / 3 (tổng 45)');
    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20, limit: 20 }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await screen.findByText('Trang 3 / 3 (tổng 45)');
    expect((screen.getByRole('button', { name: 'Trang sau' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Trang trước' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('filter: chọn result FAILED + Lọc → gọi lại với result=FAILED và offset reset về 0', async () => {
    listMock.mockResolvedValue(makePage(20, 45, 0));
    render(<AuditLogList />);
    await screen.findByText('Trang 1 / 3 (tổng 45)');

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await screen.findByText('Trang 2 / 3 (tổng 45)');

    fireEvent.change(screen.getByLabelText('Kết quả'), { target: { value: 'FAILED' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lọc' }));

    await waitFor(() => {
      expect(listMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ result: 'FAILED', offset: 0 }),
      );
    });
  });

  it('deep link ?action=AUTH_LOGIN_FAILED → lần gọi đầu đã mang action', async () => {
    mockSearch = 'action=AUTH_LOGIN_FAILED';
    listMock.mockResolvedValueOnce(makePage(1, 1, 0));
    render(<AuditLogList />);
    await screen.findByText(/Tổng: 1 bản ghi/);
    await waitFor(() => {
      expect(listMock.mock.calls[0][0]).toMatchObject({ action: 'AUTH_LOGIN_FAILED' });
    });
    // draft select cũng được khởi tạo theo deep link
    expect((screen.getByLabelText('Hành động') as HTMLSelectElement).value).toBe('AUTH_LOGIN_FAILED');
  });

  it('deep link action ngoài KNOWN_ACTIONS → option bổ sung, select giữ giá trị (Finding 5)', async () => {
    mockSearch = 'action=IAM_PROFILE_UPDATED';
    listMock.mockResolvedValueOnce(makePage(1, 1, 0));
    render(<AuditLogList />);
    await screen.findByText(/Tổng: 1 bản ghi/);

    // Select hiển thị đúng action deep-link thay vì rơi về rỗng.
    const select = screen.getByLabelText('Hành động') as HTMLSelectElement;
    expect(select.value).toBe('IAM_PROFILE_UPDATED');
    expect(screen.getByRole('option', { name: 'IAM_PROFILE_UPDATED' })).toBeTruthy();

    // Lần gọi đầu vẫn mang action=IAM_PROFILE_UPDATED (hành vi không đổi).
    await waitFor(() => {
      expect(listMock.mock.calls[0][0]).toMatchObject({ action: 'IAM_PROFILE_UPDATED' });
    });
  });

  it('race: response cũ (call #1) về sau call #2 bị bỏ qua, không ghi đè dữ liệu mới (Finding 4)', async () => {
    let resolve1!: (page: unknown) => void;
    let resolve2!: (page: unknown) => void;
    const p1 = new Promise((r) => { resolve1 = r; });
    const p2 = new Promise((r) => { resolve2 = r; });
    listMock.mockImplementationOnce(() => p1).mockImplementationOnce(() => p2);

    // Hai request chồng nhau: StrictMode (React 18 dev) double-mount → effect chạy 2 lần
    // → 2 listAuditLogs đang in-flight. Form lọc không render khi loading nên không thể
    // tạo overlap qua UI; StrictMode tái hiện đúng kịch bản "response cũ về sau".
    render(
      <React.StrictMode>
        <AuditLogList />
      </React.StrictMode>,
    );
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));

    // Request MỚI (call #2) trả về trước → rows render theo response #2.
    await act(async () => {
      resolve2({
        data: [makeLog({ id: 'r2-1', action: 'AUTH_LOGOUT', result: 'SUCCESS', reason: 'REASON_PAGE_2' })],
        total: 7,
        limit: 20,
        offset: 0,
      });
    });
    expect(await screen.findByText(/Tổng: 7 bản ghi/)).toBeTruthy();
    expect(screen.getByText('REASON_PAGE_2')).toBeTruthy();

    // Response CŨ (call #1) về sau → bị bỏ qua: rows/page vẫn là của response #2.
    await act(async () => {
      resolve1({
        data: [makeLog({ id: 'r1-1', action: 'IAM_PROFILE_UPDATED', result: 'FAILED', reason: 'REASON_PAGE_1' })],
        total: 99,
        limit: 20,
        offset: 0,
      });
    });
    expect(screen.getByText(/Tổng: 7 bản ghi/)).toBeTruthy();
    expect(screen.getByText(/Trang 1 \/ 1 \(tổng 7\)/)).toBeTruthy();
    expect(screen.getByText('REASON_PAGE_2')).toBeTruthy();
    expect(screen.queryByText(/Tổng: 99 bản ghi/)).toBeNull();
    expect(screen.queryByText('REASON_PAGE_1')).toBeNull();
    expect(screen.queryByText('IAM_PROFILE_UPDATED')).toBeNull();
  });
});
