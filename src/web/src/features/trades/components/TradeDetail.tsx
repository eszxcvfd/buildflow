'use client';

import * as React from 'react';
import { getTrade, changeTradeStatus, type Trade } from '@/lib/api/trades';
import type { ApiError } from '@/lib/api/trades';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { toast } from '@/components/ui/toast/Toaster';
import { TradeEditDialog } from './TradeEditDialog';

export function TradeDetail({ id }: { id: string }) {
  const [trade, setTrade] = React.useState<Trade | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  // Thông báo chuyển trạng thái thành công hiển thị cả inline (giữ assert hiện
  // có) lẫn Ark Toast thoáng qua.
  React.useEffect(() => {
    if (actionSuccess) toast.success({ title: actionSuccess });
  }, [actionSuccess]);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [showConfirm, setShowConfirm] = React.useState(false);
  // CRUD popup: nút 'Sửa danh mục' mở TradeEditDialog (không điều hướng /edit);
  // route /edit giữ hoạt động độc lập cho E2E drivers goto trực tiếp.
  const [editOpen, setEditOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = await getTrade(id);
      setTrade(t);
      // Trade trả từ GET không kèm warning; warning chỉ có trên response của status change.
      setWarning(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { void load(); }, [load]);

  function handleRetry() {
    void load();
  }

  async function handleStatusToggle() {
    if (!trade) return;
    const next = trade.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    setWarning(null);
    try {
      const updated = await changeTradeStatus(trade.id, { status: next });
      setTrade(updated);
      setShowConfirm(false);
      if (next === 'INACTIVE') {
        // Deactivate đang được tham chiếu: API vẫn cho phép và trả warning (audit đã lưu).
        if (updated.warning) setWarning(updated.warning);
        setActionSuccess(
          'Đã chuyển sang Ngừng hoạt động — danh mục không được dùng cho phân công mới, lịch sử cũ giữ nguyên.',
        );
      } else {
        setActionSuccess('Đã kích hoạt lại danh mục — có thể dùng cho phân công mới.');
      }
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) setActionError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (err.status === 403) setActionError('Không có quyền — cần ADMIN.');
      else setActionError(err.message || 'Chuyển trạng thái thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <Card><p aria-busy="true">Đang tải chi tiết ngành nghề…</p></Card>;
  if (error) {
    if (error.status === 401) return <Card><Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert><div style={{ marginTop: '0.75rem' }}><a href="/login">Đến trang đăng nhập</a></div></Card>;
    if (error.status === 403) return <Card><Alert tone="error">Không có quyền truy cập — cần ADMIN (403)</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    if (error.status === 404) return <Card><Alert tone="error">Không tìm thấy ngành nghề (404) — kiểm tra lại đường dẫn</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    return <Card><Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
  }
  if (!trade) return <Card><p>Không có dữ liệu.</p></Card>;

  const isActive = trade.status === 'ACTIVE';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div className="bf-profile-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{trade.name}</h1>
              <span className="bf-chip">{trade.code}</span>
              <span className={`bf-badge bf-badge-${isActive ? 'ok' : 'busy'}`}>
                {isActive ? 'Hoạt động' : 'Ngừng hoạt động'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa danh mục
            </Button>
            {!showConfirm ? (
              <Button variant={isActive ? 'secondary' : 'primary'} onClick={() => setShowConfirm(true)}>
                {isActive ? 'Chuyển sang Ngừng hoạt động' : 'Kích hoạt lại'}
              </Button>
            ) : null}
            <a href="/trades" style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Về danh sách</a>
          </div>
        </div>

        <dl className="bf-def-grid">
          <div>
            <dt>Mô tả</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{trade.description || '—'}</dd>
          </div>
          <div>
            <dt>Dùng cho phân công</dt>
            <dd style={{ color: trade.assignable ? 'var(--bf-ok)' : 'var(--bf-risk)' }}>
              {trade.assignable
                ? 'Được phép — chọn được cho worker/loại công việc/work order mới'
                : 'Bị chặn — danh mục ngừng hiệu lực không dùng cho phân công/tự nhận mới'}
            </dd>
          </div>
          <div>
            <dt>Tạo</dt>
            <dd>{new Date(trade.createdAt).toLocaleString('vi-VN')}</dd>
          </div>
          <div>
            <dt>Cập nhật</dt>
            <dd>{new Date(trade.updatedAt).toLocaleString('vi-VN')}</dd>
          </div>
        </dl>

        {!trade.assignable ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="info">
              Danh mục đang ngừng hoạt động nên không chọn được cho phân công mới. Worker/loại công
              việc/work order cũ vẫn giữ và truy được bình thường.
            </Alert>
          </div>
        ) : null}

        {showConfirm ? (
          <div style={{ marginTop: '1rem', border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 8, padding: '0.75rem' }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>
              Xác nhận chuyển trạng thái danh mục từ {trade.status} sang {isActive ? 'INACTIVE' : 'ACTIVE'}?
            </p>
            <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
              {isActive
                ? 'Sẽ chặn phân công/tự nhận mới dùng danh mục này, lịch sử giữ nguyên. Nếu danh mục đang được tham chiếu, hệ thống vẫn cho phép và báo cảnh báo kèm lưu vào audit.'
                : 'Kích hoạt lại sẽ cho phép dùng danh mục cho phân công mới.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <Button variant="secondary" onClick={() => setShowConfirm(false)} disabled={actionLoading}>Hủy</Button>
              <Button loading={actionLoading} aria-busy={actionLoading} onClick={() => void handleStatusToggle()}>Xác nhận</Button>
            </div>
          </div>
        ) : null}

        {warning ? <div style={{ marginTop: '0.75rem' }}><Alert tone="info">{warning}</Alert></div> : null}
        {actionError ? <div style={{ marginTop: '0.75rem' }}><Alert tone="error">{actionError}</Alert></div> : null}
        {actionSuccess ? <div style={{ marginTop: '0.75rem' }}><Alert tone="success">{actionSuccess}</Alert></div> : null}
      </Card>

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Lịch sử và truy vết</span>
        </div>
        <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
          Danh mục ngành nghề không bị xóa vĩnh viễn — danh mục đã dùng chỉ được ngừng hoạt động.
          Chi tiết người thực hiện, thời gian và trạng thái trước/sau được lưu trong nhật ký hệ
          thống (audit log, action ORG_TRADE_CREATED/ORG_TRADE_UPDATED/ORG_TRADE_STATUS_CHANGED).
        </p>
      </Card>

      <TradeEditDialog
        id={trade.id}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={() => void load()}
      />
    </div>
  );
}
