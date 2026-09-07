'use client';

import * as React from 'react';
import { listProjects, type Project, type ProjectsError } from '@/lib/api/projects';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';
import { Select } from '@/components/ui/select/Select';
import { Tooltip } from '@/components/ui/tooltip/Tooltip';
import {
  ClearFiltersButton,
  ListPagination,
  ListToolbar,
  SearchField,
} from '@/components/ui/list/ListKit';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ['ALL', 'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CLOSED'] as const;

/** Nhãn tiếng Việt cho filter trạng thái (value giữ nguyên mã API). */
const STATUS_OPTION_LABEL: Record<(typeof STATUS_OPTIONS)[number], string> = {
  ALL: 'Tất cả trạng thái',
  DRAFT: 'Nháp',
  ACTIVE: 'Đang hoạt động',
  PAUSED: 'Tạm dừng',
  COMPLETED: 'Hoàn thành',
  CLOSED: 'Đóng',
};

/**
 * Danh sách dự án (PRJ-SRS-001 web slice, issue #32).
 *
 * Reads là iam-owned, chỉ hỗ trợ `limit`/`offset` (không search/status/total
 * phía server) nên search + lọc trạng thái + phân trang thực hiện phía client
 * trên tối đa 100 bản ghi fetch về — KHÔNG đổi API read trong slice này.
 * Giữ nguyên các state cũ: loading / 401 / 403 / lỗi chung + retry.
 */
export function ProjectsList() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ProjectsError | null>(null);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [page, setPage] = React.useState(0);

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
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== 'ALL' && p.status !== status) return false;
      if (q && !`${p.name} ${p.code}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, search, status]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const hasFilter = search.trim() !== '' || status !== 'ALL';

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(0);
  }

  function handleStatusChange(value: string) {
    setStatus(value as (typeof STATUS_OPTIONS)[number]);
    setPage(0);
  }

  if (loading) {
    return <Card><p aria-busy="true">Đang tải…</p></Card>;
  }

  if (error) {
    if (error.status === 401) {
      return (
        <Card>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/login">Đến trang đăng nhập</a>
          </div>
        </Card>
      );
    }
    if (error.status === 403) {
      return (
        <Card>
          <Alert tone="info">Bạn không có quyền xem dự án</Alert>
          {error.message ? (
            <p style={{ margin: '0.75rem 0 0', color: 'var(--bf-muted)' }}>{error.message}</p>
          ) : null}
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>
          </div>
        </Card>
      );
    }
    return (
      <Card>
        <Alert tone="error">{error.message}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={() => void load()}>Thử lại</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <ListToolbar count={`Tổng ${total} dự án`}>
        <SearchField
          id="projects-search"
          label="Tìm kiếm"
          placeholder="Nhập tên hoặc mã dự án…"
          value={search}
          onChange={handleSearchChange}
        />
        <div className="bf-filter">
          <Select
            id="projects-status"
            label="Trạng thái"
            hideLabel
            value={status}
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_OPTION_LABEL[s] }))}
            onChange={handleStatusChange}
          />
        </div>
        {hasFilter ? (
          <ClearFiltersButton
            onClear={() => { setSearch(''); setStatus('ALL'); setPage(0); }}
          />
        ) : null}
      </ListToolbar>

      {pageRows.length === 0 ? (
        <div style={{ marginTop: '1rem' }}>
        <EmptyState
          title={hasFilter ? 'Không có dự án nào phù hợp bộ lọc' : 'Bạn chưa là thành viên dự án nào'}
        >
          {hasFilter ? 'Thử đổi từ khóa hoặc trạng thái.' : 'Liên hệ quản trị viên để được thêm vào dự án.'}
        </EmptyState>
        </div>
      ) : (
        <>
          <div className="bf-table-wrap" style={{ marginTop: '1rem' }}>
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th style={{ textAlign: 'right' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href={`/projects/${p.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none' }}>
                        {p.name}
                      </a>{' '}
                      <span style={{ color: 'var(--bf-faint)' }}>{p.code}</span>
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</td>
                    <td className="bf-cell-actions">
                      <span className="bf-row-actions">
                        <Tooltip content="Xem chi tiết dự án">
                          <a className="bf-detail-link" href={`/projects/${p.id}`}>
                            Chi tiết
                          </a>
                        </Tooltip>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListPagination
            page={safePage + 1}
            totalPages={totalPages}
            onPage={(next) => setPage(next - 1)}
            prevLabel="Trước"
            nextLabel="Sau"
          />
        </>
      )}
    </Card>
  );
}
