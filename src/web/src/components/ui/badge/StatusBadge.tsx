import * as React from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'ok' | 'busy' | 'risk' | 'idle' | 'info';

const toneTw: Record<BadgeTone, string> = {
  ok: 'bg-success-100 text-success-700',
  busy: 'bg-warning-100 text-warning-700',
  risk: 'bg-danger-100 text-danger-700',
  idle: 'bg-gray-100 text-gray-600',
  info: 'bg-info-100 text-info-700',
};

const dotTw: Record<BadgeTone, string> = {
  ok: 'bg-success-500',
  busy: 'bg-warning-500',
  risk: 'bg-danger-500',
  idle: 'bg-gray-400',
  info: 'bg-info-500',
};

/**
 * Map trạng thái nghiệp vụ (string từ API) → tone màubadge.
 * Chỉ dựa trên từ khoá tiếng Anh phổ biến; giá trị lạ rơi về idle.
 */
export function toneForStatus(status: string): BadgeTone {
  const s = status.toLowerCase();
  // 'inactive' chứa 'active' — phải kiểm trước
  // PRJ-SRS-002 (issue #33): 'paused' (dự án tạm dừng) map về risk như suspend.
  if (/(inactive|locked|block|fail|reject|overdue|cancel|suspend|paus|error)/.test(s)) return 'risk';
  if (/(complete|done|closed|paid|approved|passed|success)/.test(s)) return 'ok';
  if (/(active|progress|running|open|assigned|in_?use)/.test(s)) return 'busy';
  if (/(hold|wait|pending|review|draft)/.test(s)) return 'info';
  return 'idle';
}

export function StatusBadge({ status }: { status: string }) {
  const tone = toneForStatus(status);
  return (
    <span
      className={cn(
        'bf-badge',
        `bf-badge-${tone}`,
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneTw[tone],
      )}
    >
      <span aria-hidden="true" className={cn('inline-block h-1.5 w-1.5 rounded-full', dotTw[tone])} />
      {status}
    </span>
  );
}
