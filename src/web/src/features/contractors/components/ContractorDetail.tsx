'use client';

import * as React from 'react';
import { getContractor, updateContractor, type Contractor } from '@/lib/api/contractors';
import type { ApiError } from '@/lib/api/contractors';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';

export function ContractorDetail({ id }: { id: string }) {
  const [contractor, setContractor] = React.useState<Contractor | null>(null);
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
      const c = await getContractor(id);
      setContractor(c);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [id, retryKey]);

  React.useEffect(() => { void load(); }, [load]);

  async function handleStatusToggle() {
    if (!contractor) return;
    const newStatus = contractor.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await updateContractor(contractor.id, { status: newStatus });
      setContractor(updated);
      setActionSuccess(`Đã chuyển trạng thái sang ${newStatus}`);
      setShowConfirm(false);
    } catch (e) {
      const err = e as ApiError;
      setActionError(err.message || 'Chuyển trạng thái thất bại');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <Card><p aria-busy="true">Đang tải chi tiết nhà thầu…</p></Card>;
  if (error) {
    if (error.status === 401) return <Card><Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert><div style={{ marginTop: '0.75rem' }}><a href="/login">Đến trang đăng nhập</a></div></Card>;
    if (error.status === 403) return <Card><Alert tone="error">Không có quyền truy cập — cần ADMIN (403)</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button></div></Card>;
    if (error.status === 404) return <Card><Alert tone="error">Không tìm thấy nhà thầu (404) — kiểm tra lại đường dẫn</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button></div></Card>;
    return <Card><Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button></div></Card>;
  }
  if (!contractor) return <Card><p>Không có dữ liệu.</p></Card>;

  const isActive = contractor.status === 'ACTIVE';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <PageHeader
        title={contractor.name}
        subtitle={`${contractor.code} · ${isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}`}
        actions={
          <a className="bf-btn bf-btn-secondary" href={`/contractors/${contractor.id}/edit`}>
            Sửa hồ sơ
          </a>
        }
      />

      <Card>
        <dl style={{ margin: 0, display: 'grid', gap: '0.6rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Liên hệ</dt>
            <dd style={{ margin: 0 }}>{contractor.contactName ?? '—'}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>SĐT</dt>
            <dd style={{ margin: 0 }}>{contractor.phone ?? '—'}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Email</dt>
            <dd style={{ margin: 0 }}>{contractor.email ?? '—'}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Phạm vi</dt>
            <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{contractor.scope ?? '—'}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Điều kiện phân công</dt>
            <dd style={{ margin: 0, color: contractor.eligible ? 'var(--bf-ok)' : 'var(--bf-risk)' }}>
              {contractor.eligible ? 'Đủ điều kiện — cho phép phân công' : 'Không đủ điều kiện — chặn phân công mới, lịch sử vẫn giữ'}
            </dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Tạo bởi</dt>
            <dd style={{ margin: 0 }}>{contractor.createdBy.slice(0, 8)}… · {new Date(contractor.createdAt).toLocaleString('vi-VN')}</dd>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '0.5rem' }}>
            <dt style={{ color: 'var(--bf-muted)', fontWeight: 500 }}>Cập nhật</dt>
            <dd style={{ margin: 0 }}>{new Date(contractor.updatedAt).toLocaleString('vi-VN')}</dd>
          </div>
        </dl>

        {!contractor.eligible ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="info">
              Nhà thầu đang ngừng hoạt động nên không chọn được cho phân công mới. Các phân công cũ
              vẫn truy được bình thường.
            </Alert>
          </div>
        ) : null}

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {!showConfirm ? (
            <Button variant={isActive ? 'secondary' : 'primary'} onClick={() => setShowConfirm(true)}>
              {isActive ? 'Chuyển sang Ngừng hoạt động' : 'Kích hoạt lại'}
            </Button>
          ) : null}
          <a href="/contractors" style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Về danh sách</a>
        </div>

        {showConfirm ? (
          <div style={{ marginTop: '1rem', border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 8, padding: '0.75rem' }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>
              Xác nhận chuyển trạng thái từ {contractor.status} sang {isActive ? 'INACTIVE' : 'ACTIVE'}?
            </p>
            <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
              {isActive ? 'Sẽ chặn phân công mới, lịch sử giữ; có cảnh báo nếu đang có work liên quan. Audit sẽ lưu before/after.' : 'Kích hoạt lại sẽ cho phép phân công mới.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <Button variant="secondary" onClick={() => setShowConfirm(false)} disabled={actionLoading}>Hủy</Button>
              <Button loading={actionLoading} onClick={() => void handleStatusToggle()}>Xác nhận</Button>
            </div>
          </div>
        ) : null}

        {actionError ? <div style={{ marginTop: '0.75rem' }}><Alert tone="error">{actionError}</Alert></div> : null}
        {actionSuccess ? <div style={{ marginTop: '0.75rem' }}><Alert tone="success">{actionSuccess}</Alert></div> : null}
      </Card>

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Lịch sử và truy vết</span>
        </div>
        <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
          Hồ sơ nhà thầu không bị xóa vĩnh viễn — kể cả khi ngừng hoạt động, dữ liệu cũ vẫn truy
          được. Chi tiết người thực hiện, thời gian và trạng thái trước/sau được lưu trong nhật ký
          hệ thống (audit log).
        </p>
      </Card>
    </div>
  );
}
