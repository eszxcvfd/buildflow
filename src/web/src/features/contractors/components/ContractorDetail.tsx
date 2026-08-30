'use client';

import * as React from 'react';
import { getContractor, updateContractor, type Contractor } from '@/lib/api/contractors';
import type { ApiError } from '@/lib/api/contractors';
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
    if (error.status === 401) return <Card><Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert><div style={{ marginTop: '0.75rem' }}><a href="/login" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Đến trang đăng nhập</a></div></Card>;
    if (error.status === 403) return <Card><Alert tone="error">Không có quyền truy cập — cần ADMIN (403)</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button></div></Card>;
    if (error.status === 404) return <Card><Alert tone="error">Không tìm thấy nhà thầu (404) — kiểm tra ID hoặc quyền dự án</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button></div></Card>;
    return <Card><Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button></div></Card>;
  }
  if (!contractor) return <Card><p>Không có dữ liệu.</p></Card>;

  const isActive = contractor.status === 'ACTIVE';

  return (
    <div style={{ display: 'grid', gap: '1rem', maxWidth: 720 }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700 }}>{contractor.name}</h1>
            <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>{contractor.code} · <span style={{ color: isActive ? '#065f46' : '#991b1b', fontWeight: 600 }}>{isActive ? 'Hoạt động' : 'Ngừng hoạt động'}</span> · {contractor.eligible ? 'Đủ điều kiện phân công' : 'Không đủ điều kiện (chặn phân công mới)'}</p>
          </div>
          <a href={`/contractors/${contractor.id}/edit`} style={{ color: '#1d4ed8', textDecoration: 'underline', fontWeight: 600 }}>Chỉnh sửa</a>
        </div>

        <dl style={{ margin: '1rem 0 0', display: 'grid', gap: '0.6rem', fontSize: '0.92rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem' }}><dt style={{ color: '#6b7280', fontWeight: 600 }}>Liên hệ</dt><dd style={{ margin: 0 }}>{contractor.contactName ?? '—'}</dd></div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem' }}><dt style={{ color: '#6b7280', fontWeight: 600 }}>SĐT</dt><dd style={{ margin: 0 }}>{contractor.phone ?? '—'}</dd></div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem' }}><dt style={{ color: '#6b7280', fontWeight: 600 }}>Email</dt><dd style={{ margin: 0 }}>{contractor.email ?? '—'}</dd></div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem' }}><dt style={{ color: '#6b7280', fontWeight: 600 }}>Phạm vi</dt><dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{contractor.scope ?? '—'}</dd></div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem' }}><dt style={{ color: '#6b7280', fontWeight: 600 }}>Eligible</dt><dd style={{ margin: 0, color: contractor.eligible ? '#065f46' : '#991b1b' }}>{contractor.eligible ? 'ACTIVE → cho phép phân công' : 'INACTIVE → chặn phân công mới (lịch sử giữ)'}</dd></div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem' }}><dt style={{ color: '#6b7280', fontWeight: 600 }}>Tạo bởi</dt><dd style={{ margin: 0 }}>{contractor.createdBy.slice(0, 8)}… · {new Date(contractor.createdAt).toLocaleString('vi-VN')}</dd></div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem' }}><dt style={{ color: '#6b7280', fontWeight: 600 }}>Cập nhật</dt><dd style={{ margin: 0 }}>{new Date(contractor.updatedAt).toLocaleString('vi-VN')}</dd></div>
        </dl>

        {!contractor.eligible ? <div style={{ marginTop: '0.75rem' }}><Alert tone="info">Lý do không chọn được: nhà thầu ngừng hoạt động — hệ thống chặn phân công mới nhưng record cũ vẫn truy được (BR-11, ORG-SRS-002). Không hard delete.</Alert></div> : null}

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {!showConfirm ? <Button variant={isActive ? 'secondary' : 'primary'} onClick={() => setShowConfirm(true)}>{isActive ? 'Chuyển sang Ngừng hoạt động' : 'Kích hoạt lại'}</Button> : null}
          <a href="/contractors" style={{ color: '#6b7280', fontSize: '0.9rem' }}>← Về danh sách</a>
        </div>

        {showConfirm ? (
          <div style={{ marginTop: '1rem', border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 8, padding: '0.75rem' }}>
            <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>Xác nhận chuyển trạng thái {contractor.status} → {isActive ? 'INACTIVE' : 'ACTIVE'}?</p>
            <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>{isActive ? 'Sẽ chặn phân công mới, lịch sử giữ; có cảnh báo nếu đang có work liên quan. Audit sẽ lưu before/after.' : 'Kích hoạt lại sẽ cho phép phân công mới.'}</p>
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
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600 }}>Lịch sử & truy vết</h3>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>Record cũ vẫn truy được kể cả khi INACTIVE (không hard delete). Chi tiết actor/thời gian/trạng thái trước-sau lưu ở Audit log phía API. ID: {contractor.id}</p>
      </Card>
    </div>
  );
}
