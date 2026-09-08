'use client';

import * as React from 'react';
import { getWorkType, type WorkType, type ApiError } from '@/lib/api/work-types';
import { listTrades, type Trade } from '@/lib/api/trades';
import { REQUIRED_FIELD_TYPE_LABELS } from '@/features/work-types/schemas/work-type.schema';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { toast } from '@/components/ui/toast/Toaster';
import { WorkTypeEditDialog } from './WorkTypeEditDialog';
import { WorkTypeStatusDialog } from './WorkTypeStatusDialog';

export function WorkTypeDetail({ id }: { id: string }) {
  const [workType, setWorkType] = React.useState<WorkType | null>(null);
  const [trade, setTrade] = React.useState<Trade | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (actionSuccess) toast.success({ title: actionSuccess });
  }, [actionSuccess]);
  const [editOpen, setEditOpen] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const wt = await getWorkType(id);
      setWorkType(wt);
      if (wt.requiredTradeId) {
        try {
          const trades = await listTrades({ status: 'ALL', limit: 100, offset: 0 });
          setTrade(trades.data.find((t) => t.id === wt.requiredTradeId) ?? null);
        } catch {
          setTrade(null);
        }
      } else {
        setTrade(null);
      }
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

  if (loading) return <Card><p aria-busy="true">Đang tải chi tiết loại công việc…</p></Card>;
  if (error) {
    if (error.status === 401) return <Card><Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert><div style={{ marginTop: '0.75rem' }}><a href="/login">Đến trang đăng nhập</a></div></Card>;
    if (error.status === 403) return <Card><Alert tone="error">Không có quyền truy cập — cần ADMIN hoặc Điều phối (403)</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    if (error.status === 404) return <Card><Alert tone="error">Không tìm thấy loại công việc (404) — kiểm tra lại đường dẫn</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    return <Card><Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
  }
  if (!workType) return <Card><p>Không có dữ liệu.</p></Card>;

  const isActive = workType.status === 'ACTIVE';
  const openWorkOrders = workType.usage?.workOrders ?? 0;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div className="bf-profile-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{workType.name}</h1>
              <span className="bf-chip">{workType.code}</span>
              <span className={`bf-badge bf-badge-${isActive ? 'ok' : 'busy'}`}>
                {isActive ? 'Hoạt động' : 'Ngừng hoạt động'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
            <Button variant={isActive ? 'secondary' : 'primary'} onClick={() => setStatusOpen(true)}>
              {isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
            </Button>
            <a href="/work-types" style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Về danh sách</a>
          </div>
        </div>

        <dl className="bf-def-grid">
          <div>
            <dt>Mô tả</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{workType.description || '—'}</dd>
          </div>
          <div>
            <dt>Nhóm công việc</dt>
            <dd>{workType.group || '—'}</dd>
          </div>
          <div>
            <dt>Ngành nghề yêu cầu</dt>
            <dd>
              {!workType.requiredTradeId
                ? '—'
                : trade
                  ? <a href={`/trades/${trade.id}`}>{trade.code} — {trade.name}</a>
                  : `${workType.requiredTradeId.slice(0, 8)}…`}
            </dd>
          </div>
          <div>
            <dt>Phiên bản cấu hình</dt>
            <dd>
              v{workType.configVersion}
              {openWorkOrders > 0 ? ` · Đang dùng bởi ${openWorkOrders} work order` : null}
            </dd>
          </div>
          <div>
            <dt>Dùng cho work order mới</dt>
            <dd style={{ color: workType.usableForNewWorkOrder ? 'var(--bf-ok)' : 'var(--bf-risk)' }}>
              {workType.usableForNewWorkOrder
                ? 'Được phép — chọn được cho work order mới'
                : 'Bị chặn — loại ngừng hiệu lực không dùng cho work order mới'}
            </dd>
          </div>
          <div>
            <dt>Cập nhật</dt>
            <dd>{new Date(workType.updatedAt).toLocaleString('vi-VN')}</dd>
          </div>
        </dl>

        {!isActive ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="info">
              Loại công việc đang ngừng hoạt động nên không chọn được cho work order mới.
              Work order cũ vẫn giữ và truy được bình thường.
            </Alert>
          </div>
        ) : null}

        {workType.warning ? (
          <div style={{ marginTop: '0.75rem' }}><Alert tone="info">{workType.warning}</Alert></div>
        ) : null}
        {actionSuccess ? (
          <div style={{ marginTop: '0.75rem' }}><Alert tone="success">{actionSuccess}</Alert></div>
        ) : null}
      </Card>

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Dữ liệu bắt buộc khi nghiệm thu ({workType.requiredFields.length})</span>
        </div>
        {workType.requiredFields.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.9rem' }}>
            Chưa cấu hình trường dữ liệu nào.
          </p>
        ) : (
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Nhãn hiển thị</th>
                  <th>Kiểu</th>
                </tr>
              </thead>
              <tbody>
                {workType.requiredFields.map((f) => (
                  <tr key={f.key}>
                    <td><span className="bf-chip">{f.key}</span></td>
                    <td>{f.label}</td>
                    <td>{REQUIRED_FIELD_TYPE_LABELS[f.type] ?? f.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Lịch sử và truy vết</span>
        </div>
        <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
          Loại công việc không bị xóa vĩnh viễn — loại đã dùng chỉ được ngừng hoạt động.
          Chi tiết người thực hiện, thời gian và cấu hình trước/sau được lưu trong nhật ký hệ
          thống (audit log, action PRJ_WORK_TYPE_CREATED/PRJ_WORK_TYPE_UPDATED/PRJ_WORK_TYPE_STATUS_CHANGED).
        </p>
      </Card>

      <WorkTypeEditDialog
        id={workType.id}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={() => void load()}
      />
      <WorkTypeStatusDialog
        workType={workType}
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onChanged={(updated) => {
          setWorkType(updated);
          if (updated.alreadyInState) {
            setActionSuccess('Loại công việc đã ở trạng thái này — không có thay đổi.');
          } else if (updated.status === 'ACTIVE') {
            setActionSuccess('Đã kích hoạt lại — có thể dùng cho work order mới.');
          } else {
            setActionSuccess(
              updated.warning
                ? `Đã chuyển sang Ngừng hoạt động — ${updated.warning}`
                : 'Đã chuyển sang Ngừng hoạt động — không dùng cho work order mới, lịch sử cũ giữ nguyên.',
            );
          }
        }}
      />
    </div>
  );
}
