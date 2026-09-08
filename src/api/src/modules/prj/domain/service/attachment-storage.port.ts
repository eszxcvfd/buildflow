export const PRJ_ATTACHMENT_STORAGE = Symbol('PRJ_ATTACHMENT_STORAGE');

/**
 * PRJ-SRS-009 (issue #40) — storage port cho attachments.
 * File operation KHÔNG nằm trong DB tx: ghi file trước, DB tx sau; DB/audit
 * fail → caller xóa file (orphan cleanup). `storageKey` là relative key
 * `uploads/{projectId}/{uuid}-{safeName}` (không lộ absolute path ra API).
 */
export interface AttachmentStoragePort {
  /** Ghi buffer xuống disk, trả về storageKey. */
  save(projectId: string, safeFileName: string, buffer: Buffer): Promise<string>;
  /** Đọc toàn bộ bytes (controller stream về client). */
  read(storageKey: string): Promise<Buffer>;
  /** Xóa file (orphan cleanup khi DB fail). Best-effort: missing → resolve. */
  remove(storageKey: string): Promise<void>;
}
