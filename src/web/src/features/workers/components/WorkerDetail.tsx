'use client';

import * as React from 'react';
import { getWorker, updateWorker, type Worker } from '@/lib/api/workers';
import type { ApiError } from '@/lib/api/workers';
import { updateAdminUserStatus } from '@/lib/api/admin-users';
import { useTradeNames } from '@/features/workers/hooks/useTradeNames';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';

function statusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Hoạt động';
    case 'INACTIVE': return 'Ngừng hoạt động';
    case 'LOCKED': return 'Bị khóa';
    default: return status;
  }
}

export function WorkerDetail({ id }: { id: string }) {
  const tradeNames = useTradeNames();
  const [worker, setWorker] = React.useState<Worker | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [retryKey, setRetryKey] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const w = await getWorker(id);
      setWorker(w);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { void load(); }, [load]);

  async function handleStatusToggle() {
    if (!worker) return;
    const next = worker.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await updateAdminUserStatus(worker.id, { status: next });
      setWorker({ ...worker, status: updated.status, eligible: updated.status === 'ACTIVE' });
      setActionSuccess(next === 'INACTIVE'
        ? 'Đã chuyển sang Ngừng hoạt động — worker sẽ bị chặn phân công mới, lịch sử vẫn giữ.'
        : 'Đã kích hoạt lại worker — có thể nhận phân công mới.');
      setShowConfirm(false);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setActionError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (err.status === 403) setActionError('Không có quyền — cần ADMIN.');
      else setActionError(err.message || 'Chuyển trạng thái thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveTrades() {
    if (!worker) return;
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await updateWorker(worker.id, {
        trades: worker.trades.map((t) => ({ tradeId: t.tradeId, skillLevel: t.skillLevel })),
      });
      setWorker(updated);
      setActionSuccess('Đã lưu thay đổi');
    } catch (e) {
      const err = e as ApiError;
      setActionError(err.message || 'Cập nhật thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <Card><p aria-busy="true">Đang tải chi tiết công nhân…</p></Card>;
  if (error) {
    if (error.status === 401) return <Card><Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert><div style={{ marginTop: '0.75rem' }}><a href="/login">Đến trang đăng nhập</a></div></Card>;
    if (error.status === 403) return <Card><Alert tone="error">Không có quyền truy cập — cần ADMIN (403)</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button></div></Card>;
    if (error.status === 404) return <Card><Alert tone="error">Không tìm thấy công nhân (404) — kiểm tra lại đường dẫn</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button></div></Card>;
    return <Card><Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button></div></Card>;
  }
  if (!worker) return <Card><p>Không có dữ liệu.</p></Card>;

  const isActive = worker.status === 'ACTIVE';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <PageHeader
        title={worker.fullName}
        subtitle={`${worker.email} · ${statusLabel(worker.status)}`}
        actions={
          <a className="bf-btn bf-btn-secondary" href={`/workers/${worker.id}/edit`}>
            Sửa hồ sơ
          </a>
        }
      />

      <Card>
        <dl style={{ margin: 0, display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Mã nhân viên</dt>
            <dd style={{ margin: 0 }}>{worker.employeeCode ?? '—'}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>SĐT</dt>
            <dd style={{ margin: 0 }}>{worker.phone ?? '—'}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Trạng thái</dt>
            <dd style={{ margin: 0 }}>{statusLabel(worker.status)}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Ngành nghề / kỹ năng</dt>
            <dd style={{ margin: 0 }}>
              {worker.trades.length
                ? worker.trades
                    .map((t) => {
                      const label = tradeNames.names.get(t.tradeId);
                      return label ? `${label} · Lv${t.skillLevel}` : `${t.tradeId} · Lv${t.skillLevel}`;
                    })
                    .join('; ')
                : '—'}
            </dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Điều kiện phân công</dt>
            <dd style={{ margin: 0, color: worker.eligible ? 'var(--bf-ok)' : 'var(--bf-risk)' }}>
              {worker.eligible ? 'Đủ điều kiện — cho phép phân công' : 'Không đủ điều kiện — chặn phân công mới, lịch sử vẫn giữ'}
            </dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Tạo</dt>
            <dd style={{ margin: 0 }}>{new Date(worker.createdAt).toLocaleString('vi-VN')}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Cập nhật</dt>
            <dd style={{ margin: 0 }}>{new Date(worker.updatedAt).toLocaleString('vi-VN')}</dd>
          </div>
        </dl>

        {!worker.eligible ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="info">
              Worker đang ngừng hoạt động hoặc bị khóa nên không chọn được cho phân công mới.
              Các phân công cũ vẫn truy được bình thường.
            </Alert>
          </div>
        ) : null}

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {!showConfirm ? (
            <Button variant={isActive ? 'secondary' : 'primary'} onClick={() => setShowConfirm(true)}>
              {isActive ? 'Chuyển sang Ngừng hoạt động' : 'Kích hoạt lại'}
            </Button>
          ) : null}
          <a href="/workers" style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Về danh sách</a>
        </div>

        {showConfirm ? (
          <div style={{ marginTop: '1rem', border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 8, padding: '0.75rem' }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>
              Xác nhận chuyển trạng thái từ {worker.status} sang {isActive ? 'INACTIVE' : 'ACTIVE'}?
            </p>
            <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
              {isActive
                ? 'Sẽ chặn phân công mới và tự nhận việc mới, lịch sử giữ nguyên. Audit lưu before/after.'
                : 'Kích hoạt lại sẽ cho phép phân công mới.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <Button variant="secondary" onClick={() => setShowConfirm(false)} disabled={actionLoading}>Hủy</Button>
              <Button loading={actionLoading} aria-busy={actionLoading} onClick={() => void handleStatusToggle()}>Xác nhận</Button>
            </div>
          </div>
        ) : null}

        {actionError ? <div style={{ marginTop: '0.75rem' }}><Alert tone="error">{actionError}</Alert></div> : null}
        {actionSuccess ? <div style={{ marginTop: '0.75rem' }}><Alert tone="success">{actionSuccess}</Alert></div> : null}
      </Card>
    </div>
  );
}
