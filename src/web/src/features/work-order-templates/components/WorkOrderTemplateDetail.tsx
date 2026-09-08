'use client';

import * as React from 'react';
import {
  getWorkOrderTemplate,
  WORK_ORDER_TEMPLATE_STATUS_LABELS,
  type WorkOrderTemplate,
  type ApiError,
} from '@/lib/api/work-order-templates';
import { listTrades, type Trade } from '@/lib/api/trades';
import {
  CHECKLIST_ANSWER_TYPE_LABELS,
  WORK_ORDER_TEMPLATE_PRIORITY_LABELS,
} from '@/features/work-order-templates/schemas/work-order-template.schema';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { toast } from '@/components/ui/toast/Toaster';
import { WorkOrderTemplateEditDialog } from './WorkOrderTemplateEditDialog';
import { WorkOrderTemplateStatusDialog } from './WorkOrderTemplateStatusDialog';

export function WorkOrderTemplateDetail({ id }: { id: string }) {
  const [template, setTemplate] = React.useState<WorkOrderTemplate | null>(null);
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
      const t = await getWorkOrderTemplate(id);
      setTemplate(t);
      if (t.requiredTradeId) {
        try {
          const trades = await listTrades({ status: 'ALL', limit: 100, offset: 0 });
          setTrade(trades.data.find((x) => x.id === t.requiredTradeId) ?? null);
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

  if (loading) return <Card><p aria-busy="true">Đang tải chi tiết mẫu công việc…</p></Card>;
  if (error) {
    if (error.status === 401) return <Card><Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert><div style={{ marginTop: '0.75rem' }}><a href="/login">Đến trang đăng nhập</a></div></Card>;
    if (error.status === 403) return <Card><Alert tone="error">Không có quyền truy cập — cần ADMIN hoặc Điều phối (403)</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    if (error.status === 404) return <Card><Alert tone="error">Không tìm thấy mẫu công việc (404) — kiểm tra lại đường dẫn</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
    return <Card><Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert><div style={{ marginTop: '0.75rem' }}><Button variant="secondary" onClick={handleRetry}>Thử lại</Button></div></Card>;
  }
  if (!template) return <Card><p>Không có dữ liệu.</p></Card>;

  const statusLabel = WORK_ORDER_TEMPLATE_STATUS_LABELS[template.status] ?? template.status;
  const statusActionLabel = template.status === 'ACTIVE' ? 'Ngừng hoạt động' : 'Kích hoạt';

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div className="bf-profile-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{template.name}</h1>
              <span className="bf-chip">{template.code}</span>
              <span className={`bf-badge ${template.status === 'ACTIVE' ? 'bf-badge-ok' : template.status === 'DRAFT' ? 'bf-badge-busy' : 'bf-badge-risk'}`}>
                {statusLabel}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              Sửa
            </Button>
            <Button variant={template.status === 'ACTIVE' ? 'secondary' : 'primary'} onClick={() => setStatusOpen(true)}>
              {statusActionLabel}
            </Button>
            <a href="/work-order-templates" style={{ color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Về danh sách</a>
          </div>
        </div>

        <dl className="bf-def-grid">
          <div>
            <dt>Mô tả</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{template.description || '—'}</dd>
          </div>
          <div>
            <dt>Loại công việc</dt>
            <dd>
              {!template.workTypeId
                ? '—'
                : template.workType
                  ? <a href={`/work-types/${template.workType.id}`}>{template.workType.code} — {template.workType.name}</a>
                  : `${template.workTypeId.slice(0, 8)}…`}
            </dd>
          </div>
          <div>
            <dt>Ngành nghề</dt>
            <dd>
              {!template.requiredTradeId
                ? '—'
                : trade
                  ? <a href={`/trades/${trade.id}`}>{trade.code} — {trade.name}</a>
                  : `${template.requiredTradeId.slice(0, 8)}…`}
            </dd>
          </div>
          <div>
            <dt>Thời lượng</dt>
            <dd>{template.defaultDurationMinutes != null ? `${template.defaultDurationMinutes} phút` : '—'}</dd>
          </div>
          <div>
            <dt>Ưu tiên</dt>
            <dd>{WORK_ORDER_TEMPLATE_PRIORITY_LABELS[template.defaultPriority] ?? template.defaultPriority}</dd>
          </div>
          <div>
            <dt>Kỹ năng yêu cầu ({template.requiredSkills.length})</dt>
            <dd>
              {template.requiredSkills.length === 0 ? (
                '—'
              ) : (
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {template.requiredSkills.map((s) => (
                    <span key={s.code} className="bf-chip" title={s.code}>
                      {s.label}
                    </span>
                  ))}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Phiên bản</dt>
            <dd>v{template.version}</dd>
          </div>
          <div>
            <dt>Dùng cho work order mới</dt>
            <dd style={{ color: template.usableForNewWorkOrder ? 'var(--bf-ok)' : 'var(--bf-risk)' }}>
              {template.usableForNewWorkOrder
                ? 'Được phép — chọn được cho work order mới'
                : 'Bị chặn — chỉ mẫu Hoạt động mới dùng cho work order mới'}
            </dd>
          </div>
          <div>
            <dt>Cập nhật</dt>
            <dd>{new Date(template.updatedAt).toLocaleString('vi-VN')}</dd>
          </div>
        </dl>

        {template.status === 'DRAFT' ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="info">
              Mẫu đang ở trạng thái Nháp nên chưa chọn được cho work order mới.
              Bổ sung kỹ năng hoặc checklist rồi kích hoạt để đưa vào dùng.
            </Alert>
          </div>
        ) : null}
        {template.status === 'INACTIVE' ? (
          <div style={{ marginTop: '0.75rem' }}>
            <Alert tone="info">
              Mẫu đang ngừng hoạt động nên không chọn được cho work order mới.
              Work order đã tạo từ mẫu này giữ nguyên snapshot.
            </Alert>
          </div>
        ) : null}

        {actionSuccess ? (
          <div style={{ marginTop: '0.75rem' }}><Alert tone="success">{actionSuccess}</Alert></div>
        ) : null}
      </Card>

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Checklist mẫu ({template.checklistSnapshot.length})</span>
        </div>
        {template.checklistSnapshot.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.9rem' }}>
            Chưa có mục checklist nào.
          </p>
        ) : (
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tiêu đề</th>
                  <th>Kiểu trả lời</th>
                  <th>Bắt buộc</th>
                  <th>Chặn nghiệm thu</th>
                  <th>Yêu cầu ảnh</th>
                </tr>
              </thead>
              <tbody>
                {[...template.checklistSnapshot]
                  .sort((a, b) => a.sequenceNo - b.sequenceNo)
                  .map((c) => (
                    <tr key={c.sequenceNo}>
                      <td style={{ color: '#6b7280' }}>{c.sequenceNo}</td>
                      <td>{c.title}</td>
                      <td style={{ color: '#4b5563' }}>{CHECKLIST_ANSWER_TYPE_LABELS[c.answerType] ?? c.answerType}</td>
                      <td style={{ color: '#4b5563' }}>{c.isRequired ? 'Có' : 'Không'}</td>
                      <td style={{ color: '#4b5563' }}>{c.isBlocking ? 'Có' : 'Không'}</td>
                      <td style={{ color: '#4b5563' }}>{c.requiresPhoto ? 'Có' : 'Không'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Lưu ý nghiệp vụ</span>
        </div>
        <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
          Sửa mẫu không thay đổi Work Order đã tạo — WO giữ snapshot khi áp dụng.
          Mẫu không bị xóa vĩnh viễn: Nháp → Hoạt động → Ngừng hoạt động, có thể kích
          hoạt lại khi cần.
        </p>
      </Card>

      <WorkOrderTemplateEditDialog
        id={template.id}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onUpdated={() => void load()}
      />
      <WorkOrderTemplateStatusDialog
        template={template}
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        onChanged={(updated) => {
          setTemplate(updated);
          if (updated.alreadyInState) {
            setActionSuccess('Mẫu công việc đã ở trạng thái này — không có thay đổi.');
          } else if (updated.status === 'ACTIVE') {
            setActionSuccess('Đã kích hoạt — có thể dùng cho work order mới.');
          } else {
            setActionSuccess('Đã chuyển sang Ngừng hoạt động — không dùng cho work order mới, work order cũ giữ nguyên snapshot.');
          }
        }}
      />
    </div>
  );
}
