'use client';

import type { Project } from '@/lib/api/projects';

/**
 * Web redesign — xuất CSV client-side các dòng đã lọc (nút "Xuất CSV" của mẫu).
 * Pure + tested; không chạm API.
 */

const CSV_HEADER = ['Mã', 'Tên', 'Trạng thái', 'Mã quản lý', 'Ngày tạo', 'Ngày cập nhật'];

function escapeCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function projectsToCsv(rows: readonly Project[]): string {
  const lines = rows.map((p) =>
    [p.code, p.name, p.status, p.managerId, p.createdAt, p.updatedAt].map(escapeCell).join(','),
  );
  return `\uFEFF${CSV_HEADER.join(',')}\n${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
