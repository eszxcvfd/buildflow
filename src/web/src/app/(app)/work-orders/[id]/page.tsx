'use client';

import * as React from 'react';
import { getWorkOrder, type WorkOrder, type ApiError } from '@/lib/api/work-orders';
import {
  getWorkOrderPublishCheck,
  type PublishCheckResult,
  type ReadinessApiError,
} from '@/lib/api/work-order-readiness';
import { listTrades } from '@/lib/api/trades';
import { listProjectAreas } from '@/lib/api/projects';
import { WorkOrderReadinessPanel } from '@/features/work-orders/components/WorkOrderReadinessPanel';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';

const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp',
  READY: 'Sẵn sàng',
};

const WORK_ORDER_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Thấp',
  NORMAL: 'Thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
};

function formatDateTime(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('vi-VN');
}

/**
 * JOB-SRS-002 (issue #42) — trang chi tiết Work Order (read-only, deep-link).
 * Fetch `GET :id` + `GET :id/publish-check` song song; panel điều kiện công bố
 * tự quản lý retry riêng. WO chưa có list page nên route này chưa có trong nav.
 */
export default function WorkOrderDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [workOrder, setWorkOrder] = React.useState<WorkOrder | null>(null);
  const [tradeLabel, setTradeLabel] = React.useState<string | null>(null);
  const [areaLabel, setAreaLabel] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [check, setCheck] = React.useState<PublishCheckResult | null>(null);
  const [checkLoading, setCheckLoading] = React.useState(true);
  const [checkError, setCheckError] = React.useState<ReadinessApiError | null>(null);

  const loadCheck = React.useCallback(async () => {
    setCheckLoading(true);
    setCheckError(null);
    try {
      setCheck(await getWorkOrderPublishCheck(id));
    } catch (e) {
      setCheckError(e as ReadinessApiError);
    } finally {
      setCheckLoading(false);
    }
  }, [id]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const wo = await getWorkOrder(id);
      setWorkOrder(wo);
      if (wo.requiredTradeId) {
        try {
          const trades = await listTrades({ status: 'ALL', limit: 100, offset: 0 });
          const t = trades.data.find((x) => x.id === wo.requiredTradeId);
          setTradeLabel(t ? `${t.code} — ${t.name}` : null);
        } catch {
          setTradeLabel(null);
        }
      } else {
        setTradeLabel(null);
      }
      if (wo.areaId) {
        try {
          const areas = await listProjectAreas(wo.projectId);
          const a = areas.data.find((x) => x.id === wo.areaId);
          setAreaLabel(a ? (a.code ? `${a.code} — ${a.name}` : a.name) : null);
        } catch {
          setAreaLabel(null);
        }
      } else {
        setAreaLabel(null);
      }
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
    void loadCheck();
  }, [id, loadCheck]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function handleRetry() {
    void load();
  }

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải chi tiết work order…</p>
      </Card>
    );
  }
  if (error) {
    if (error.status === 401) {
      return (
        <Card>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/login">Đến trang đăng nhập</a>
          </div>
        </Card>
      );
    }
    if (error.status === 403) {
      return (
        <Card>
          <Alert tone="error">Không có quyền truy cập — cần là thành viên dự án chứa work order này (403)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={handleRetry}>
              Thử lại
            </Button>
          </div>
        </Card>
      );
    }
    if (error.status === 404) {
      return (
        <Card>
          <Alert tone="error">Không tìm thấy work order (404) — kiểm tra lại đường dẫn</Alert>
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
        <Alert tone="error">{error.message || 'Không thể tải chi tiết'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={handleRetry}>
            Thử lại
          </Button>
        </div>
      </Card>
    );
  }
  if (!workOrder) {
    return (
      <Card>
        <p>Không có dữ liệu.</p>
      </Card>
    );
  }

  const statusLabel = WORK_ORDER_STATUS_LABELS[workOrder.status] ?? workOrder.status;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <div className="bf-profile-head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{workOrder.title}</h1>
              <span className="bf-chip">{workOrder.code}</span>
              <span className={`bf-badge ${workOrder.status === 'READY' ? 'bf-badge-ok' : 'bf-badge-busy'}`}>
                {statusLabel}
              </span>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
              <a href={`/projects/${workOrder.projectId}`}>Về dự án</a>
            </div>
          </div>
        </div>

        <dl className="bf-def-grid">
          <div>
            <dt>Mô tả</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{workOrder.description || '—'}</dd>
          </div>
          <div>
            <dt>Hướng dẫn thi công</dt>
            <dd style={{ whiteSpace: 'pre-wrap' }}>{workOrder.instructions || '—'}</dd>
          </div>
          <div>
            <dt>Khu vực</dt>
            <dd>{!workOrder.areaId ? '—' : (areaLabel ?? `${workOrder.areaId.slice(0, 8)}…`)}</dd>
          </div>
          <div>
            <dt>Loại công việc</dt>
            <dd>
              <a href={`/work-types/${workOrder.workTypeId}`}>
                {workOrder.workTypeName ?? `${workOrder.workTypeId.slice(0, 8)}…`}
              </a>
            </dd>
          </div>
          <div>
            <dt>Ngành nghề</dt>
            <dd>{!workOrder.requiredTradeId ? '—' : (tradeLabel ?? `${workOrder.requiredTradeId.slice(0, 8)}…`)}</dd>
          </div>
          <div>
            <dt>Ưu tiên</dt>
            <dd>{WORK_ORDER_PRIORITY_LABELS[workOrder.priority] ?? workOrder.priority}</dd>
          </div>
          <div>
            <dt>Lịch kế hoạch</dt>
            <dd>
              {formatDateTime(workOrder.plannedStartAt)} → {formatDateTime(workOrder.plannedEndAt)}
            </dd>
          </div>
          <div>
            <dt>Số người dự kiến</dt>
            <dd>{workOrder.plannedHeadcount != null ? workOrder.plannedHeadcount : '—'}</dd>
          </div>
        </dl>
      </Card>

      <WorkOrderReadinessPanel
        check={check}
        loading={checkLoading}
        error={checkError}
        onRetry={() => void loadCheck()}
      />
    </div>
  );
}
