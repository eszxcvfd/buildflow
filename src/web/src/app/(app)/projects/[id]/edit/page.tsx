'use client';

import * as React from 'react';
import { getProject, type Project } from '@/lib/api/projects';
import type { ApiError } from '@/lib/api/projects';
import { ProjectForm } from '@/features/projects';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';

export default function ProjectEditPage({ params }: { params: { id: string } }) {
  const [project, setProject] = React.useState<Project | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const p = await getProject(params.id);
        if (!cancelled) setProject(p);
      } catch (e) {
        if (!cancelled) setError(e as ApiError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return (
      <Card>
        <p aria-busy="true">Đang tải hồ sơ dự án…</p>
      </Card>
    );
  }

  if (error || !project) {
    return (
      <Card>
        <Alert tone="error">
          {error?.status === 404
            ? 'Không tìm thấy dự án (404)'
            : error?.status === 401
              ? 'Phiên hết hạn, vui lòng đăng nhập lại (401)'
              : error?.status === 403
                ? 'Không có quyền — cần ADMIN hoặc PROJECT_MANAGER (403)'
                : (error?.message ?? 'Không thể tải hồ sơ dự án')}
        </Alert>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={`Sửa dự án ${project.code}`}
        subtitle="Đổi tên, địa chỉ, ngày kế hoạch, múi giờ, mô tả hoặc quản lý dự án. Mã dự án không thay đổi sau khi tạo."
      />
      <ProjectForm mode="edit" initial={project} />
    </>
  );
}
