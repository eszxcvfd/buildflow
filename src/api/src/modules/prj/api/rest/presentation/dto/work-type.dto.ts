import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export type WorkTypeStatusValue = 'ACTIVE' | 'INACTIVE';
export type WorkTypeLifecycleActionValue = 'ACTIVATE' | 'DEACTIVATE';

export interface RequiredFieldDto {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

export interface WorkTypeResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  group: string | null;
  requiredTradeId: string | null;
  requiredFields: RequiredFieldDto[];
  configVersion: number;
  defaultDurationMinutes: number | null;
  defaultPriority: string;
  status: WorkTypeStatusValue;
  usableForNewWorkOrder: boolean;
  createdAt: string;
  updatedAt: string;
  usage?: { workOrders: number };
  warning?: string;
  alreadyInState?: boolean;
}

/**
 * PRJ-SRS-004 (issue #35) — DTO cho loại công việc.
 * - `requiredFields` shape chi tiết (`{key,label,type}`) do policy validate
 *   sâu (use case trả 400 fieldErrors); DTO chỉ gate kiểu mảng.
 * - `requiredTradeId` là UUID khi gửi; tồn tại + active do use case kiểm tra.
 */
export class RequiredFieldInputDto {
  @IsString()
  @IsNotEmpty({ message: 'Key dữ liệu bắt buộc không được để trống' })
  @MaxLength(50)
  key!: string;

  @IsString()
  @IsNotEmpty({ message: 'Label dữ liệu bắt buộc không được để trống' })
  @MaxLength(120)
  label!: string;

  @IsString()
  @IsIn(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT', 'PHOTO'], { message: 'Type dữ liệu bắt buộc không hợp lệ' })
  type!: string;

  @IsOptional()
  @IsBoolean({ message: 'Required phải là boolean' })
  required?: boolean;

  @IsOptional()
  @IsArray({ message: 'Options phải là mảng chuỗi' })
  @IsString({ each: true })
  options?: string[];
}

export class CreateWorkTypeDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã loại công việc không được để trống' })
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên loại công việc không được để trống' })
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  group?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Ngành nghề yêu cầu không hợp lệ' })
  requiredTradeId?: string | null;

  @IsOptional()
  @IsArray({ message: 'Danh sách dữ liệu bắt buộc phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => RequiredFieldInputDto)
  requiredFields?: RequiredFieldInputDto[];

  @IsOptional()
  @IsInt({ message: 'Thời lượng mặc định phải là số nguyên' })
  @Min(1, { message: 'Thời lượng mặc định phải lớn hơn 0' })
  defaultDurationMinutes?: number | null;

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'], { message: 'Ưu tiên mặc định không hợp lệ' })
  defaultPriority?: string;
}

export class UpdateWorkTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  group?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Ngành nghề yêu cầu không hợp lệ' })
  requiredTradeId?: string | null;

  @IsOptional()
  @IsArray({ message: 'Danh sách dữ liệu bắt buộc phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => RequiredFieldInputDto)
  requiredFields?: RequiredFieldInputDto[];

  @IsOptional()
  @IsInt({ message: 'Thời lượng mặc định phải là số nguyên' })
  @Min(1, { message: 'Thời lượng mặc định phải lớn hơn 0' })
  defaultDurationMinutes?: number | null;

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'], { message: 'Ưu tiên mặc định không hợp lệ' })
  defaultPriority?: string;

  @IsOptional()
  @IsInt({ message: 'Version cấu hình không hợp lệ' })
  @Min(1, { message: 'Version cấu hình không hợp lệ' })
  @Max(2147483647)
  expectedConfigVersion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class ChangeWorkTypeStatusDto {
  @IsIn(['ACTIVATE', 'DEACTIVATE'], { message: 'Hành động không hợp lệ (ACTIVATE/DEACTIVATE)' })
  action!: WorkTypeLifecycleActionValue;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
