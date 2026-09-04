/**
 * Helpers đọc lỗi từ lib/api — các service throw object thường `{ status, message }`
 * (không phải instance Error), nên phải đọc an toàn qua unknown.
 */

export function apiErrorStatus(e: unknown): number | null {
  if (e && typeof e === 'object' && 'status' in e) {
    const s = (e as { status?: unknown }).status;
    if (typeof s === 'number') return s;
  }
  return null;
}

/** Lấy message ngắn gọn từ lỗi API; không có thì dùng fallback. */
export function apiErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) {
      const msg = m.trim();
      return msg.length > 80 ? `${msg.slice(0, 77)}…` : msg;
    }
  }
  return fallback;
}
