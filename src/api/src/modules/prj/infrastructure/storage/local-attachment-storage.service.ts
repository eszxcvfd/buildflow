import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { AttachmentStoragePort } from '../../domain/service/attachment-storage.port';
import { loadConfig } from '../../../../config/configuration';

/**
 * PRJ-SRS-009 (issue #40) — local disk storage adapter.
 * Layout: `{baseDir}/{projectId}/{uuid}-{safeName}` (`storageKey` relative,
 * không lộ absolute path). `baseDir` resolve từ `UPLOADS_DIR` (compose mount
 * `uploads:/app/uploads` → `UPLOADS_DIR=/app/uploads`; local dev default
 * `./uploads`; test truyền `baseDir` tường minh vào constructor).
 * Storage key sinh từ uuid server-side + tên đã sanitize — caller không
 * truyền path tùy ý (chặn traversal tầng adapter lần nữa qua resolve-check).
 */
@Injectable()
export class LocalAttachmentStorageService implements AttachmentStoragePort {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    const configured = baseDir ?? process.env.UPLOADS_DIR ?? loadConfigUploadsDir();
    this.baseDir = resolve(configured);
  }

  /** Base dir hiện tại (test/container verify). */
  getBaseDir(): string {
    return this.baseDir;
  }

  async save(projectId: string, safeFileName: string, buffer: Buffer): Promise<string> {
    const storageKey = `${projectId}/${randomUUID()}-${safeFileName}`;
    const absolute = this.toAbsolute(storageKey);
    await mkdir(dirname(absolute), { recursive: true });
    // `wx` — không ghi đè file đã tồn tại (uuid collide cực khó, fail rõ).
    await writeFile(absolute, buffer, { flag: 'wx' });
    return storageKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.toAbsolute(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.toAbsolute(storageKey));
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err && err.code === 'ENOENT') return;
      throw e;
    }
  }

  /** Resolve storageKey → absolute, chặn traversal thoát baseDir. */
  private toAbsolute(storageKey: string): string {
    const absolute = resolve(join(this.baseDir, storageKey));
    if (absolute !== this.baseDir && !absolute.startsWith(this.baseDir + sep)) {
      throw new Error('Storage key nằm ngoài thư mục uploads');
    }
    return absolute;
  }
}

function loadConfigUploadsDir(): string {
  try {
    return loadConfig().uploadsDir;
  } catch {
    return 'uploads';
  }
}
