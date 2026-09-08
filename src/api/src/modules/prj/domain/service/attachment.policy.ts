/**
 * PRJ-SRS-009 (issue #40) — validation thuần domain cho attachments cơ bản
 * (mirror work-type.policy style: không Nest/DB, ném Error, use case convert
 * sang 400 fieldErrors).
 *
 * - Chỉ tin bytes đầu file (magic sniff), KHÔNG tin Content-Type header.
 * - `sanitizeFileName` chặn path traversal (`../`, `/`, `\`, NUL).
 */

export const ATTACHMENT_ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AttachmentAllowedMime = (typeof ATTACHMENT_ALLOWED_MIMES)[number];

/** Giới hạn kích thước file: 10 MiB (SRS PRJ-SRS-009 "giới hạn kích thước"). */
export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_FILE_NAME_MAX_LENGTH = 255;
export const ATTACHMENT_CAPTION_MAX_LENGTH = 500;
export const ATTACHMENT_REASON_MAX_LENGTH = 500;

export const ATTACHMENT_REQUEST_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return ATTACHMENT_REQUEST_KEY_RE.test(value);
}

/**
 * Đoán mime từ magic bytes đầu file (không tin header):
 * - JPEG: `FF D8 FF`
 * - PNG: `89 50 4E 47 0D 0A 1A 0A`
 * - WebP: `RIFF....WEBP` (bytes 0-3 `RIFF`, bytes 8-11 `WEBP`)
 * - PDF: `%PDF` (`25 50 44 46`)
 * Trả về mime khi nhận diện được trong allowlist, ngược lại `null`
 * (fake-exe đổi tên `.pdf`/`.jpg` rơi vào đây → reject).
 */
export function sniffAttachmentMime(buffer: Buffer): AttachmentAllowedMime | null {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'image/webp';
  }
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'application/pdf';
  }
  return null;
}

/**
 * Validate upload: thứ tự size → mime header → magic (fail-fast, rẻ trước).
 * - `claimedMime`: Content-Type do client gửi (chỉ dùng để báo lỗi sớm —
 *   quyết định cuối là magic bytes).
 * - Ném `Error` với message tiếng Việt actionable; use case map sang 400.
 */
export function assertUploadableFile(buffer: Buffer, claimedMime: string): AttachmentAllowedMime {
  if (!buffer || buffer.length === 0) {
    throw new Error('Tệp đính kèm rỗng, vui lòng chọn tệp khác');
  }
  if (buffer.length > ATTACHMENT_MAX_SIZE_BYTES) {
    throw new Error('Tệp vượt quá giới hạn 10MB, vui lòng chọn tệp nhỏ hơn');
  }
  const claimed = String(claimedMime ?? '').trim().toLowerCase();
  if (!(ATTACHMENT_ALLOWED_MIMES as readonly string[]).includes(claimed)) {
    throw new Error('Chỉ chấp nhận tệp thuộc loại được phê duyệt (JPEG, PNG, WebP, PDF)');
  }
  const sniffed = sniffAttachmentMime(buffer);
  if (sniffed === null) {
    throw new Error('Nội dung tệp không khớp loại file được phê duyệt');
  }
  if (sniffed !== claimed) {
    throw new Error('Nội dung tệp không khớp định dạng đã khai báo');
  }
  return sniffed;
}

/**
 * Sanitize tên file chống path traversal: lấy basename (cắt mọi `/`, `\`),
 * loại NUL/control chars, trim; giữ nguyên phần mở rộng. Rỗng sau sanitize
 * → fallback `file`. Giới hạn 255 ký tự (cột `file_name`).
 */
export function sanitizeFileName(raw: string): string {
  const input = String(raw ?? '');
  // Cố ý strip control chars (gồm NUL — vector traversal/mismatch tên file).
  // eslint-disable-next-line no-control-regex
  const noNul = input.replace(/[\u0000-\u001f\u007f]/g, '');
  const base = noNul.split(/[\\/]/).pop() ?? '';
  const trimmed = base.trim().replace(/^[.]+/, '').trim();
  const safe = trimmed.length === 0 ? 'file' : trimmed;
  return safe.length > ATTACHMENT_FILE_NAME_MAX_LENGTH
    ? safe.slice(0, ATTACHMENT_FILE_NAME_MAX_LENGTH)
    : safe;
}

/** Caption optional, tối đa 500 ký tự (cột `caption`). */
export function normalizeAttachmentCaption(caption: unknown): string | null {
  if (caption === undefined || caption === null) return null;
  const trimmed = String(caption).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > ATTACHMENT_CAPTION_MAX_LENGTH) {
    throw new Error(`Mô tả tệp tối đa ${ATTACHMENT_CAPTION_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

/** Lý do retire optional, tối đa 500 ký tự (cột `deactivate_reason`). */
export function normalizeRetireReason(reason: unknown): string | null {
  if (reason === undefined || reason === null) return null;
  const trimmed = String(reason).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > ATTACHMENT_REASON_MAX_LENGTH) {
    throw new Error(`Lý do ngừng sử dụng tối đa ${ATTACHMENT_REASON_MAX_LENGTH} ký tự`);
  }
  return trimmed;
}

/** `requestKey` optional uuid (idempotent replay mirror WO #41). */
export function normalizeAttachmentRequestKey(requestKey: unknown): string | null {
  if (requestKey === undefined || requestKey === null) return null;
  const trimmed = String(requestKey).trim();
  if (trimmed.length === 0) return null;
  if (!isUuid(trimmed)) {
    throw new Error('Request key phải là UUID hợp lệ');
  }
  return trimmed.toLowerCase();
}
