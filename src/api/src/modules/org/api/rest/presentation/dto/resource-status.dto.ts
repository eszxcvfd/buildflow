import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { REASON_MAX_LENGTH } from '../../../../domain/service/resource-status.policy';

/**
 * ORG-SRS-004 (issue #27) — status lifecycle worker/contractor.
 * Body: { action: 'ACTIVATE'|'SUSPEND'|'TERMINATE', reason? }.
 * Reason policy được use case enforce (SUSPEND/TERMINATE bắt buộc 1-500) — DTO chỉ
 * chặn shape sai; message lý do bắt buộc trả từ use case để không trùng lặp luật.
 */
export type ResourceLifecycleActionValue = 'ACTIVATE' | 'SUSPEND' | 'TERMINATE';

export class ChangeResourceStatusDto {
  @IsIn(['ACTIVATE', 'SUSPEND', 'TERMINATE'], { message: 'Action không hợp lệ' })
  action!: ResourceLifecycleActionValue;

  @IsOptional()
  @IsString({ message: 'reason phải là chuỗi' })
  @MaxLength(REASON_MAX_LENGTH, { message: `Lý do tối đa ${REASON_MAX_LENGTH} ký tự` })
  reason?: string | null;
}
