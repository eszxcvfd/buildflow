'use client';

import * as React from 'react';
import {
  searchWorkOrders,
  type ApiError,
  type WorkOrder,
  type WorkOrderListStatus,
} from '@/lib/api/work-orders';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Select } from '@/components/ui/select/Select';
import { Tooltip } from '@/components/ui/tooltip/Tooltip';
import {
  ClearFiltersButton,
  ListPagination,
  ListToolbar,
  SearchField,
} from '@/components/ui/list/ListKit';

const PAGE_SIZE = 20;

const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  READY: 'Sẵn sàng',
  OPEN: 'Mở',
  ASSIGNED: 'Đã gán',
  IN_PROGRESS: 'Đang làm',
  WORK_DONE: 'Hoàn tất',
  CLOSED: 'Đóng',
  CANCELLED: 'Hủy',
};

/**
 * Badge class theo trạng thái (DRAFT nháp xám, READY sẵn sàng xanh nhạt,
 * OPEN mở xanh, ASSIGNED đã gán, IN_PROGRESS đang làm, WORK_DONE hoàn tất
 * xanh, CLOSED đóng xám, CANCELLED hủy đỏ).
 */
const WORK_ORDER_STATUS_BADGES: Record<string, string> = {
  DRAFT: 'bf-badge-idle',
  READY: 'bf-badge-info',
  OPEN: 'bf-badge-busy',
  ASSIGNED: 'bf-badge-info',
  IN_PROGRESS: 'bf-badge-busy',
  WORK_DONE: 'bf-badge-ok',
  CLOSED: 'bf-badge-idle',
  CANCELLED: 'bf-badge-risk',
};

const WORK_ORDER_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Thấp',
  NORMAL: 'Thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'DRAFT', label: 'Nháp' },
  { value: 'READY', label: 'Sẵn sàng' },
  { value: 'OPEN', label: 'Mở' },
  { value: 'ASSIGNED', label: 'Đã gán' },
  { value: 'IN_PROGRESS', label: 'Đang làm' },
  { value: 'WORK_DONE', label: 'Hoàn tất' },
  { value: 'CLOSED', label: 'Đóng' },
  { value: 'CANCELLED', label: 'Hủy' },
];

const KNOWN_STATUSES = new Set(Object.keys(WORK_ORDER_STATUS_LABELS));

export interface WorkOrdersListProps {
  /** Deep-link từ ProjectDetail (`/work-orders?projectId=<id>`): cố định scope 1 dự án. */
  initialProjectId?: string;
  /** Deep-link `?status=` (chỉ nhận 8 giá trị, lạ → ALL). */
  initialStatus?: string;
}

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

export function WorkOrdersList({ initialProjectId, initialStatus }: WorkOrdersListProps = {}) {
  const [items, setItems] = React.useState<WorkOrder[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<WorkOrderListStatus | 'ALL'>(
    initialStatus && KNOWN_STATUSES.has(initialStatus.toUpperCase())
      ? (initialStatus.toUpperCase() as WorkOrderListStatus)
      : 'ALL',
  );
  const [offset, setOffset] = React.useState(0);

  const projectId = initialProjectId?.trim() ? initialProjectId.trim() : undefined;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchWorkOrders({
        projectId,
        search: search.trim() || undefined,
        status: statusFilter,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [projectId, search, statusFilter, offset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRetry() {
    void load();
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải danh sách công việc…</p>
      </Card>
    );
  }

  if (error) {
    if (error.status === 401) {
      return (
        <Card>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/login">Đến trang đăng nhập</a>
          </div>
        </Card>
      );
    }
    if (error.status === 403) {
      return (
        <Card>
          <Alert tone="error">Không có quyền truy cập — cần là thành viên dự án chứa công việc này (403)</Alert>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Tài khoản hiện tại không phải thành viên của dự án được lọc, hoặc đã bị thu hồi quyền.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách công việc'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const hasActiveFilter = search.trim() !== '' || statusFilter !== 'ALL';

  function handleClearFilters() {
    setSearch('');
    setStatusFilter('ALL');
    setOffset(0);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <ListToolbar count={`Tổng: ${total} công việc · Hiển thị ${items.length}`}>
          <SearchField
            id="workorder-search"
            label="Tìm kiếm"
            placeholder="Mã hoặc tiêu đề công việc…"
            value={search}
            onChange={(v) => { setSearch(v); setOffset(0); }}
            onSubmit={() => { setOffset(0); void load(); }}
          />
          <div className="bf-filter">
            <Select
              id="workorder-status"
              label="Trạng thái"
              hideLabel
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => { setStatusFilter(v as WorkOrderListStatus | 'ALL'); setOffset(0); }}
            />
          </div>
          <Button variant="secondary" onClick={() => { setOffset(0); void load(); }}>Tìm</Button>
          {hasActiveFilter ? <ClearFiltersButton onClear={handleClearFilters} /> : null}
        </ListToolbar>
        {projectId ? (
          <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
            Đang lọc theo dự án <span className="bf-chip">{shortId(projectId)}</span> —{' '}
            <a href="/work-orders">xem tất cả công việc</a>.
          </p>
        ) : (
          <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
            Chỉ hiển thị công việc của các dự án bạn là thành viên; quản trị viên thấy tất cả.
          </p>
        )}
      </Card>

      {items.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có công việc nào phù hợp bộ lọc">
            Thử thay đổi từ khóa hoặc trạng thái; công việc mới được tạo từ trang chi tiết dự án.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Tiêu đề</th>
                  <th>Dự án</th>
                  <th>Loại công việc</th>
                  <th>Trạng thái</th>
                  <th>Ưu tiên</th>
                  <th>Cập nhật</th>
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {items.map((wo) => (
                  <tr key={wo.id}>
                    <td>
                      <a href={`/work-orders/${wo.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                        {wo.title}
                      </a>{' '}
                      <span className="bf-chip">{wo.code}</span>
                    </td>
                    <td style={{ color: '#4b5563' }}>{wo.projectName ?? shortId(wo.projectId)}</td>
                    <td style={{ color: '#4b5563' }}>{wo.workTypeName ?? shortId(wo.workTypeId)}</td>
                    <td>
                      <span className={`bf-badge ${WORK_ORDER_STATUS_BADGES[wo.status] ?? 'bf-badge-idle'}`}>
                        {WORK_ORDER_STATUS_LABELS[wo.status] ?? wo.status}
                      </span>
                    </td>
                    <td style={{ color: '#4b5563' }}>{WORK_ORDER_PRIORITY_LABELS[wo.priority] ?? wo.priority}</td>
                    <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                      {new Date(wo.updatedAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="bf-cell-actions">
                      <span className="bf-row-actions">
                        <Tooltip content="Xem chi tiết công việc">
                          <a className="bf-detail-link" href={`/work-orders/${wo.id}`}>
                            Chi tiết
                          </a>
                        </Tooltip>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination page={page} totalPages={totalPages} onPage={(p) => setOffset((p - 1) * PAGE_SIZE)} prevLabel="Trước" nextLabel="Sau" />
        </Card>
      )}
    </div>
  );
}
