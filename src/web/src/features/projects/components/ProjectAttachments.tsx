'use client';

import * as React from 'react';
import {
  listAttachments,
  uploadAttachment,
  downloadAttachment,
  retireAttachment,
  newRequestKey,
  ATTACHMENT_ALLOWED_MIME_TYPES,
  ATTACHMENT_MAX_SIZE_BYTES,
  ATTACHMENT_TEXT_MAX_LENGTH,
  type Attachment,
  type ApiError,
} from '@/lib/api/attachments';
import { useCanManageProjects } from '@/lib/auth/roles';
import { Alert } from '@/components/ui/alert/Alert';
import { Button } from '@/components/ui/button/Button';
import { EmptyState } from '@/components/ui/empty-state/EmptyState';
import { Input } from '@/components/ui/input/Input';
import { Dialog } from '@/components/ui/dialog/Dialog';
import { toast } from '@/components/ui/toast/Toaster';

interface Props {
  projectId: string;
  onChanged?: () => void;
}

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeLabel(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'JPEG';
    case 'image/png':
      return 'PNG';
    case 'image/webp':
      return 'WebP';
    case 'application/pdf':
      return 'PDF';
    default:
      return mime;
  }
}

function validateClientFile(file: File): string | null {
  if (!ATTACHMENT_ALLOWED_MIME_TYPES.includes(file.type as (typeof ATTACHMENT_ALLOWED_MIME_TYPES)[number])) {
    return 'Loại file không được hỗ trợ — chỉ nhận JPEG, PNG, WebP hoặc PDF.';
  }
  if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
    return 'File quá lớn — tối đa 10MB.';
  }
  return null;
}

/**
 * PRJ-SRS-009 (issue #40) — panel 'Tài liệu đính kèm' của dự án
 * (mirror ProjectAreas #34).
 * - List metadata cả active + inactive (`no-store`); inactive: badge
 *   'Đã ngừng', ẩn nút 'Ngừng sử dụng' (tải xuống vẫn được — API cho phép
 *   download bản đã retire, giữ lịch sử).
 * - Upload qua Dialog (file + caption + client pre-check loại/size, server
 *   là source of truth — 400 map lý do rõ); `requestKey` sinh MỘT lần mỗi
 *   phiên mở dialog, giữ cố định qua retry (replay → notice info, không
 *   tạo trùng); state `uploading` bool (không XHR progress).
 * - Retire: confirm inline + reason optional (max 500, counter);
 *   `alreadyInactive` → notice info, không báo lỗi. Không xóa file vật lý.
 * - Write controls (Tải lên/Ngừng sử dụng) gated bởi canManageProjects
 *   (ADMIN + PROJECT_MANAGER, fail-closed); reads mở cho mọi member nên
 *   list luôn fetch; 403 → graceful + retry.
 */
export function ProjectAttachments({ projectId, onChanged }: Props) {
  const canManage = useCanManageProjects();

  const [items, setItems] = React.useState<Attachment[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [retryKey, setRetryKey] = React.useState(0);

  const [notice, setNotice] = React.useState<{ tone: 'success' | 'info'; text: string } | null>(null);
  React.useEffect(() => {
    if (notice) {
      if (notice.tone === 'success') toast.success({ title: notice.text });
      else toast.info({ title: notice.text });
    }
  }, [notice]);

  // Upload dialog — requestKey sinh MỘT lần mỗi phiên mở (mirror WO dialog).
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [requestKey, setRequestKey] = React.useState<string>('');
  const [file, setFile] = React.useState<File | null>(null);
  const [caption, setCaption] = React.useState('');
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [captionError, setCaptionError] = React.useState<string | null>(null);
  const [uploadGlobalError, setUploadGlobalError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  // Download pending theo row.
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);

  // Retire confirm inline (per-row) — pending theo row.
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [retireReason, setRetireReason] = React.useState('');
  const [retireReasonError, setRetireReasonError] = React.useState<string | null>(null);
  const [retirePendingId, setRetirePendingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAttachments(projectId);
      setItems(res.data);
      setTotal(res.total);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    void load();
  }, [load, retryKey]);

  function reload() {
    setRetryKey((k) => k + 1);
  }

  function openUpload() {
    setRequestKey(newRequestKey());
    setFile(null);
    setCaption('');
    setFileError(null);
    setCaptionError(null);
    setUploadGlobalError(null);
    setNotice(null);
    setUploadOpen(true);
  }

  async function handleUpload() {
    if (uploading) return;
    if (!file) {
      setFileError('Chọn file để tải lên (JPEG, PNG, WebP hoặc PDF, tối đa 10MB).');
      return;
    }
    const clientError = validateClientFile(file);
    if (clientError) {
      setFileError(clientError);
      return;
    }
    if (caption.trim().length > ATTACHMENT_TEXT_MAX_LENGTH) {
      setCaptionError(`Chú thích tối đa ${ATTACHMENT_TEXT_MAX_LENGTH} ký tự.`);
      return;
    }
    setUploading(true);
    setFileError(null);
    setCaptionError(null);
    setUploadGlobalError(null);
    setNotice(null);
    try {
      const res = await uploadAttachment(
        projectId,
        { file, caption: caption.trim() || null, requestKey },
      );
      if (res.idempotentReplay) {
        setNotice({ tone: 'info', text: `File “${res.attachment.fileName}” đã được tải lên từ lần gửi trước — không tạo bản trùng.` });
      } else {
        setNotice({ tone: 'success', text: `Đã tải lên “${res.attachment.fileName}”.` });
      }
      setUploadOpen(false);
      reload();
      onChanged?.();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.fieldErrors?.file?.length) setFileError(e2.fieldErrors.file.join(' '));
      else if (e2.fieldErrors?.caption?.length) setCaptionError(e2.fieldErrors.caption.join(' '));
      else if (e2.status === 401) setUploadGlobalError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (e2.status === 403) setUploadGlobalError('Không có quyền tải lên — cần ADMIN hoặc là quản lý/điều phối viên của dự án (403).');
      else setUploadGlobalError(e2.message || 'Tải lên thất bại');
      // Giữ nguyên requestKey để retry trong phiên không tạo trùng.
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(a: Attachment) {
    if (downloadingId) return;
    setDownloadingId(a.id);
    setRowError(null);
    try {
      const res = await downloadAttachment(projectId, a.id);
      const url = URL.createObjectURL(res.blob);
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = res.fileName ?? a.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.status === 401) setRowError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (e2.status === 403) setRowError('Không có quyền tải xuống — cần là thành viên dự án (403).');
      else if (e2.status === 404) setRowError('Không tìm thấy tài liệu (404).');
      else setRowError(e2.message || 'Tải xuống thất bại');
    } finally {
      setDownloadingId(null);
    }
  }

  function openRetireConfirm(a: Attachment) {
    setConfirmId(a.id);
    setRetireReason('');
    setRetireReasonError(null);
    setRowError(null);
    setNotice(null);
  }

  async function handleRetire(a: Attachment) {
    if (retirePendingId) return;
    if (retireReason.trim().length > ATTACHMENT_TEXT_MAX_LENGTH) {
      setRetireReasonError(`Lý do tối đa ${ATTACHMENT_TEXT_MAX_LENGTH} ký tự.`);
      return;
    }
    setRetirePendingId(a.id);
    setRetireReasonError(null);
    setRowError(null);
    setNotice(null);
    try {
      const res = await retireAttachment(projectId, a.id, { reason: retireReason.trim() || null });
      if (res.alreadyInactive) {
        setNotice({ tone: 'info', text: `Tài liệu “${res.attachment.fileName}” đã ngừng sử dụng trước đó — không thay đổi gì thêm.` });
      } else {
        setNotice({ tone: 'success', text: `Đã ngừng sử dụng “${res.attachment.fileName}” — file và lịch sử vẫn được giữ.` });
      }
      setConfirmId(null);
      reload();
      onChanged?.();
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.fieldErrors?.reason?.length) setRetireReasonError(e2.fieldErrors.reason.join(' '));
      else if (e2.status === 401) setRowError('Phiên hết hạn, vui lòng đăng nhập lại.');
      else if (e2.status === 403) setRowError('Không có quyền — cần ADMIN hoặc là quản lý/điều phối viên của dự án (403).');
      else if (e2.status === 404) setRowError('Không tìm thấy tài liệu (404).');
      else setRowError(e2.message || 'Ngừng sử dụng thất bại');
    } finally {
      setRetirePendingId(null);
    }
  }

  function renderListError() {
    if (!error) return null;
    if (error.status === 401) {
      return <Alert tone="error">Phiên hết hạn, vui lòng đăng nhập lại (401)</Alert>;
    }
    if (error.status === 403) {
      return (
        <>
          <Alert tone="error">Không có quyền xem tài liệu — cần là thành viên dự án (403)</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={reload}>
              Thử lại
            </Button>
          </div>
        </>
      );
    }
    if (error.status === 404) {
      return (
        <>
          <Alert tone="error">Không tìm thấy dự án (404) — kiểm tra lại đường dẫn</Alert>
          <div style={{ marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={reload}>
              Thử lại
            </Button>
          </div>
        </>
      );
    }
    return (
      <>
        <Alert tone="error">{error.message || 'Không thể tải danh sách tài liệu'}</Alert>
        <div style={{ marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={reload}>
            Thử lại
          </Button>
        </div>
      </>
    );
  }

  const confirming = confirmId ? items.find((a) => a.id === confirmId) ?? null : null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div className="bf-card-head">
        <span className="bf-card-title">Tài liệu đính kèm</span>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          {total > 0 ? (
            <span style={{ fontSize: '0.85rem', color: 'var(--bf-muted)' }}>{total} tài liệu</span>
          ) : null}
          {canManage ? (
            <Button variant="primary" onClick={openUpload}>
              Tải lên
            </Button>
          ) : null}
        </div>
      </div>

      {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
      {rowError ? <Alert tone="error">{rowError}</Alert> : null}

      {loading ? (
        <p aria-busy="true">Đang tải danh sách tài liệu…</p>
      ) : (
        renderListError() ??
        (items.length === 0 ? (
          <EmptyState title="Chưa có tài liệu đính kèm">
            {canManage
              ? 'Nhấn “Tải lên” để thêm tài liệu đầu tiên cho dự án (JPEG, PNG, WebP hoặc PDF, tối đa 10MB).'
              : 'Dự án này chưa có tài liệu đính kèm nào.'}
          </EmptyState>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="bf-table" aria-label="Danh sách tài liệu đính kèm">
              <thead>
                <tr>
                  <th scope="col">Tên</th>
                  <th scope="col">Loại</th>
                  <th scope="col">Kích thước</th>
                  <th scope="col">Thời gian</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} style={a.isActive ? undefined : { opacity: 0.65 }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{a.fileName}</div>
                      {a.caption ? (
                        <div style={{ fontSize: '0.85rem', color: 'var(--bf-muted)' }}>{a.caption}</div>
                      ) : null}
                    </td>
                    <td>{mimeLabel(a.mimeType)}</td>
                    <td style={{ fontFeatureSettings: "'tnum'" }}>{formatAttachmentSize(a.sizeBytes)}</td>
                    <td>{new Date(a.createdAt).toLocaleString('vi-VN')}</td>
                    <td>
                      {a.isActive ? (
                        <span className="bf-badge-active">Đang sử dụng</span>
                      ) : (
                        <span className="bf-badge-neutral">Đã ngừng</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <Button variant="secondary" onClick={() => void handleDownload(a)} disabled={downloadingId === a.id}>
                          {downloadingId === a.id ? 'Đang tải…' : 'Tải xuống'}
                        </Button>
                        {canManage && a.isActive ? (
                          <Button variant="secondary" onClick={() => openRetireConfirm(a)} disabled={retirePendingId === a.id}>
                            Ngừng sử dụng
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {confirming ? (
        <div
          role="dialog"
          aria-label={`Xác nhận ngừng sử dụng tài liệu ${confirming.fileName}`}
          style={{
            border: '1px solid var(--bf-line)',
            borderRadius: '0.5rem',
            padding: '0.75rem',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            Ngừng sử dụng tài liệu “{confirming.fileName}”?
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
            Ngừng sử dụng giữ lại file và lịch sử — vẫn tải xuống được. Không có xóa vĩnh viễn.
          </p>
          <div className="bf-field">
            <label className="bf-label" htmlFor="attachment-retire-reason">
              Lý do (không bắt buộc)
            </label>
            <textarea
              id="attachment-retire-reason"
              className="bf-input"
              rows={2}
              maxLength={ATTACHMENT_TEXT_MAX_LENGTH}
              value={retireReason}
              onChange={(e) => setRetireReason(e.target.value)}
              placeholder="Ví dụ: bản vẽ cũ, đã có bản cập nhật…"
              aria-describedby="attachment-retire-reason-count"
            />
            <p id="attachment-retire-reason-count" style={{ fontSize: '0.8rem', color: 'var(--bf-muted)', margin: '0.25rem 0 0' }}>
              {retireReason.length}/{ATTACHMENT_TEXT_MAX_LENGTH} ký tự · lý do được lưu cùng nhật ký thao tác
            </p>
          </div>
          {retireReasonError ? (
            <p id="attachment-retire-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: 0 }}>
              {retireReasonError}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="secondary" onClick={() => void handleRetire(confirming)} disabled={retirePendingId !== null}>
              {retirePendingId ? 'Đang xử lý…' : 'Xác nhận ngừng sử dụng'}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmId(null)} disabled={retirePendingId !== null}>
              Hủy
            </Button>
          </div>
        </div>
      ) : null}

      {!canManage && !loading ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--bf-muted)' }}>
          Chỉ ADMIN và PROJECT_MANAGER là thành viên dự án mới được tải lên/ngừng sử dụng tài liệu.
        </p>
      ) : null}

      {uploadOpen ? (
        <Dialog title="Tải lên tài liệu" onClose={() => (uploading ? undefined : setUploadOpen(false))}>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {uploadGlobalError ? <Alert tone="error">{uploadGlobalError}</Alert> : null}
            <div className="bf-field">
              <label className="bf-label" htmlFor="attachment-upload-file">
                File (JPEG, PNG, WebP hoặc PDF — tối đa 10MB)
              </label>
              <Input
                id="attachment-upload-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setFileError(null);
                }}
                disabled={uploading}
                aria-invalid={fileError ? true : undefined}
                aria-describedby={fileError ? 'attachment-upload-file-error' : undefined}
              />
              {fileError ? (
                <p id="attachment-upload-file-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                  {fileError}
                </p>
              ) : null}
            </div>
            <div className="bf-field">
              <label className="bf-label" htmlFor="attachment-upload-caption">
                Chú thích (không bắt buộc)
              </label>
              <Input
                id="attachment-upload-caption"
                placeholder="Ví dụ: Bản vẽ tầng 1 — bản cập nhật tháng 9…"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={uploading}
                aria-invalid={captionError ? true : undefined}
                aria-describedby={captionError ? 'attachment-upload-caption-error' : undefined}
              />
              {captionError ? (
                <p id="attachment-upload-caption-error" role="alert" style={{ color: 'var(--bf-risk)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                  {captionError}
                </p>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={uploading}>
                Hủy
              </Button>
              <Button variant="primary" onClick={() => void handleUpload()} disabled={uploading} aria-busy={uploading}>
                {uploading ? 'Đang tải lên…' : 'Xác nhận tải lên'}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
