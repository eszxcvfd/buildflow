'use client';

import * as React from 'react';
import { listProjects, type Project, type ProjectsError } from '@/lib/api/projects';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { Card } from '@/components/ui/card/Card';

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
    return <Card><p aria-busy="true">Đang tải dự án…</p></Card>;
  }

  if (error) {
    if (error.status === 401) {
      return (
        <Card>
          <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/login" style={{ color: '#1d4ed8', textDecoration: 'underline' }}>Đến trang đăng nhập</a>
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
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <p style={{ margin: 0, color: '#6b7280', fontSize: '0.85rem' }}>
        Danh sách chỉ hiển thị dự án bạn là thành viên — server lọc theo membership (IAM-SRS-006).
      </p>
      {projects.length === 0 ? (
        <Card><p style={{ margin: 0, color: '#6b7280' }}>Bạn chưa là thành viên dự án nào.</p></Card>
      ) : (
        projects.map((p) => (
          <Card key={p.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{p.name} <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.9rem' }}>· {p.code}</span></div>
                <div style={{ marginTop: 4, fontSize: '0.85rem', color: '#6b7280' }}>
                  Trạng thái: {p.status} · Tạo: {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                </div>
              </div>
              <span style={{ fontSize: '0.8rem', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#14532d', borderRadius: 6, padding: '0.2rem 0.5rem' }}>
                Trong phạm vi của bạn
              </span>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
