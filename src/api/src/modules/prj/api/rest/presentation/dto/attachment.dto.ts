import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export interface AttachmentResponseDto {
  id: string;
  projectId: string;
  workOrderId: string | null;
  ownerType: 'PROJECT' | 'WORK_ORDER';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
  deactivateReason: string | null;
  createdAt: string;
  idempotentReplay?: boolean;
  alreadyInactive?: boolean;
}

/**
 * PRJ-SRS-009 (issue #40) — multipart fields cho upload (file đi qua
 * `FileInterceptor('file')`, không qua DTO). `attachmentType` server-fixed
 * `DOCUMENT` — client không gửi. `requestKey` UUID optional (replay key,
 * mirror WO #41); sai format → 400 fieldErrors ở use case.
 */
export class UploadAttachmentBodyDto {
  @IsOptional()
  @IsString({ message: 'Mô tả tệp phải là chuỗi' })
  @MaxLength(500, { message: 'Mô tả tệp tối đa 500 ký tự' })
  caption?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Request key phải là UUID hợp lệ' })
  requestKey?: string;
}

/** Body cho `PATCH .../retire`: `{ reason? }` (≤500, optional). */
export class RetireAttachmentDto {
  @IsOptional()
  @IsString({ message: 'Lý do phải là chuỗi' })
  @MaxLength(500, { message: 'Lý do ngừng sử dụng tối đa 500 ký tự' })
  reason?: string;
}
