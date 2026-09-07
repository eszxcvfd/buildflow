'use client';

import * as React from 'react';
import { listAuditLogs, type AuditLog } from '@/lib/api/audit-logs';
import type { AuditLogError } from '@/lib/api/audit-logs';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';

/**
 * ORG-SRS-004 (issue #27) — 'Lịch sử trạng thái': dòng thời gian status transition
 * của worker/contractor, đọc từ audit API hiện có
 * GET /api/v1/audit-logs?entityType=WORKER|CONTRACTOR&entityId=:id (admin-only;
 * repo lọc entity_type/entity_id + ORDER BY created_at DESC).
 * ORG-SRS-006 (issue #29) — mở rộng cho đội thi công (`entityType: 'CREW'`,
 * audit actions ORG_CREW_*). Audit-logs API giữ admin-only nên non-admin thấy
 * ghi chú quyền (branch 401/403 có sẵn).
 * PRJ-SRS-002 (issue #33) — mở rộng cho dự án (`entityType: 'PROJECT'`,
 * audit action PRJ_PROJECT_STATUS_CHANGED; history = audit_logs, không bảng
 * transitions riêng). PM thấy ghi chú quyền như CREW (audit-logs admin-only).
 * Render tối đa 10 dòng + link 'Xem tất cả' sang /admin/audit-logs với filter sẵn.
 * Actor hiển thị short-id; không render beforeData/afterData (có thể chứa dữ liệu nhạy cảm).
 */
const TIMELINE_LIMIT = 10;

const LIFECYCLE_ACTION_LABEL: Record<string, string> = {
  ORG_WORKER_REACTIVATED: 'Kích hoạt lại',
  ORG_WORKER_SUSPENDED: 'Tạm ngừng',
  ORG_WORKER_TERMINATED: 'Chấm dứt',
  ORG_CONTRACTOR_REACTIVATED: 'Kích hoạt lại',
  ORG_CONTRACTOR_SUSPENDED: 'Tạm ngừng',
  ORG_CONTRACTOR_TERMINATED: 'Chấm dứt',
  ORG_CREW_CREATED: 'Tạo đội',
  ORG_CREW_UPDATED: 'Cập nhật hồ sơ',
  ORG_CREW_LEAD_CHANGED: 'Đổi trưởng nhóm',
  ORG_CREW_REACTIVATED: 'Kích hoạt lại',
  ORG_CREW_SUSPENDED: 'Tạm ngừng',
  ORG_CREW_TERMINATED: 'Chấm dứt',
  ORG_CREW_MEMBER_ADDED: 'Thêm thành viên',
  ORG_CREW_MEMBER_REMOVED: 'Xóa thành viên',
  PRJ_PROJECT_STATUS_CHANGED: 'Đổi trạng thái dự án',
  PRJ_PROJECT_MEMBER_ADDED: 'Thêm thành viên dự án',
  PRJ_PROJECT_MEMBER_REMOVED: 'Xóa thành viên dự án',
};

const LIFECYCLE_STATUS_ACTIONS = new Set(Object.keys(LIFECYCLE_ACTION_LABEL));

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'medium' });
}

function shortenActor(v: string | null): string {
  if (!v) return 'Hệ thống';
  return v.length > 12 ? `${v.slice(0, 8)}…` : v;
}

export function StatusTimeline({ id, entityType }: { id: string; entityType: 'WORKER' | 'CONTRACTOR' | 'CREW' | 'PROJECT' }) {
  const [logs, setLogs] = React.useState<AuditLog[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [error, setError] = React.useState<AuditLogError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await listAuditLogs({
        entityType,
        entityId: id,
        result: 'SUCCESS',
        limit: TIMELINE_LIMIT,
        offset: 0,
      });
      setLogs(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as AuditLogError);
    }
  }, [id, entityType]);

  React.useEffect(() => {
    setLogs(null);
    void load();
  }, [load, retryKey]);

  if (error) {
    if (error.status === 401 || error.status === 403) {
      return (
        <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
          Không có quyền xem lịch sử trạng thái ({error.status === 401 ? 'phiên hết hạn' : 'cần ADMIN'}) — vào{' '}
          <a href="/admin/audit-logs">Nhật ký thao tác</a> nếu cần truy vết.
        </p>
      );
    }
    return (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <Alert tone="error">{error.message || 'Không thể tải lịch sử trạng thái'}</Alert>
        <div>
          <Button variant="secondary" onClick={() => setRetryKey((k) => k + 1)}>Thử lại</Button>
        </div>
      </div>
    );
  }

  if (logs === null) {
    return (
      <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.85rem' }} aria-busy="true">
        Đang tải lịch sử trạng thái…
      </p>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <EmptyState title="Chưa có lịch sử thay đổi trạng thái">
          Các thao tác kích hoạt, tạm ngừng, chấm dứt (và ghi chép tạo/cập nhật hồ sơ) sẽ xuất hiện
          tại đây khi phát sinh.
        </EmptyState>
      </Card>
    );
  }

  // Deep-link sang /admin/audit-logs: CHỈ entityType + entityId + result.
  // KHÔNG kèm param action — API audit lọc action EXACT-MATCH nên prefix
  // 'ORG_WORKER'/'ORG_CONTRACTOR' cho 0 dòng (E2E ORG-SRS-004 B5). entityType +
  // entityId + result=SUCCESS đã đủ chính xác; AuditLogList đọc 3 param này
  // qua useSearchParams và truyền thẳng cho GET /api/v1/audit-logs.
  const allHref = `/admin/audit-logs?entityType=${entityType}&entityId=${encodeURIComponent(id)}&result=SUCCESS`;

  return (
    <div style={{ display: 'grid', gap: '0.6rem' }}>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {logs.map((log) => {
          const label = LIFECYCLE_ACTION_LABEL[log.action] ?? log.action;
          const isStatusAction = LIFECYCLE_STATUS_ACTIONS.has(log.action);
          return (
            <div
              key={log.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '170px minmax(130px, auto) 1fr',
                gap: '0.5rem 0.75rem',
                fontSize: '0.87rem',
                alignItems: 'start',
              }}
            >
              <span style={{ color: 'var(--bf-muted)', whiteSpace: 'nowrap' }}>{formatDateTime(log.createdAt)}</span>
              <span style={{ fontWeight: 600 }}>{label}</span>
              <span style={{ color: 'var(--bf-muted)', overflowWrap: 'anywhere', minWidth: 0 }}>
                {isStatusAction && log.reason ? `Lý do: ${log.reason}` : ''} · {shortenActor(log.actorUserId)}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: '0.85rem' }}>
        {total > logs.length ? (
          <a href={allHref} style={{ color: '#1d4ed8', textDecoration: 'underline' }}>
            Xem tất cả {total} bản ghi trên Nhật ký thao tác
          </a>
        ) : (
          <a href={allHref} style={{ color: '#1d4ed8', textDecoration: 'underline' }}>
            Xem trên Nhật ký thao tác
          </a>
        )}
      </p>
    </div>
  );
}
