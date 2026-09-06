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

function badgeFor(passed: boolean | null): { text: string; tone: 'ok' | 'risk' | 'idle' } {
  if (passed === true) return { text: 'ĐẠT', tone: 'ok' };
  if (passed === false) return { text: 'KHÔNG ĐẠT', tone: 'risk' };
  return { text: 'KHÔNG ĐÁNH GIÁ ĐƯỢC', tone: 'idle' };
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
  compact,
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

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <Alert tone={result.eligible ? 'success' : 'error'}>
        {result.eligible ? 'Đủ điều kiện nhận việc — cho phép phân công' : 'Không đủ điều kiện nhận việc — chặn phân công mới, lịch sử vẫn giữ'}
      </Alert>

      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: compact ? '0.5rem' : '0.75rem' }}>
        {result.conditions.map((c: EligibilityCondition) => {
          const badge = badgeFor(c.passed);
          return (
            <li
              key={c.code}
              style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}
            >
              <span className={`bf-badge bf-badge-${badge.tone}`} style={{ flexShrink: 0, marginTop: 2 }}>
                {badge.text}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem' }}>
                  {conditionLabel(c.code)}
                </span>
                <span style={{ display: 'block', color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
                  {c.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

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
