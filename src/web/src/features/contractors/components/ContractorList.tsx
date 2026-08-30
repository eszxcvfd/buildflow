'use client';

import * as React from 'react';
import { listContractors, type Contractor } from '@/lib/api/contractors';
import type { ApiError } from '@/lib/api/contractors';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';

function statusTone(status: string): { label: string; color: string } {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Hoạt động', color: '#065f46' };
    case 'INACTIVE':
      return { label: 'Ngừng hoạt động', color: '#991b1b' };
    default:
      return { label: status, color: '#374151' };
  }
}

export function ContractorList() {
  const [contractors, setContractors] = React.useState<Contractor[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [scopeFilter, setScopeFilter] = React.useState('');
  const [eligibleOnly, setEligibleOnly] = React.useState(false);
  const [retryKey, setRetryKey] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listContractors({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        scope: scopeFilter.trim() || undefined,
        eligibleOnly: eligibleOnly || undefined,
        limit: 20,
        offset: 0,
      });
      setContractors(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, scopeFilter, eligibleOnly, retryKey]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRetry() {
    setRetryKey((k) => k + 1);
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải danh sách nhà thầu…</p>
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
            Tài khoản hiện tại không đủ quyền để xem danh sách nhà thầu.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải danh sách nhà thầu'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={handleRetry}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label htmlFor="contractor-search" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Tìm kiếm</label>
            <input id="contractor-search" placeholder="Mã, tên, liên hệ, email…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }} />
          </div>
          <div style={{ minWidth: 160 }}>
            <label htmlFor="contractor-status" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Trạng thái</label>
            <select id="contractor-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem', background: '#fff' }}>
              <option value="">Tất cả</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label htmlFor="contractor-scope" style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>Phạm vi</label>
            <input id="contractor-scope" placeholder="Thí dụ: Thi công phần thô" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.55rem 0.75rem' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} /> Chỉ hiển thị đủ điều kiện (ACTIVE)
          </label>
          <Button variant="secondary" onClick={() => void load()}>Tìm</Button>
          <a href="/contractors/new" style={{ marginLeft: 'auto', alignSelf: 'center', color: '#1d4ed8', textDecoration: 'underline', fontWeight: 600 }}>+ Tạo nhà thầu</a>
        </div>
        <p style={{ margin: '0.75rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>Tổng: {total} hồ sơ · Hiển thị {contractors.length} · INACTIVE không được chọn cho phân công mới nhưng lịch sử vẫn truy được.</p>
      </Card>

      {contractors.length === 0 ? (
        <Card><p style={{ margin: 0, color: '#6b7280' }}>Chưa có nhà thầu nào phù hợp bộ lọc.</p><p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>Thử thay đổi từ khóa hoặc tạo hồ sơ mới.</p></Card>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {contractors.map((c) => {
            const s = statusTone(c.status);
            return (
              <Card key={c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}><a href={`/contractors/${c.id}`} style={{ color: '#111827', textDecoration: 'underline' }}>{c.name}</a> <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.9rem' }}>· {c.code}</span></div>
                    <div style={{ marginTop: 4, fontSize: '0.88rem', color: '#374151' }}>Liên hệ: <strong>{c.contactName ?? '—'}</strong> · SĐT: {c.phone ?? '—'} · Email: {c.email ?? '—'} · <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span> · <span style={{ color: c.eligible ? '#065f46' : '#991b1b' }}>{c.eligible ? 'Đủ điều kiện phân công' : 'Không đủ điều kiện — ngừng hoạt động'}</span></div>
                    <div style={{ marginTop: 4, fontSize: '0.85rem', color: '#6b7280' }}>Phạm vi: {c.scope ?? '—'} · Tạo: {new Date(c.createdAt).toLocaleDateString('vi-VN')}</div>
                    {!c.eligible ? <div style={{ marginTop: 4, fontSize: '0.8rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, padding: '0.2rem 0.5rem', display: 'inline-block' }}>Lý do không chọn được: nhà thầu ngừng hoạt động — không cho phân công mới (history vẫn truy được via detail)</div> : null}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {!c.eligible ? <span style={{ fontSize: '0.8rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, padding: '0.2rem 0.5rem' }}>Chặn phân công</span> : null}
                    <a href={`/contractors/${c.id}`} style={{ fontSize: '0.9rem', color: '#1d4ed8', textDecoration: 'underline' }}>Chi tiết</a>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
