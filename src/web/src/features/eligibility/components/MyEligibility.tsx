'use client';

import * as React from 'react';
import { checkMyEligibility, type ApiError, type WorkerEligibilityResult } from '@/lib/api/eligibility';
import { EligibilityChecklist } from './EligibilityChecklist';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';

/**
 * ORG-SRS-008 (issue #31) — trang tự kiểm tra điều kiện nhận việc cho mọi
 * user đã đăng nhập (GET /api/v1/eligibility/me). 404 RESOURCE_NOT_FOUND
 * ('user không có hồ sơ worker') → empty state, không báo lỗi.
 */
export function MyEligibility() {
  const [result, setResult] = React.useState<WorkerEligibilityResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [missingProfile, setMissingProfile] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissingProfile(false);
    try {
      const r = await checkMyEligibility();
      setResult(r);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 404) {
        setResult(null);
        setMissingProfile(true);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  if (loading && result === null && !missingProfile && !error) {
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <PageHeader title="Điều kiện nhận việc của tôi" subtitle="Tự kiểm tra trước khi nhận phân công" />
        <Card><p aria-busy="true" style={{ margin: 0 }}>Đang kiểm tra điều kiện nhận việc…</p></Card>
      </div>
    );
  }

  if (missingProfile) {
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <PageHeader title="Điều kiện nhận việc của tôi" subtitle="Tự kiểm tra trước khi nhận phân công" />
        <Card>
          <EmptyState title="Tài khoản không có hồ sơ worker">
            Tài khoản này chưa liên kết hồ sơ công nhân nên chưa thể tự kiểm tra điều kiện nhận việc.
            Liên hệ quản trị để tạo hồ sơ worker.
          </EmptyState>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (error && result === null) {
    if (error.status === 401) {
      return (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <PageHeader title="Điều kiện nhận việc của tôi" subtitle="Tự kiểm tra trước khi nhận phân công" />
          <Card>
            <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
            <div style={{ marginTop: '0.75rem' }}><a href="/login">Đến trang đăng nhập</a></div>
          </Card>
        </div>
      );
    }
    if (error.status === 403) {
      return (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <PageHeader title="Điều kiện nhận việc của tôi" subtitle="Tự kiểm tra trước khi nhận phân công" />
          <Card>
            <Alert tone="error">Không có quyền xem điều kiện nhận việc (403)</Alert>
            <div style={{ marginTop: '0.75rem' }}>
              <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>
            </div>
          </Card>
        </div>
      );
    }
    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <PageHeader title="Điều kiện nhận việc của tôi" subtitle="Tự kiểm tra trước khi nhận phân công" />
        <Card>
          <Alert tone="error">{error.message || 'Không thể kiểm tra điều kiện nhận việc'}</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>
          </div>
        </Card>
      </div>
    );
  }

  // `result` chỉ null ở các nhánh đã return sớm; ở đây dùng crews rỗng dự phòng.
  const crews = result?.crews ?? [];
  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <PageHeader title="Điều kiện nhận việc của tôi" subtitle="Tự kiểm tra trước khi nhận phân công" />
      <Card>
        <EligibilityChecklist result={result} loading={loading} error={error} onRefresh={() => void load()} />
      </Card>
      <Card>
        <div className="bf-card-head">
          <span className="bf-card-title">Đội thi công</span>
        </div>
        {crews.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--bf-muted)', fontSize: '0.9rem' }}>Chưa thuộc đội nào</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '0.5rem' }}>
            {crews.map((m) => (
              <li key={m.crewId} style={{ display: 'grid', gap: '0.15rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.crewCode} · {m.crewName}</span>
                <span style={{ color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
                  Vai trò: {m.memberRole} · Hiệu lực: {m.effectiveFrom} – {m.effectiveTo ?? 'hiện tại'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
