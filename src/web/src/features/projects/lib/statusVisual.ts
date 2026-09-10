'use client';

/**
 * Web redesign — ánh xạ trạng thái dự án thật (DRAFT|ACTIVE|PAUSED|
 * COMPLETED|CLOSED) sang nhãn + màu dot emerald của mẫu.
 * Feature-local: KHÔNG sửa StatusBadge dùng chung (consumer khác giữ nguyên).
 */

export interface StatusVisual {
  label: string;
  dotClass: string;
  textClass: string;
}

export function statusVisual(status: string): StatusVisual {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Đang chạy', dotClass: 'bg-emerald-500', textClass: 'text-emerald-700' };
    case 'PAUSED':
      return { label: 'Tạm dừng', dotClass: 'bg-amber-500', textClass: 'text-amber-700' };
    case 'COMPLETED':
      return { label: 'Hoàn thành', dotClass: 'bg-blue-600', textClass: 'text-blue-700' };
    case 'CLOSED':
      return { label: 'Đóng', dotClass: 'bg-zinc-400', textClass: 'text-zinc-500' };
    case 'DRAFT':
      return { label: 'Bản nháp', dotClass: 'bg-zinc-400', textClass: 'text-zinc-500' };
    default:
      return { label: status, dotClass: 'bg-zinc-400', textClass: 'text-zinc-500' };
  }
}

/** "Cập nhật {relative}" trung thực cho subtitle hàng — thay text category giả của mock. */
export function formatUpdatedAt(iso: string, now: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diffMs = now.getTime() - t;
  if (diffMs < 0) return new Date(iso).toLocaleDateString('vi-VN');
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}
