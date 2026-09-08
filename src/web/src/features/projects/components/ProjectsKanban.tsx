'use client';

import * as React from 'react';
import { listProjects, type Project, type ProjectsError } from '@/lib/api/projects';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Select } from '@/components/ui/select/Select';
import { KanbanView, type KanbanColumn } from '@/components/ui/kanban/KanbanView';
import { ClearFiltersButton, ListToolbar, SearchField } from '@/components/ui/list/ListKit';

/**
 * Kanban dự án — CHỈ ĐỌC, nhóm theo lifecycle DRAFT/ACTIVE/PAUSED/COMPLETED/CLOSED.
 * Reads dự án chỉ hỗ trợ limit/offset (không search/status server) nên kanban
 * fetch tối đa 100 bản ghi rồi lọc client-side — cùng cách ProjectsList đang
 * làm (không đổi API read). Tradeoff: >100 dự án thì kanban chỉ phản ánh 100
 * bản ghi đầu như bảng.
 */

const KANBAN_LIMIT = 100;

const COLUMNS: readonly KanbanColumn[] = [
  { key: 'DRAFT', label: 'Nháp', tone: 'idle' },
  { key: 'ACTIVE', label: 'Đang hoạt động', tone: 'ok' },
  { key: 'PAUSED', label: 'Tạm dừng', tone: 'busy' },
  { key: 'COMPLETED', label: 'Hoàn thành', tone: 'info' },
  { key: 'CLOSED', label: 'Đóng', tone: 'idle' },
];

const STATUS_OPTIONS = ['ALL', 'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CLOSED'] as const;

const STATUS_OPTION_LABEL: Record<(typeof STATUS_OPTIONS)[number], string> = {
  ALL: 'Tất cả trạng thái',
  DRAFT: 'Nháp',
  ACTIVE: 'Đang hoạt động',
  PAUSED: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CLOSED: 'Đóng',
};

export function ProjectsKanban() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ProjectsError | null>(null);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<(typeof STATUS_OPTIONS)[number]>('ALL');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects({ limit: KANBAN_LIMIT, offset: 0 });
      setProjects(data);
    } catch (e) {
      setError(e as ProjectsError);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== 'ALL' && p.status !== status) return false;
      if (q && !`${p.name} ${p.code}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, search, status]);

  const hasFilter = search.trim() !== '' || status !== 'ALL';

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải kanban dự án…</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert tone="error">{error.message || 'Không thể tải kanban dự án'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={() => void load()}>
            Thử lại
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card>
        <ListToolbar count={`Tổng ${filtered.length} dự án`}>
          <SearchField
            id="projects-kanban-search"
            label="Tìm kiếm"
            placeholder="Nhập tên hoặc mã dự án…"
            value={search}
            onChange={setSearch}
          />
          <div className="bf-filter">
            <Select
              id="projects-kanban-status"
              label="Trạng thái"
              hideLabel
              value={status}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_OPTION_LABEL[s] }))}
              onChange={(v) => setStatus(v as (typeof STATUS_OPTIONS)[number])}
            />
          </div>
          {hasFilter ? (
            <ClearFiltersButton
              onClear={() => { setSearch(''); setStatus('ALL'); }}
            />
          ) : null}
        </ListToolbar>
        <p className="bf-card-meta" style={{ marginTop: '0.75rem' }}>
          Kanban chỉ đọc — đổi trạng thái qua dialog ở trang chi tiết dự án.
        </p>
      </Card>
      {filtered.length === 0 ? (
        <Card>
          <EmptyState title="Không có dự án nào phù hợp bộ lọc">
            Thử đổi từ khóa hoặc trạng thái.
          </EmptyState>
        </Card>
      ) : (
        <KanbanView<Project>
          columns={COLUMNS}
          items={filtered}
          getColumnKey={(p) => p.status}
          getCardProps={(p) => ({
            title: p.name,
            metas: [p.code, new Date(p.createdAt).toLocaleDateString('vi-VN')],
            href: `/projects/${p.id}`,
          })}
        />
      )}
    </div>
  );
}
