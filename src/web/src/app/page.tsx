import type { CSSProperties } from 'react';
import { BrandMark } from '@/components/layout/BrandMark';
import { fetchStatus, fetchHealthLive, fetchHealthReady } from '@/lib/api/client';
import type { ApiStatus, HealthLive, HealthReady } from '@/lib/api/client';

export const dynamic = 'force-dynamic';

const preStyle: CSSProperties = {
  margin: 0,
  padding: '12px 14px',
  background: 'var(--bf-surface-2)',
  border: '1px solid var(--bf-line)',
  borderRadius: 'var(--bf-r-control)',
  fontSize: 12.5,
  lineHeight: 1.5,
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

export default async function HomePage() {
  let status: ApiStatus | null = null;
  let live: HealthLive | null = null;
  let ready: HealthReady | null = null;
  let error: string | null = null;

  try {
    [status, live, ready] = await Promise.all([fetchStatus(), fetchHealthLive(), fetchHealthReady()]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="bf-content" style={{ maxWidth: 860, paddingTop: 40 }}>
      <header className="bf-page-head" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <BrandMark size={34} />
        <div>
          <h1 style={{ fontSize: 22 }}>Buildflow — trạng thái hệ thống</h1>
          <p className="bf-page-head-sub">Sàn điều hành thi công: dự án, nhà thầu, công nhân.</p>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <a className="bf-btn bf-btn-primary" href="/login">
          Đăng nhập
        </a>
        <a className="bf-btn bf-btn-secondary" href="/dashboard">
          Vào bảng điều khiển
        </a>
      </nav>

      {error ? (
        <div className="bf-card">
          <div className="bf-alert bf-tone-risk" role="alert">
            <p style={{ margin: '0 0 6px', fontWeight: 600 }}>Không kết nối được API</p>
            <p style={{ margin: 0 }}>{error}</p>
            <p style={{ margin: '6px 0 0', color: 'var(--bf-muted)' }}>
              Kiểm tra dịch vụ API đã chạy tại địa chỉ cấu hình chưa.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <section className="bf-card" aria-labelledby="api-status">
            <div className="bf-card-head">
              <h2 className="bf-card-title" id="api-status">
                API v1
              </h2>
            </div>
            <pre style={preStyle}>{JSON.stringify(status, null, 2)}</pre>
          </section>

          <section className="bf-card" aria-labelledby="health-live">
            <div className="bf-card-head">
              <h2 className="bf-card-title" id="health-live">
                Liveness
              </h2>
            </div>
            <pre style={preStyle}>{JSON.stringify(live, null, 2)}</pre>
          </section>

          <section className="bf-card" aria-labelledby="health-ready">
            <div className="bf-card-head">
              <h2 className="bf-card-title" id="health-ready">
                Readiness
              </h2>
            </div>
            <pre style={preStyle}>{JSON.stringify(ready, null, 2)}</pre>
          </section>
        </div>
      )}
    </div>
  );
}
