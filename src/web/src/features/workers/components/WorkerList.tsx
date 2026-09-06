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
        limit: 20,
        offset: 0,
      });
      setWorkers(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

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

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label htmlFor="worker-search" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
              Tìm kiếm
            </label>
            <input
              id="worker-search"
              placeholder="Tên, email, mã nhân viên…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }}
            />
          </div>
          <div style={{ minWidth: 160 }}>
            <label htmlFor="worker-status" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>
              Trạng thái
            </label>
            <select
              id="worker-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem', background: '#fff' }}
            >
              <option value="">Tất cả</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
              <option value="LOCKED">Bị khóa</option>
            </select>
          </div>
          <Button variant="secondary" onClick={() => void load()}>
            Tìm
          </Button>
          <a className="bf-btn bf-btn-primary" href="/workers/new" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            Thêm công nhân
          </a>
        </div>
        <p style={{ margin: '0.75rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
          Tổng: {total} hồ sơ · Hiển thị {workers.length} · Worker ngừng hoạt động được giữ lịch sử, không cho phân công mới.
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
          <p style={{ margin: 0, color: '#6b7280' }}>Chưa có worker nào phù hợp bộ lọc.</p>
          <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            Thử thay đổi từ khóa hoặc tạo hồ sơ mới.
          </p>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {workers.map((w) => {
            const s = statusTone(w.status);
            const rowBusy = busyId === w.id;
            return (
              <Card key={w.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      <a href={`/workers/${w.id}`} style={{ color: '#111827', textDecoration: 'underline' }}>
                        {w.fullName}
                      </a>{' '}
                      <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.9rem' }}>· {w.email}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: '0.88rem', color: '#374151' }}>
                      Mã: <strong>{w.employeeCode ?? '—'}</strong> · SĐT: {w.phone ?? '—'} ·{' '}
                      <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span> ·{' '}
                      <span style={{ color: w.eligible ? '#065f46' : '#991b1b' }}>{w.eligible ? 'Đang hoạt động' : 'Không hoạt động (không nhận việc mới)'}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: '0.85rem', color: '#6b7280' }}>
                      Ngành nghề: {w.trades.length
                        ? w.trades
                            .map((t) => {
                              const label = tradeNames.names.get(t.tradeId);
                              return label ? `${label} · Lv${t.skillLevel}` : `${shortUuid(t.tradeId)} Lv${t.skillLevel}`;
                            })
                            .join(', ')
                        : '—'} · Tạo: {new Date(w.createdAt).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {!w.eligible ? <span style={{ fontSize: '0.8rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, padding: '0.2rem 0.5rem' }}>Không nhận việc mới</span> : null}
                    {w.status === 'ACTIVE' ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => openDialog(w, 'SUSPEND')}
                          disabled={rowBusy}
                          title="Tạm ngừng — lý do bắt buộc, có cảnh báo công việc mở"
                        >
                          Tạm ngừng
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => openDialog(w, 'TERMINATE')}
                          disabled={rowBusy}
                          title="Chấm dứt — lý do bắt buộc, lịch sử vẫn giữ"
                        >
                          Chấm dứt
                        </Button>
                      </>
                    ) : w.status === 'INACTIVE' ? (
                      <Button variant="secondary" onClick={() => openDialog(w, 'ACTIVATE')} disabled={rowBusy}>
                        Kích hoạt lại
                      </Button>
                    ) : null}
                    <a href={`/workers/${w.id}`} style={{ fontSize: '0.9rem', color: '#1d4ed8', textDecoration: 'underline' }}>
                      Chi tiết
                    </a>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
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
