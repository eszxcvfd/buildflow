'use client';

import * as React from 'react';
import { listWorkers, changeWorkerLifecycleStatus, getWorkerOpenWork, type Worker } from '@/lib/api/workers';
import type { ApiError } from '@/lib/api/workers';
import { useTradeNames } from '@/features/workers/hooks/useTradeNames';
import {
  ResourceStatusDialog,
  type ResourceAction,
  type OpenWorkCheck,
  RESOURCE_ACTION_LABEL,
  RESOURCE_REASON_REQUIRED_MESSAGE,
  RESOURCE_REASON_MAX_LENGTH,
} from '@/features/resources/components/ResourceStatusDialog';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Select } from '@/components/ui/select/Select';
import { Tooltip } from '@/components/ui/tooltip/Tooltip';
import {
  ActiveChips,
  ClearFiltersButton,
  ListPagination,
  ListToolbar,
  SearchField,
} from '@/components/ui/list/ListKit';

export function shortUuid(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function statusTone(status: string): { label: string; color: string } {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Hoạt động', color: '#065f46' };
    case 'INACTIVE':
      return { label: 'Ngừng hoạt động', color: '#991b1b' };
    case 'LOCKED':
      return { label: 'Bị khóa', color: '#92400e' };
    default:
      return { label: status, color: '#374151' };
  }
}

const PAGE_SIZE = 20;

/**
 * ORG-SRS-004 (issue #27) — lifecycle status worker:
 * - ACTIVE: nút 'Tạm ngừng' (SUSPEND) và 'Chấm dứt' (TERMINATE) — mở confirm dialog
 *   kèm pre-check GET /workers/:id/open-work; cảnh báo ảnh hưởng nếu có việc mở;
 *   lý do bắt buộc validate theo field (không tự suy diễn khi API từ chối).
 * - INACTIVE: nút 'Kích hoạt lại' (ACTIVATE).
 * - LOCKED (bị khóa do bảo mật): không nút lifecycle ở đây — xử lý ở quản trị tài
 *   khoản (PATCH /admin/users/:id/status) để không suy diễn trạng thái.
 * - `alreadyInState: true` từ API (request lặp) → thông tin 'đã ở trạng thái này',
 *   không báo lỗi, không tạo audit trùng.
 */
export function WorkerList() {
  const tradeNames = useTradeNames();
  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [offset, setOffset] = React.useState(0);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionInfo, setActionInfo] = React.useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<{ worker: Worker; action: ResourceAction } | null>(null);
  const [openCheck, setOpenCheck] = React.useState<OpenWorkCheck>({ state: 'loading' });
  const [dialogServerMessage, setDialogServerMessage] = React.useState<string | null>(null);
  const [dialogReasonError, setDialogReasonError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listWorkers({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setWorkers(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, offset]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRetry() {
    void load();
  }

  // Pre-check open work khi vừa mở dialog với action rời khỏi ACTIVE (SRS: hiển thị
  // cảnh báo ảnh hưởng trước khi ngừng; chỉ đếm, không chặn).
  async function runOpenCheck(workerId: string) {
    setOpenCheck({ state: 'loading' });
    try {
      const res = await getWorkerOpenWork(workerId);
      setOpenCheck({ state: 'done', openAssignments: res.openAssignments });
    } catch {
      setOpenCheck({ state: 'failed' });
    }
  }

  function openDialog(worker: Worker, action: ResourceAction) {
    setConfirmTarget({ worker, action });
    setDialogServerMessage(null);
    setDialogReasonError(null);
    setActionInfo(null);
    setOpenCheck(action === 'ACTIVATE' ? { state: 'done', openAssignments: 0 } : { state: 'loading' });
    if (action !== 'ACTIVATE') void runOpenCheck(worker.id);
  }

  async function handleConfirm(reason: string) {
    if (!confirmTarget) return;
    const { worker, action } = confirmTarget;
    setActionError(null);
    setDialogServerMessage(null);
    setDialogReasonError(null);
    setBusyId(worker.id);
    try {
      const updated = await changeWorkerLifecycleStatus(worker.id, { action, reason: reason || null });
      const nextStatus = updated.status;
      setWorkers((prev) => prev.map((w) => (w.id === updated.id
        ? { ...w, status: nextStatus, eligible: updated.eligible }
        : w)));
      setConfirmTarget(null);
      if (updated.alreadyInState) {
        // Request lặp/trạng thái đã đúng: API trả 200 alreadyInState — thông tin,
        // không phải lỗi; không tạo audit trùng ở server.
        setActionInfo(
          action === 'ACTIVATE'
            ? 'Worker đã ở trạng thái hoạt động — không thay đổi gì thêm.'
            : 'Worker đã ở trạng thái ngừng hoạt động — không thay đổi gì thêm.',
        );
      } else if (action === 'ACTIVATE') {
        setActionInfo('Đã kích hoạt lại worker — có thể nhận phân công mới.');
      } else if (updated.warning && updated.warning.openAssignments > 0) {
        setActionInfo(
          `${RESOURCE_ACTION_LABEL[action]} thành công. Worker đang có ${updated.warning.openAssignments} công việc/lịch mở — lịch sử vẫn được giữ nguyên.`,
        );
      } else {
        setActionInfo(
          `${RESOURCE_ACTION_LABEL[action]} thành công — worker sẽ bị chặn phân công mới, lịch sử vẫn giữ.`,
        );
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) {
        setDialogServerMessage('Phiên hết hạn, vui lòng đăng nhập lại.');
      } else if (err.status === 403) {
        setDialogServerMessage('Không có quyền — cần ADMIN.');
      } else if (err.fieldErrors?.reason?.length) {
        setDialogReasonError(err.fieldErrors.reason.join(' '));
      } else {
        setDialogServerMessage(err.message || 'Chuyển trạng thái thất bại');
      }
    } finally {
      setBusyId(null);
    }
  }

  function handleCancel() {
    setConfirmTarget(null);
  }

  const hasActiveFilter = search.trim() !== '' || statusFilter !== '';

  function handleClearFilters() {
    setSearch('');
    setStatusFilter('');
    setOffset(0);
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải danh sách worker…</p>
      </Card>
    );
  }

  if (error) {
    if (error.status === 401) {
      return (
        <Card>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/login" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>
              Đến trang đăng nhập
            </a>
          </div>
        </Card>
      );
    }
    if (error.status === 403) {
      return (
        <Card>
          <Alert tone="error">Không có quyền truy cập — cần vai trò ADMIN hoặc PROJECT_MANAGER (403)</Alert>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            Tài khoản hiện tại không đủ quyền để xem danh sách worker.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={handleRetry}>
              Thử lại
            </Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách worker'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={handleRetry}>
            Thử lại
          </Button>
        </div>
      </Card>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <ListToolbar count={`Tổng: ${total} hồ sơ · Hiển thị ${workers.length}`}>
          <SearchField
            id="worker-search"
            label="Tìm kiếm"
            placeholder="Tên, email, mã nhân viên…"
            value={search}
            onChange={(v) => { setSearch(v); setOffset(0); }}
            onSubmit={() => { setOffset(0); void load(); }}
          />
          <div className="bf-filter">
            <Select
              id="worker-status"
              label="Trạng thái"
              hideLabel
              value={statusFilter}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Hoạt động' },
                { value: 'INACTIVE', label: 'Ngừng hoạt động' },
                { value: 'LOCKED', label: 'Bị khóa' },
              ]}
              onChange={(v) => { setStatusFilter(v); setOffset(0); }}
            />
          </div>
          <Button variant="secondary" onClick={() => { setOffset(0); void load(); }}>
            Tìm
          </Button>
          {hasActiveFilter ? <ClearFiltersButton onClear={handleClearFilters} /> : null}
        </ListToolbar>
        <ActiveChips
          chips={[
            ...(statusFilter
              ? [{
                  key: 'status',
                  label: `Trạng thái: ${statusFilter === 'ACTIVE' ? 'Hoạt động' : statusFilter === 'INACTIVE' ? 'Ngừng hoạt động' : 'Bị khóa'}`,
                  onRemove: () => { setStatusFilter(''); setOffset(0); },
                }]
              : []),
            ...(search.trim()
              ? [{
                  key: 'q',
                  label: `Tìm: “${search.trim()}”`,
                  onRemove: () => { setSearch(''); setOffset(0); },
                }]
              : []),
          ]}
        />
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Worker ngừng hoạt động được giữ lịch sử, không cho phân công mới.
        </p>
      </Card>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}
      {actionInfo ? <Alert tone="success">{actionInfo}</Alert> : null}

      {confirmTarget ? (
        <ResourceStatusDialog
          resourceName={confirmTarget.worker.fullName}
          currentStatus={confirmTarget.worker.status}
          action={confirmTarget.action}
          openCheck={openCheck}
          submitting={busyId === confirmTarget.worker.id}
          serverMessage={dialogServerMessage}
          serverFieldError={dialogReasonError}
          onConfirm={(reason) => void handleConfirm(reason)}
          onCancel={handleCancel}
          onRetryCheck={() => void runOpenCheck(confirmTarget.worker.id)}
        />
      ) : null}

      {workers.length === 0 ? (
        <Card>
          <EmptyState
            title="Chưa có worker nào phù hợp bộ lọc"
            action={
              <a className="bf-btn bf-btn-primary" href="/workers/new">
                Thêm công nhân
              </a>
            }
          >
            Thử thay đổi từ khóa hoặc tạo hồ sơ mới.
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Mã NV</th>
                  <th>Trạng thái</th>
                  <th>Điều kiện phân công</th>
                  <th>Ngành nghề</th>
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => {
                  const s = statusTone(w.status);
                  const rowBusy = busyId === w.id;
                  return (
                    <tr key={w.id}>
                      <td>
                        <a href={`/workers/${w.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                          {w.fullName}
                        </a>
                        <div className="bf-card-meta">{w.email}</div>
                      </td>
                      <td>{w.employeeCode ?? '—'}</td>
                      <td>
                        <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
                      </td>
                      <td>
                        {w.eligible ? (
                          <span style={{ color: '#065f46' }}>Đang hoạt động</span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ color: '#991b1b' }}>Không hoạt động (không nhận việc mới)</span>
                            <span className="bf-badge bf-badge-risk">Không nhận việc mới</span>
                          </span>
                        )}
                      </td>
                      <td style={{ color: '#6b7280', maxWidth: 260 }}>
                        {w.trades.length
                          ? w.trades
                              .map((t) => {
                                const label = tradeNames.names.get(t.tradeId);
                                return label ? `${label} · Lv${t.skillLevel}` : `${shortUuid(t.tradeId)} Lv${t.skillLevel}`;
                              })
                              .join(', ')
                          : '—'}
                      </td>
                      <td className="bf-cell-actions">
                        <span className="bf-row-actions">
                          {w.status === 'ACTIVE' ? (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openDialog(w, 'SUSPEND')}
                                disabled={rowBusy}
                                title="Tạm ngừng — lý do bắt buộc, có cảnh báo công việc mở"
                              >
                                Tạm ngừng
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openDialog(w, 'TERMINATE')}
                                disabled={rowBusy}
                                title="Chấm dứt — lý do bắt buộc, lịch sử vẫn giữ"
                              >
                                Chấm dứt
                              </Button>
                            </>
                          ) : w.status === 'INACTIVE' ? (
                            <Button variant="secondary" size="sm" onClick={() => openDialog(w, 'ACTIVATE')} disabled={rowBusy}>
                              Kích hoạt lại
                            </Button>
                          ) : null}
                          <Tooltip content="Xem hồ sơ chi tiết">
                            <a className="bf-detail-link" href={`/workers/${w.id}`}>
                              Chi tiết
                            </a>
                          </Tooltip>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPagination page={page} totalPages={totalPages} onPage={(p) => setOffset((p - 1) * PAGE_SIZE)} prevLabel="Trước" nextLabel="Sau" />
        </Card>
      )}

      {confirmTarget ? (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--bf-muted)' }}>
          Lý do {RESOURCE_ACTION_LABEL[confirmTarget.action].toLowerCase()} phải dài 1–{RESOURCE_REASON_MAX_LENGTH} ký tự
          ({RESOURCE_REASON_REQUIRED_MESSAGE}).
        </p>
      ) : null}
    </div>
  );
}
