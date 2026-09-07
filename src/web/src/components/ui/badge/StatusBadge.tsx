import * as React from 'react';

export type BadgeTone = 'ok' | 'busy' | 'risk' | 'idle' | 'info';

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
  return <span className={`bf-badge bf-badge-${tone}`}>{status}</span>;
}
