import { listContractors } from '@/lib/api/contractors';
import { listWorkers } from '@/lib/api/workers';
import { listAdminUsers } from '@/lib/api/admin-users';
import type { KpiData, KpiState } from './hooks/useKpi';
import { kpiErrorNote } from './hooks/useKpi';
import type { ProjectsOverview } from './hooks/useProjectsOverview';

/**
 * Các loader KPI chạy độc lập — hàm module-scope để useKpi không re-run effect.
 * Ghi chú: lib/api/listProjects() không nhận tham số lọc status, nên số "đang chạy"
 * được đếm client-side từ chính danh sách trả về (fetch limit 100 — server cap).
 */

export async function loadContractorsKpi(): Promise<KpiData> {
  const res = await listContractors();
  return { value: String(res.total) };
}

export async function loadWorkersKpi(): Promise<KpiData> {
  const res = await listWorkers();
  return { value: String(res.total) };
}

/**
 * listAdminUsers chỉ trả `{ data }` (không có total) và server giới hạn limit ≤ 100,
 * nên gọi với limit 100; nếu đủ 100 bản ghi thì hiển thị "100+" để trung thực.
 */
export async function loadAccountsKpi(): Promise<KpiData> {
  const res = await listAdminUsers({ limit: 100 });
  const n = res.data.length;
  return { value: n >= 100 ? `${n}+` : String(n) };
}

/** KPI "Dự án" dùng chung kết quả fetch của useProjectsOverview (tránh gọi API lần nữa). */
export function projectsKpiState(overview: ProjectsOverview): KpiState {
  if (overview.loading) return { loading: true, data: null, errorNote: null };
  if (overview.error) return { loading: false, data: null, errorNote: kpiErrorNote(overview.error) };
  const active = overview.projects.filter((p) => p.status === 'ACTIVE').length;
  return {
    loading: false,
    data: { value: String(overview.projects.length), note: `${active} đang chạy` },
    errorNote: null,
  };
}
