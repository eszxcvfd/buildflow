'use client';

import * as React from 'react';
import { PageHeader } from '@/components/ui/page-header/PageHeader';
import { WorkOrdersList } from './WorkOrdersList';

export interface WorkOrdersViewProps {
  /** Deep-link `?projectId=` từ ProjectDetail (cố định scope 1 dự án). */
  initialProjectId?: string;
  /** Deep-link `?status=` (8 giá trị, lạ → ALL). */
  initialStatus?: string;
}

/**
 * `/work-orders` — PageHeader + WorkOrdersList (table duy nhất).
 * Tạo mới không có ở đây (nút `Tạo Work Order` nằm ở ProjectDetail, gắn
 * projectId context); deep-link `?projectId=&status=` từ section Công việc.
 */
export function WorkOrdersView({ initialProjectId, initialStatus }: WorkOrdersViewProps = {}) {
  return (
    <>
      <PageHeader
        title="Công việc"
        subtitle="Danh sách công việc của các dự án bạn là thành viên — lọc theo dự án, trạng thái, mã hoặc tiêu đề."
      />
      <WorkOrdersList initialProjectId={initialProjectId} initialStatus={initialStatus} />
    </>
  );
}
