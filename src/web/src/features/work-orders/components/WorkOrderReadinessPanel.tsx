'use client';

import * as React from 'react';
import type { PublishCheckResult, ReadinessApiError } from '@/lib/api/work-order-readiness';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';

export interface WorkOrderReadinessPanelProps {
  /** Kết quả publish-check mới nhất; null khi chưa có (check lỗi hoặc chưa chạy). */
  check: PublishCheckResult | null;
  loading: boolean;
  error: ReadinessApiError | null;
  /** Chạy lại kiểm tra (chỉ re-fetch publish-check, không chạm WO). */
  onRetry: () => void;
}

/**
 * JOB-SRS-002 (issue #42) — panel "Điều kiện công bố" (read-only, advisory).
 * - ready → badge xanh + note chờ lệnh công bố (JOB-SRS-004).
 * - unmet → từng mục kèm icon cảnh báo + code + message + field.
 * - Nút Publish/Phân công luôn disabled ở slice này (lệnh công bố thuộc #44,
 *   phân công thuộc #47) kèm tooltip lý do.
 */
export function WorkOrderReadinessPanel({ check, loading, error, onRetry }: WorkOrderReadinessPanelProps) {
  if (loading) {
    return (
      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Điều kiện công bố</span>
        </div>
        <p aria-busy="true" style={{ margin: 0 }}>
          Đang kiểm tra điều kiện công bố…
        </p>
      </Card>
    );
  }

  if (error) {
    if (error.status === 401) {
      return (
        <Card>
          <div className="bf-card-head">
            <span className="bf-card-title">Điều kiện công bố</span>
          </div>
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
          <div className="bf-card-head">
            <span className="bf-card-title">Điều kiện công bố</span>
          </div>
          <Alert tone="error">
            Không có quyền xem điều kiện công bố — cần là thành viên dự án chứa work order này (403)
          </Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={onRetry}>
              Kiểm tra lại
            </Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Điều kiện công bố</span>
        </div>
        <Alert tone="error">{error.message || 'Không thể kiểm tra điều kiện công bố'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={onRetry}>
            Kiểm tra lại
          </Button>
        </div>
      </Card>
    );
  }

  if (!check) {
    return (
      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Điều kiện công bố</span>
        </div>
        <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Chưa có kết quả kiểm tra.</p>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={onRetry}>
            Kiểm tra lại
          </Button>
        </div>
      </Card>
    );
  }

  if (check.ready) {
    return (
      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Điều kiện công bố</span>
          <span className="bf-badge bf-badge-ok">Đủ điều kiện công bố</span>
        </div>
        <Alert tone="success">Work order đã đủ điều kiện công bố — chờ lệnh công bố (JOB-SRS-004).</Alert>
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={onRetry}>
            Kiểm tra lại
          </Button>
          <span title="Chờ lệnh công bố (JOB-SRS-004)">
            <Button variant="primary" disabled>
              Công bố
            </Button>
          </span>
          <span title="Phân công thuộc JOB-SRS-007 (chưa mở ở slice này)">
            <Button variant="secondary" disabled>
              Phân công
            </Button>
          </span>
        </div>
      </Card>
    );
  }

  const reason = `Chưa đủ điều kiện công bố: ${check.unmet.length} mục chưa đạt`;
  return (
    <Card>
      <div className="bf-card-head">
        <span className="bf-card-title">Điều kiện công bố</span>
        <span className="bf-badge bf-badge-risk">Chưa đủ điều kiện ({check.unmet.length})</span>
      </div>
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
        {check.unmet.map((u) => (
          <li
            key={`${u.code}:${u.field}`}
            style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}
          >
            <span aria-hidden="true" style={{ color: 'var(--bf-risk)' }}>
              ⚠
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="bf-chip" title={u.field}>
                {u.code}
              </span>{' '}
              <span>{u.message}</span>{' '}
              <span style={{ color: 'var(--bf-muted)', fontSize: '0.85rem' }}>({u.field})</span>
            </span>
          </li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <Button variant="secondary" onClick={onRetry}>
          Kiểm tra lại
        </Button>
        <span title={reason}>
          <Button variant="primary" disabled>
            Công bố
          </Button>
        </span>
        <span title={reason}>
          <Button variant="secondary" disabled>
            Phân công
          </Button>
        </span>
      </div>
    </Card>
  );
}
