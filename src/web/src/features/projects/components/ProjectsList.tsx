'use client';

import * as React from 'react';
import { listProjects, type Project, type ProjectsError } from '@/lib/api/projects';
import { useCanManageProjects } from '@/lib/auth/roles';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';
import { Input } from '@/components/ui/input/Input';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ['ALL', 'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CLOSED'] as const;

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
  const canManage = useCanManageProjects();

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
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'end', marginBottom: '1rem' }}>
        <div className="bf-field" style={{ flex: '1 1 220px' }}>
          <label className="bf-label" htmlFor="projects-search">Tìm kiếm</label>
          <Input
            id="projects-search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Nhập tên hoặc mã dự án…"
          />
        </div>
        <div className="bf-field" style={{ flex: '0 1 200px' }}>
          <label className="bf-label" htmlFor="projects-status">Trạng thái</label>
          <select
            id="projects-status"
            className="bf-input"
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'Tất cả trạng thái' : s}
              </option>
            ))}
          </select>
        </div>
        {canManage ? (
          <a className="bf-btn bf-btn-primary" href="/projects/new">
            Tạo dự án
          </a>
        ) : null}
      </div>

      {pageRows.length === 0 ? (
        <EmptyState title={hasFilter ? 'Không có dự án nào phù hợp bộ lọc' : 'Bạn chưa là thành viên dự án nào'}>
          {hasFilter ? 'Thử đổi từ khóa hoặc trạng thái.' : 'Liên hệ quản trị viên để được thêm vào dự án.'}
        </EmptyState>
      ) : (
        <>
          <div className="bf-table-wrap">
            <table className="bf-table">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href={`/projects/${p.id}`}>
                        <strong>{p.name}</strong>
                      </a>{' '}
                      <span style={{ color: 'var(--bf-faint)' }}>{p.code}</span>
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={() => setPage((v) => Math.max(0, v - 1))}
              disabled={safePage === 0}
            >
              Trước
            </Button>
            <span style={{ color: 'var(--bf-muted)', fontSize: '0.85rem' }}>
              {`Trang ${safePage + 1}/${totalPages} · Tổng ${total} dự án`}
            </span>
            <Button
              variant="secondary"
              onClick={() => setPage((v) => Math.min(totalPages - 1, v + 1))}
              disabled={safePage >= totalPages - 1}
            >
              Sau
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
