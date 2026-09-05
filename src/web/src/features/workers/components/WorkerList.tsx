'use client';

import * as React from 'react';
import { listWorkers, type Worker } from '@/lib/api/workers';
import type { ApiError } from '@/lib/api/workers';
import { updateAdminUserStatus } from '@/lib/api/admin-users';
import { useTradeNames } from '@/features/workers/hooks/useTradeNames';
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

export function WorkerList() {
  const tradeNames = useTradeNames();
  const [workers, setWorkers] = React.useState<Worker[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [retryKey, setRetryKey] = React.useState(0);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<{ worker: Worker; next: string } | null>(null);

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
    setRetryKey((k) => k + 1);
  }

  async function handleStatusChange(worker: Worker, next: 'ACTIVE' | 'INACTIVE') {
    setActionError(null);
    setBusyId(worker.id);
    try {
      const updated = await updateAdminUserStatus(worker.id, { status: next });
      setWorkers((prev) => prev.map((w) => (w.id === updated.id
        ? { ...w, status: updated.status, eligible: updated.status === 'ACTIVE' }
        : w)));
      setConfirmTarget(null);
    } catch (e) {
      const err = e as ApiError;
      setActionError(err.status === 401
        ? 'Phiên hết hạn, vui lòng đăng nhập lại.'
        : err.status === 403
          ? 'Không có quyền — cần ADMIN.'
          : err.message || 'Thao tác thất bại');
    } finally {
      setBusyId(null);
    }
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
          <Alert tone="error">Không có quyền truy cập — cần vai trò ADMIN (403)</Alert>
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

      {workers.length === 0 ? (
        <Card>
          <p style={{ margin: 0, color: '#6b7280' }}>Chưa có worker nào phù hợp bộ lọc.</p>
          <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            Thử thay đổi từ khóa hoặc tạo hồ sơ mới.
          </p>
        </Card>
      ) : (
        <>
        {actionError ? <Alert tone="error">{actionError}</Alert> : null}
        {confirmTarget ? (
          <Card>
            <Alert tone="info">
              Xác nhận chuyển trạng thái {confirmTarget.worker.fullName} sang{' '}
              <strong>{confirmTarget.next === 'INACTIVE' ? 'Ngừng hoạt động' : 'Hoạt động'}</strong>?
              {confirmTarget.next === 'INACTIVE' ? ' Worker sẽ bị chặn phân công mới; lịch sử vẫn giữ.' : ''}
            </Alert>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <Button
                onClick={() => {
                  const t = confirmTarget;
                  setConfirmTarget(null);
                  void handleStatusChange(t.worker, t.next as 'ACTIVE' | 'INACTIVE');
                }}
                loading={busyId === confirmTarget.worker.id}
                aria-busy={busyId === confirmTarget.worker.id}
              >
                Xác nhận
              </Button>
              <Button variant="secondary" onClick={() => setConfirmTarget(null)}>Hủy</Button>
            </div>
          </Card>
        ) : null}
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {workers.map((w) => {
            const s = statusTone(w.status);
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
                      <span style={{ color: w.eligible ? '#065f46' : '#991b1b' }}>{w.eligible ? 'Đủ điều kiện phân công' : 'Không đủ điều kiện (inactive/locked)'}</span>
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
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!w.eligible ? <span style={{ fontSize: '0.8rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, padding: '0.2rem 0.5rem' }}>Chặn phân công</span> : null}
                    {w.status === 'ACTIVE' ? (
                      <Button variant="secondary" onClick={() => setConfirmTarget({ worker: w, next: 'INACTIVE' })} disabled={busyId === w.id}>
                        Ngừng hoạt động
                      </Button>
                    ) : w.status === 'INACTIVE' ? (
                      <Button variant="secondary" onClick={() => setConfirmTarget({ worker: w, next: 'ACTIVE' })} disabled={busyId === w.id}>
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
        </>
      )}
    </div>
  );
}
