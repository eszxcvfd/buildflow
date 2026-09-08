import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { AttachmentEntity } from '../../domain/entity/attachment.entity';
import { AttachmentRepositoryPort } from '../../domain/repository/attachment-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgAttachmentPool?: Pool };
  if (g.__pgAttachmentPool) return g.__pgAttachmentPool;
  g.__pgAttachmentPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgAttachmentPool;
}

type Row = Record<string, unknown>;

/**
 * PRJ-SRS-009 (issue #40) — pg adapter cho attachments (mirror
 * pg-work-order.repository style: global pool, mapRow, column list const).
 */
function mapRow(row: Row): AttachmentEntity {
  return new AttachmentEntity({
    id: String(row['id']),
    projectId: String(row['project_id']),
    workOrderId: (row['work_order_id'] as string | null) ?? null,
    ownerType:
      String(row['owner_type']) === 'WORK_ORDER' ? 'WORK_ORDER' : 'PROJECT',
    ownerId: String(row['owner_id']),
    attachmentType: String(row['attachment_type'] ?? 'DOCUMENT'),
    uploadedBy: String(row['uploaded_by']),
    fileName: String(row['file_name']),
    storageKey: String(row['storage_key']),
    mimeType: String(row['mime_type']),
    sizeBytes: Number(row['size_bytes']),
    caption: (row['caption'] as string | null) ?? null,
    isActive: Boolean(row['is_active'] ?? true),
    deactivatedAt: row['deactivated_at'] ? new Date(String(row['deactivated_at'])) : null,
    deactivatedBy: (row['deactivated_by'] as string | null) ?? null,
    deactivateReason: (row['deactivate_reason'] as string | null) ?? null,
    requestKey: (row['request_key'] as string | null) ?? null,
    createdAt: new Date(String(row['created_at'])),
  });
}

const ATTACHMENT_COLUMNS =
  'id, project_id, work_order_id, owner_type, owner_id, attachment_type, ' +
  'uploaded_by, file_name, storage_key, mime_type, size_bytes, caption, ' +
  'is_active, deactivated_at, deactivated_by, deactivate_reason, request_key, created_at';

@Injectable()
export class PgAttachmentRepository implements AttachmentRepositoryPort {
  private pool(): Pool {
    return getPool();
  }

  async findById(id: string): Promise<AttachmentEntity | null> {
    const r = await this.pool().query(
      `SELECT ${ATTACHMENT_COLUMNS} FROM public.attachments WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async findByRequestKey(requestKey: string): Promise<AttachmentEntity | null> {
    const r = await this.pool().query(
      `SELECT ${ATTACHMENT_COLUMNS} FROM public.attachments WHERE request_key = $1 LIMIT 1`,
      [requestKey],
    );
    if (r.rows.length === 0) return null;
    return mapRow(r.rows[0]);
  }

  async listByProjectId(projectId: string): Promise<AttachmentEntity[]> {
    const r = await this.pool().query(
      `SELECT ${ATTACHMENT_COLUMNS} FROM public.attachments WHERE project_id = $1 ORDER BY created_at DESC, id DESC`,
      [projectId],
    );
    return r.rows.map(mapRow);
  }

  async listByWorkOrderId(workOrderId: string): Promise<AttachmentEntity[]> {
    const r = await this.pool().query(
      `SELECT ${ATTACHMENT_COLUMNS} FROM public.attachments WHERE work_order_id = $1 ORDER BY created_at DESC, id DESC`,
      [workOrderId],
    );
    return r.rows.map(mapRow);
  }

  async findWorkOrderProjectById(workOrderId: string): Promise<{ id: string; projectId: string } | null> {
    const r = await this.pool().query(
      'SELECT id, project_id FROM public.work_orders WHERE id = $1 LIMIT 1',
      [workOrderId],
    );
    if (r.rows.length === 0) return null;
    return { id: String(r.rows[0].id), projectId: String(r.rows[0].project_id) };
  }

  async create(entity: AttachmentEntity): Promise<void> {
    await this.insert(this.pool(), entity);
  }

  async createWithClient(client: unknown, entity: AttachmentEntity): Promise<void> {
    await this.insert(client as PoolClient, entity);
  }

  private async insert(db: Pool | PoolClient, e: AttachmentEntity): Promise<void> {
    await db.query(
      `INSERT INTO public.attachments
         (id, project_id, work_order_id, owner_type, owner_id, attachment_type,
          uploaded_by, file_name, storage_key, mime_type, size_bytes, caption,
          is_active, deactivated_at, deactivated_by, deactivate_reason, request_key, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        e.id,
        e.projectId,
        e.workOrderId,
        e.ownerType,
        e.ownerId,
        e.attachmentType,
        e.uploadedBy,
        e.fileName,
        e.storageKey,
        e.mimeType,
        e.sizeBytes,
        e.caption,
        e.isActive,
        e.deactivatedAt ? e.deactivatedAt.toISOString() : null,
        e.deactivatedBy,
        e.deactivateReason,
        e.requestKey,
        e.createdAt.toISOString(),
      ],
    );
  }

  async retireWithClient(
    client: unknown,
    id: string,
    input: { deactivatedBy: string; deactivatedAt: Date; reason: string | null },
  ): Promise<{ entity: AttachmentEntity; alreadyInactive: boolean }> {
    const db = client as PoolClient;
    // Re-check trong cùng tx sau lock (revoke mid-flight → row mới nhất).
    const cur = await db.query(
      `SELECT ${ATTACHMENT_COLUMNS} FROM public.attachments WHERE id = $1 FOR UPDATE LIMIT 1`,
      [id],
    );
    if (cur.rows.length === 0) {
      throw new Error('ATTACHMENT_NOT_FOUND');
    }
    const current = mapRow(cur.rows[0]);
    if (!current.isActive) {
      return { entity: current, alreadyInactive: true };
    }
    const r = await db.query(
      `UPDATE public.attachments
         SET is_active = false, deactivated_at = $2, deactivated_by = $3, deactivate_reason = $4
       WHERE id = $1
       RETURNING ${ATTACHMENT_COLUMNS}`,
      [id, input.deactivatedAt.toISOString(), input.deactivatedBy, input.reason],
    );
    return { entity: mapRow(r.rows[0]), alreadyInactive: false };
  }
}
