'use client';

import * as React from 'react';
import { listProjects, type Project, type ProjectsError } from '@/lib/api/projects';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { StatusBadge } from '@/components/ui/badge/StatusBadge';

export function ProjectsList() {
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ProjectsError | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProjects();
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
      {projects.length === 0 ? (
        <EmptyState title="Bạn chưa là thành viên dự án nào">
          Liên hệ quản trị viên để được thêm vào dự án.
        </EmptyState>
      ) : (
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
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>{' '}
                    <span style={{ color: 'var(--bf-faint)' }}>{p.code}</span>
                  </td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
