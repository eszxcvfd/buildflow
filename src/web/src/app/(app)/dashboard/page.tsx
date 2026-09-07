'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { getAuth } from '@/lib/auth/storage';
import {
  KpiCard,
  ProjectsByStatus,
  RecentProjectsTable,
  kpiCardProps,
  loadAccountsKpi,
  loadContractorsKpi,
  loadWorkersKpi,
  projectsKpiState,
  useKpi,
  useProjectsOverview,
} from '@/features/dashboard';

/**
 * Layout 2 widget: bar chart 3fr / bảng gần đây 2fr trên desktop (≥1080px),
 * dồn 1 cột trên màn hẹp. CSS riêng của dashboard, không đụng globals.css.
 */
const WIDGET_GRID_CSS = `
.bf-dash-widgets { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 24px; align-items: start; }
.bf-dash-widgets > * { min-width: 0; }
@media (max-width: 1079px) { .bf-dash-widgets { grid-template-columns: 1fr; } }
`;

/**
 * DashCode stage 3 — icon chip cho stat-card (inline SVG, stroke currentColor).
 */
function KpiIcon({ d }: { d: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/**
 * Route (app)/dashboard đã được AppShell bọc (guard + sidebar + đăng xuất) —
 * page assume đã đăng nhập, chỉ đọc getAuth() để chào theo tên.
 */
export default function DashboardPage() {
  const overview = useProjectsOverview();
  const contractorsKpi = useKpi(loadContractorsKpi);
  const workersKpi = useKpi(loadWorkersKpi);
  const accountsKpi = useKpi(loadAccountsKpi, 'Cần quyền quản trị');

  // Đọc auth/ngày sau mount để tránh lệch hydration với bản prerender tĩnh.
  const [fullName, setFullName] = React.useState('');
  const [today, setToday] = React.useState('');
  React.useEffect(() => {
    setFullName(getAuth()?.user.fullName ?? '');
    setToday(
      new Date().toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    );
  }, []);

  const subtitle = fullName
    ? `Xin chào ${fullName} — hôm nay ${today}`
    : today
      ? `Hôm nay ${today}`
      : '';

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <style>{WIDGET_GRID_CSS}</style>
      <PageHeader title="Tổng quan" subtitle={subtitle || undefined} />

      <div className="bf-kpi-grid">
        <KpiCard
          label="Dự án"
          {...kpiCardProps(projectsKpiState(overview))}
          tone="primary"
          icon={<KpiIcon d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Zm-9-3H5a1 1 0 0 0-1 1v2h7V5a1 1 0 0 0-1-1Z" />}
        />
        <KpiCard
          label="Nhà thầu"
          {...kpiCardProps(contractorsKpi)}
          tone="danger"
          icon={<KpiIcon d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.008v.008H6.75V6.75Z" />}
        />
        <KpiCard
          label="Công nhân"
          {...kpiCardProps(workersKpi)}
          tone="success"
          icon={<KpiIcon d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Z" />}
        />
        <KpiCard
          label="Tài khoản"
          {...kpiCardProps(accountsKpi)}
          tone="info"
          icon={<KpiIcon d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />}
        />
      </div>

      <div className="bf-dash-widgets">
        <ProjectsByStatus />
        <RecentProjectsTable projects={overview.projects} loading={overview.loading} error={overview.error} />
      </div>
    </div>
  );
}
