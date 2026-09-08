/**
 * PRJ-SRS-009 (issue #40) — attachment entity (mirror work-order-template
 * entity style: validate ở constructor, ném Error, use case convert 400).
 */

export type AttachmentOwnerType = 'PROJECT' | 'WORK_ORDER';

export interface AttachmentProps {
  id: string;
  projectId: string;
  workOrderId: string | null;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  attachmentType: string;
  uploadedBy: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  isActive: boolean;
  deactivatedAt: Date | null;
  deactivatedBy: string | null;
  deactivateReason: string | null;
  requestKey: string | null;
  createdAt: Date;
}

export class AttachmentEntity {
  readonly id: string;
  readonly projectId: string;
  readonly workOrderId: string | null;
  readonly ownerType: AttachmentOwnerType;
  readonly ownerId: string;
  readonly attachmentType: string;
  readonly uploadedBy: string;
  readonly fileName: string;
  readonly storageKey: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly caption: string | null;
  readonly isActive: boolean;
  readonly deactivatedAt: Date | null;
  readonly deactivatedBy: string | null;
  readonly deactivateReason: string | null;
  readonly requestKey: string | null;
  readonly createdAt: Date;

  constructor(props: AttachmentProps) {
    if (!props.id) throw new Error('Thiếu id tệp đính kèm');
    if (!props.projectId) throw new Error('Thiếu id dự án');
    if (props.ownerType !== 'PROJECT' && props.ownerType !== 'WORK_ORDER') {
      throw new Error('Phạm vi sở hữu tệp không hợp lệ');
    }
    if (!props.ownerId) throw new Error('Thiếu id đối tượng sở hữu tệp');
    if (!props.fileName) throw new Error('Thiếu tên tệp');
    if (!props.storageKey) throw new Error('Thiếu khóa lưu trữ tệp');
    if (!props.mimeType) throw new Error('Thiếu định dạng tệp');
    if (!Number.isInteger(props.sizeBytes) || props.sizeBytes <= 0) {
      throw new Error('Kích thước tệp không hợp lệ');
    }
    // Revocation invariant mirror `attachments_revocation_ck`:
    // inactive phải có thời điểm ngừng sử dụng.
    if (!props.isActive && !props.deactivatedAt) {
      throw new Error('Tệp ngừng sử dụng phải có thời điểm ghi nhận');
    }
    this.id = props.id;
    this.projectId = props.projectId;
    this.workOrderId = props.workOrderId;
    this.ownerType = props.ownerType;
    this.ownerId = props.ownerId;
    this.attachmentType = props.attachmentType;
    this.uploadedBy = props.uploadedBy;
    this.fileName = props.fileName;
    this.storageKey = props.storageKey;
    this.mimeType = props.mimeType;
    this.sizeBytes = props.sizeBytes;
    this.caption = props.caption;
    this.isActive = props.isActive;
    this.deactivatedAt = props.deactivatedAt;
    this.deactivatedBy = props.deactivatedBy;
    this.deactivateReason = props.deactivateReason;
    this.requestKey = props.requestKey;
    this.createdAt = props.createdAt;
  }

  /** Public metadata cho list response (không lộ đường dẫn vật lý). */
  toPublic(): Record<string, unknown> {
    return {
      id: this.id,
      projectId: this.projectId,
      workOrderId: this.workOrderId,
      ownerType: this.ownerType,
      ownerId: this.ownerId,
      attachmentType: this.attachmentType,
      uploadedBy: this.uploadedBy,
      fileName: this.fileName,
      mimeType: this.mimeType,
      sizeBytes: this.sizeBytes,
      caption: this.caption,
      isActive: this.isActive,
      deactivatedAt: this.deactivatedAt ? this.deactivatedAt.toISOString() : null,
      deactivatedBy: this.deactivatedBy,
      deactivateReason: this.deactivateReason,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
