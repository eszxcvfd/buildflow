'use client';

/**
 * Web redesign — metric strip 4 ô divide-x theo mẫu.
 * Pure (props = counts đã derive). Hai ô phải là placeholder trung thực
 * ('—' + sub-label) vì read-side không có budget/progress field.
 */
export function ProjectsMetrics({ total, active }: { total: number; active: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200 md:grid-cols-4"
      role="region"
      aria-label="Tổng quan dự án"
    >
      <div className="bg-white p-2.5 px-3" data-testid="projects-metric-total">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Tổng dự án
        </span>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="bf-mono text-lg font-bold text-zinc-900">{String(total).padStart(2, '0')}</span>
          <span className="text-[10px] font-normal text-zinc-400">dự án</span>
        </div>
      </div>
      <div className="bg-white p-2.5 px-3" data-testid="projects-metric-active">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Đang thi công
        </span>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="bf-mono text-lg font-bold text-emerald-600">{String(active).padStart(2, '0')}</span>
          <span className="text-[10px] font-medium text-emerald-600/80">đang hoạt động</span>
        </div>
      </div>
      <div className="bg-white p-2.5 px-3" data-testid="projects-metric-budget">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Tổng giải ngân
        </span>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="bf-mono text-lg font-bold tabular-nums text-zinc-900">—</span>
          <span className="text-[10px] font-normal text-zinc-400">Chưa có dữ liệu ngân sách</span>
        </div>
      </div>
      <div className="bg-amber-50/40 p-2.5 px-3" data-testid="projects-metric-delay">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-amber-700">
          Cảnh báo trễ
        </span>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="bf-mono text-lg font-bold text-amber-700">—</span>
          <span className="text-[10px] font-medium text-amber-600">Chưa có dữ liệu tiến độ</span>
        </div>
      </div>
    </div>
  );
}
