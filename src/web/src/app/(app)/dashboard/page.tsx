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
.bf-dash-widgets { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 16px; align-items: start; }
.bf-dash-widgets > * { min-width: 0; }
@media (max-width: 1079px) { .bf-dash-widgets { grid-template-columns: 1fr; } }
`;

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
    <div style={{ display: 'grid', gap: 16 }}>
      <style>{WIDGET_GRID_CSS}</style>
      <PageHeader title="Tổng quan" subtitle={subtitle || undefined} />

      <div className="bf-kpi-grid">
        <KpiCard label="Dự án" {...kpiCardProps(projectsKpiState(overview))} />
        <KpiCard label="Nhà thầu" {...kpiCardProps(contractorsKpi)} />
        <KpiCard label="Công nhân" {...kpiCardProps(workersKpi)} />
        <KpiCard label="Tài khoản" {...kpiCardProps(accountsKpi)} />
      </div>

      <div className="bf-dash-widgets">
        <ProjectsByStatus />
        <RecentProjectsTable projects={overview.projects} loading={overview.loading} error={overview.error} />
      </div>
    </div>
  );
}
