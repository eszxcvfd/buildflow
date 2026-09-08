import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { WorkOrderPriority } from '../../../../domain/service/work-order.policy';
import { WorkOrderStatus } from '../../../../domain/entity/work-order.entity';

export interface WorkOrderResponseDto {
  id: string;
  code: string;
  projectId: string;
  areaId: string | null;
  workTypeId: string;
  workTypeName?: string | null;
  requiredTradeId: string | null;
  title: string;
  description: string | null;
  instructions: string | null;
  priority: WorkOrderPriority;
  /** Full DB enum (G1: GET mọi WO non-DRAFT phải serialize đúng). */
  status: WorkOrderStatus;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  plannedHeadcount: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  idempotentReplay?: boolean;
}

/**
 * JOB-SRS-001 (issue #41) — DTO tạo Work Order nháp.
 * - `projectId`/`workTypeId` bắt buộc (UUID); `areaId`/`requiredTradeId`
 *   optional (same-project + active do use case kiểm tra, 400 fieldErrors).
 * - `code` pattern chi tiết do policy validate (400 fieldErrors `{code}`);
 *   DTO chỉ gate kiểu chuỗi. `requestKey` UUID optional (replay key).
 * - Cross-field `plannedStartAt < plannedEndAt` do use case kiểm tra
 *   (400 fieldErrors `{plannedEndAt}`).
 */
export class CreateWorkOrderDto {
  @IsUUID('4', { message: 'Dự án không hợp lệ' })
  @IsNotEmpty({ message: 'Dự án không được để trống' })
  projectId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'Khu vực không hợp lệ' })
  areaId?: string | null;

  @IsUUID('4', { message: 'Loại công việc không hợp lệ' })
  @IsNotEmpty({ message: 'Loại công việc không được để trống' })
  workTypeId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'Ngành nghề yêu cầu không hợp lệ' })
  requiredTradeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'Tiêu đề công việc không được để trống' })
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string | null;

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'], { message: 'Ưu tiên công việc không hợp lệ' })
  priority?: WorkOrderPriority;

  @IsOptional()
  @IsISO8601({}, { message: 'Thời điểm bắt đầu kế hoạch không hợp lệ' })
  plannedStartAt?: string | null;

  @IsOptional()
  @IsISO8601({}, { message: 'Thời điểm kết thúc kế hoạch không hợp lệ' })
  plannedEndAt?: string | null;

  @IsOptional()
  @IsInt({ message: 'Số lượng dự kiến phải là số nguyên' })
  @Min(1, { message: 'Số lượng dự kiến phải lớn hơn 0' })
  @Max(99, { message: 'Số lượng dự kiến tối đa 99' })
  plannedHeadcount?: number | null;

  @IsOptional()
  @IsUUID('4', { message: 'Request key không hợp lệ' })
  requestKey?: string | null;
}
