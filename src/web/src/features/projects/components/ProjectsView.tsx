'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button/Button';
import { DownloadIcon, PlusIcon } from '@/components/ui/icons/Icons';
import { ViewToggle, useViewMode } from '@/components/ui/kanban/KanbanView';
import { useCanManageProjects } from '@/lib/auth/roles';
import { listProjects, type Project, type ProjectsError } from '@/lib/api/projects';
import { downloadCsv, projectsToCsv } from '../lib/exportCsv';
import { ProjectCreateDialog } from './ProjectCreateDialog';
import { ProjectInspector } from './ProjectInspector';
import { ProjectsFilterBar, type PROJECT_STATUS_OPTIONS } from './ProjectsFilterBar';
import { ProjectsKanban } from './ProjectsKanban';
import { ProjectsList } from './ProjectsList';
import { ProjectsMetrics } from './ProjectsMetrics';

type StatusFilter = (typeof PROJECT_STATUS_OPTIONS)[number];

/**
 * Web redesign — /projects "Data-Dense Operational Workspace" (full-bleed):
 * header + metric strip + filter strip + bảng 9 cột + Right Inspector 320px.
 * Fetch listProjects + search/status hoist tại đây (ProjectsList chỉ nhận
 * props + giữ pagination local). Chọn row → Inspector không reload; chuyển
 * sang kanban → xóa selection + ẩn Inspector (AC4). Inspector ẩn <1280px
 * bằng CSS (.prj-inspector media query).
 */
export function ProjectsView() {
  const canManage = useCanManageProjects();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ProjectsError | null>(null);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<StatusFilter>('ALL');
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = React.useState(true);
  const [seq, setSeq] = React.useState(0);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [view, setView] = useViewMode();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects({ limit: 100, offset: 0 });
      setProjects(data);
    } catch (e) {
      setError(e as ProjectsError);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load, seq]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== 'ALL' && p.status !== status) return false;
      if (q && !`${p.name} ${p.code}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, search, status]);

  const counts = React.useMemo(
    () => ({
      all: projects.length,
      active: projects.filter((p) => p.status === 'ACTIVE').length,
      draft: projects.filter((p) => p.status === 'DRAFT').length,
    }),
    [projects],
  );

  const hasFilter = search.trim() !== '' || status !== 'ALL';

  function handleSelect(id: string | null) {
    setSelectedId(id);
    if (id) setInspectorOpen(true);
  }

  function handleViewChange(next: 'table' | 'kanban') {
    setView(next);
    if (next === 'kanban') {
      // AC4: kanban view không inspector.
      setSelectedId(null);
      setInspectorOpen(false);
    } else {
      setInspectorOpen(true);
    }
  }

  function handleExportCsv() {
    downloadCsv('du-an.csv', projectsToCsv(filtered));
  }

  const showInspector = view === 'table' && selectedId !== null && inspectorOpen;
  const selectedProject = selectedId ? (projects.find((p) => p.id === selectedId) ?? null) : null;

  return (
    <div className="prj-workspace" data-testid="projects-workspace">
      <div className="prj-main">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-bold tracking-tight text-zinc-900">Danh mục dự án</h1>
            <p className="text-xs text-zinc-500">
              Giám sát tổng thể {counts.all} hợp đồng xây dựng đang thực thi
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle value={view} onChange={handleViewChange} />
            <Button variant="secondary" size="sm" onClick={handleExportCsv}>
              <DownloadIcon size={14} /> Xuất CSV
            </Button>
            {canManage ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <PlusIcon size={14} /> Thêm dự án
              </Button>
            ) : null}
          </div>
        </div>

        <ProjectsMetrics total={counts.all} active={counts.active} />

        {view === 'table' ? (
          <>
            <ProjectsFilterBar
              status={status}
              onStatusChange={(v) => setStatus(v)}
              search={search}
              onSearchChange={setSearch}
              counts={counts}
            />
            <ProjectsList
              rows={filtered}
              loading={loading}
              error={error}
              onRetry={() => void load()}
              hasFilter={hasFilter}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </>
        ) : (
          <ProjectsKanban key={seq} />
        )}
      </div>

      {showInspector && selectedProject ? (
        <ProjectInspector
          projectId={selectedProject.id}
          refreshSeq={seq}
          onClose={() => handleSelect(null)}
          // F012: chỉ bump seq — effect [load, seq] refetch một lần (trước đây
          // vừa setSeq vừa gọi load() trực tiếp → fetch 2 lần). Inspector nhận
          // refreshSeq để tự refetch getProject, tránh stale-after-edit.
          onChanged={() => setSeq((s) => s + 1)}
        />
      ) : null}

      <ProjectCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setSeq((s) => s + 1)}
      />
    </div>
  );
}
