'use client';

import * as React from 'react';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import type { ApiError, EligibilityCondition, EligibilityResult } from '@/lib/api/eligibility';

function conditionLabel(code: string): string {
  switch (code) {
    case 'RESOURCE_ACTIVE': return 'Hồ sơ hiệu lực';
    case 'TRADE_SKILL_MATCH': return 'Ngành nghề / kỹ năng';
    case 'TRADE_CAPABILITY_DATA': return 'Dữ liệu năng lực';
    case 'WORKLOAD': return 'Khối lượng công việc';
    case 'SCHEDULE_CONFLICT': return 'Trùng lịch';
    case 'MEMBER_COVERAGE': return 'Phủ thành viên';
    default: return code;
  }
}

export type ConditionBadgeTone = 'ok' | 'risk' | 'busy' | 'idle' | 'info';

/**
 * Map (passed, reasonCode) → badge { label, tone } theo contract
 * eligibility.policy.ts. Nhãn title-case tiếng Việt; tone dùng hệ
 * `.bf-badge-*` hiện có. reasonCode lạ → fallback theo `passed`.
 */
export function badgeFor(
  passed: boolean | null,
  reasonCode: string,
): { label: string; tone: ConditionBadgeTone } {
  switch (reasonCode) {
    case 'OK': return { label: 'Đạt', tone: 'ok' };
    case 'RESOURCE_LOCKED': return { label: 'Bị khóa', tone: 'risk' };
    case 'RESOURCE_INACTIVE': return { label: 'Ngừng hoạt động', tone: 'busy' };
    case 'TRADE_NOT_FOUND': return { label: 'Ngành nghề không tồn tại', tone: 'risk' };
    case 'TRADE_INACTIVE': return { label: 'Ngành nghề ngừng hoạt động', tone: 'busy' };
    case 'SKILL_LEVEL_TOO_LOW': return { label: 'Kỹ năng không đủ', tone: 'risk' };
    case 'CAPABILITY_DATA_MISSING': return { label: 'Thiếu dữ liệu năng lực', tone: 'busy' };
    case 'NO_ACTIVE_MEMBERS': return { label: 'Không có thành viên hoạt động', tone: 'risk' };
    case 'NOT_REQUESTED': return { label: 'Không áp dụng', tone: 'idle' };
    case 'NOT_EVALUABLE': return { label: 'Không đánh giá được', tone: 'idle' };
    default:
      if (passed === true) return { label: 'Đạt', tone: 'ok' };
      if (passed === false) return { label: 'Không đạt', tone: 'risk' };
      return { label: 'Không đánh giá được', tone: 'idle' };
  }
}

/**
 * ORG-SRS-008 (issue #31) — checklist điều kiện nhận việc dùng chung cho
 * worker, crew và tự kiểm tra. Một verdict banner + từng condition kèm chi
 * tiết; dữ liệu stale → nút kiểm tra lại (re-fetch). Lỗi hiển thị với
 * role=alert và nút thử lại.
 */
export function EligibilityChecklist({
  result,
  loading,
  error,
  onRefresh,
}: {
  result: EligibilityResult | null;
  loading: boolean;
  error: ApiError | null;
  onRefresh: () => void;
  compact?: boolean;
}) {
  if (loading && result === null) {
    return <p aria-busy="true" style={{ margin: 0, color: 'var(--bf-muted)' }}>Đang kiểm tra điều kiện nhận việc…</p>;
  }
  if (error && result === null) {
    if (error.status === 401) {
      return (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div><a href="/login">Đến trang đăng nhập</a></div>
        </div>
      );
    }
    if (error.status === 403) {
      return (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Alert tone="error">Không có quyền xem điều kiện nhận việc — cần ADMIN hoặc PROJECT_MANAGER (403)</Alert>
          <div><Button variant="secondary" onClick={onRefresh}>Thử lại</Button></div>
        </div>
      );
    }
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <Alert tone="error">{error.message || 'Không thể kiểm tra điều kiện nhận việc'}</Alert>
        <div><Button variant="secondary" onClick={onRefresh}>Thử lại</Button></div>
      </div>
    );
  }
  if (!result) {
    return <p style={{ margin: 0, color: 'var(--bf-muted)' }}>Không có dữ liệu.</p>;
  }

  const passedCount = result.conditions.filter((c) => c.passed === true).length;
  const naCount = result.conditions.filter((c) => c.passed === null).length;

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <Alert tone={result.eligible ? 'success' : 'error'}>
        <span className={`bf-badge bf-badge-${result.eligible ? 'ok' : 'risk'}`} style={{ marginRight: '0.5rem' }}>
          {result.eligible ? 'Đủ điều kiện' : 'Không đủ điều kiện'}
        </span>
        {result.eligible ? '— cho phép phân công mới' : '— chặn phân công mới, lịch sử vẫn giữ'}
      </Alert>

      <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
        {passedCount}/{result.conditions.length} điều kiện đạt · {naCount} không áp dụng
      </p>

      <div className="bf-table-wrap">
        <table className="bf-table">
          <thead>
            <tr>
              <th scope="col">Điều kiện</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {result.conditions.map((c: EligibilityCondition) => {
              const badge = badgeFor(c.passed, c.reasonCode);
              return (
                <tr key={c.code}>
                  <td style={{ fontWeight: 600 }}>{conditionLabel(c.code)}</td>
                  <td>
                    <span className={`bf-badge bf-badge-${badge.tone}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ color: 'var(--bf-muted)' }}>{c.detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.8rem' }}>
        Kiểm tra lúc {new Date(result.checkedAt).toLocaleString('vi-VN')} ·{' '}
        <span>Mã đối chiếu: {result.correlationId}</span>
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <Button variant="secondary" onClick={onRefresh} loading={loading} aria-busy={loading || undefined}>
          Kiểm tra lại
        </Button>
        {error ? (
          <span role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem' }}>
            Tải lại thất bại{error.message ? `: ${error.message}` : ''} — đang hiện kết quả trước đó.
          </span>
        ) : null}
      </div>
    </div>
  );
}
