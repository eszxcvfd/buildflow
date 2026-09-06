'use client';

import * as React from 'react';
import { getCrew, type Crew } from '@/lib/api/crews';
import type { ApiError } from '@/lib/api/crews';
import { CrewForm } from '@/features/crews';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { Alert } from '@/components/ui/alert/Alert';
import { Card } from '@/components/ui/card/Card';

export default function CrewEditPage({ params }: { params: { id: string } }) {
  const [crew, setCrew] = React.useState<Crew | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const c = await getCrew(params.id);
        if (!cancelled) setCrew(c);
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
        <p aria-busy="true">Đang tải hồ sơ đội thi công…</p>
      </Card>
    );
  }

  if (error || !crew) {
    return (
      <Card>
        <Alert tone="error">
          {error?.status === 404
            ? 'Không tìm thấy đội thi công (404)'
            : error?.status === 401
              ? 'Phiên hết hạn, vui lòng đăng nhập lại (401)'
              : error?.status === 403
                ? 'Không có quyền — cần ADMIN hoặc PROJECT_MANAGER (403)'
                : (error?.message ?? 'Không thể tải hồ sơ đội thi công')}
        </Alert>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        title={`Sửa đội ${crew.code}`}
        subtitle="Đổi tên, mô tả, nhà thầu hoặc trưởng nhóm. Mã đội không thay đổi sau khi tạo."
      />
      <CrewForm mode="edit" initial={crew} />
    </>
  );
}
