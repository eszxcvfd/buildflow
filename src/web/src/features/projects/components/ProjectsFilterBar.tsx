'use client';

import { Select } from '@/components/ui/select/Select';
import { SearchField } from '@/components/ui/list/ListKit';

/**
 * Web redesign — filter strip: segmented tabs (Tất cả/Thi công/Bản nháp +
 * counts client-side) + Select trạng thái (giữ id `projects-status` cho
 * E2E driver) + search (giữ id `projects-search`).
 * Tab và Select cùng điều khiển một filter `status` duy nhất do cha sở hữu.
 */

export type ProjectTab = 'ALL' | 'ACTIVE' | 'DRAFT';

export const PROJECT_STATUS_OPTIONS = ['ALL', 'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CLOSED'] as const;

export const PROJECT_STATUS_LABEL: Record<(typeof PROJECT_STATUS_OPTIONS)[number], string> = {
  ALL: 'Tất cả trạng thái',
  DRAFT: 'Nháp',
  ACTIVE: 'Đang hoạt động',
  PAUSED: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CLOSED: 'Đóng',
};

export function ProjectsFilterBar({
  status,
  onStatusChange,
  search,
  onSearchChange,
  counts,
}: {
  status: (typeof PROJECT_STATUS_OPTIONS)[number];
  onStatusChange: (value: (typeof PROJECT_STATUS_OPTIONS)[number]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  counts: { all: number; active: number; draft: number };
}) {
  const tabs: Array<{ key: ProjectTab; label: string; count: number }> = [
    { key: 'ALL', label: 'Tất cả', count: counts.all },
    { key: 'ACTIVE', label: 'Thi công', count: counts.active },
    { key: 'DRAFT', label: 'Bản nháp', count: counts.draft },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div
        className="flex items-center gap-0.5 rounded-md bg-zinc-200/60 p-0.5 text-xs"
        role="tablist"
        aria-label="Lọc nhanh theo trạng thái"
      >
        {tabs.map((t) => {
          const selected = status === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onStatusChange(t.key)}
              className={
                selected
                  ? 'rounded bg-white px-2 py-0.5 font-medium text-zinc-900 shadow-sm'
                  : 'rounded px-2 py-0.5 text-zinc-600 hover:text-zinc-900'
              }
            >
              {t.label} ({t.count})
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          id="projects-search"
          label="Tìm kiếm"
          placeholder="Nhập tên hoặc mã dự án…"
          value={search}
          onChange={onSearchChange}
        />
        <Select
          id="projects-status"
          label="Trạng thái"
          hideLabel
          value={status}
          options={PROJECT_STATUS_OPTIONS.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] }))}
          onChange={(v) => onStatusChange(v as (typeof PROJECT_STATUS_OPTIONS)[number])}
        />
      </div>
    </div>
  );
}
