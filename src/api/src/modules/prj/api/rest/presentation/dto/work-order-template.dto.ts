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

export type WorkOrderTemplateStatusValue = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type WorkOrderTemplateLifecycleActionValue = 'ACTIVATE' | 'DEACTIVATE';

export interface RequiredSkillDto {
  code: string;
  label: string;
}

export interface ChecklistSnapshotDto {
  title: string;
  answerType: string;
  isRequired: boolean;
  isBlocking: boolean;
  requiresPhoto?: boolean;
  sequenceNo: number;
}

export interface TemplateWorkTypeDto {
  id: string;
  code: string;
  name: string;
}

export interface WorkOrderTemplateResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  workTypeId: string | null;
  /** Ref hiển thị loại công việc (kể cả loại đã ngừng) — `null` khi `workTypeId` NULL hoặc ref thiếu. */
  workType: TemplateWorkTypeDto | null;
  requiredTradeId: string | null;
  defaultDurationMinutes: number | null;
  defaultPriority: string;
  requiredSkills: RequiredSkillDto[];
  checklistSnapshot: ChecklistSnapshotDto[];
  sourceChecklistTemplateId: string | null;
  status: WorkOrderTemplateStatusValue;
  version: number;
  usableForNewWorkOrder: boolean;
  createdAt: string;
  updatedAt: string;
  alreadyInState?: boolean;
}

/**
 * PRJ-SRS-008 (issue #39) — DTO cho mẫu công việc.
 * - `requiredSkills`/`checklistSnapshot` shape chi tiết do policy validate sâu
 *   (use case trả 400 fieldErrors); DTO chỉ gate kiểu mảng + field bắt buộc.
 * - `workTypeId`/`requiredTradeId` là UUID khi gửi; tồn tại + active do use case
 *   kiểm tra. `sourceChecklistTemplateId` là UUID khi gửi; tồn tại do use case
 *   kiểm tra (snapshot-copy khi tạo nếu omit checklist tường minh).
 */
export class RequiredSkillInputDto {
  @IsString()
  @IsNotEmpty({ message: 'Code kỹ năng không được để trống' })
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'Label kỹ năng không được để trống' })
  @MaxLength(120)
  label!: string;
}

export class ChecklistSnapshotInputDto {
  @IsString()
  @IsNotEmpty({ message: 'Title checklist không được để trống' })
  @MaxLength(250)
  title!: string;

  @IsString()
  @IsIn(['YES_NO', 'TEXT', 'NUMBER', 'PASS_FAIL'], { message: 'AnswerType checklist không hợp lệ' })
  answerType!: string;

  @IsOptional()
  @IsBoolean({ message: 'isRequired phải là boolean' })
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'isBlocking phải là boolean' })
  isBlocking?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'requiresPhoto phải là boolean' })
  requiresPhoto?: boolean;

  @IsInt({ message: 'sequenceNo phải là số nguyên' })
  @Min(1, { message: 'sequenceNo phải lớn hơn 0' })
  sequenceNo!: number;
}

export class CreateWorkOrderTemplateDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã mẫu công việc không được để trống' })
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên mẫu công việc không được để trống' })
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Loại công việc không hợp lệ' })
  workTypeId?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Ngành nghề yêu cầu không hợp lệ' })
  requiredTradeId?: string | null;

  @IsOptional()
  @IsArray({ message: 'Danh sách kỹ năng phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => RequiredSkillInputDto)
  requiredSkills?: RequiredSkillInputDto[];

  @IsOptional()
  @IsArray({ message: 'Checklist phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => ChecklistSnapshotInputDto)
  checklistSnapshot?: ChecklistSnapshotInputDto[];

  @IsOptional()
  @IsUUID('4', { message: 'Mẫu checklist nguồn không hợp lệ' })
  sourceChecklistTemplateId?: string | null;

  @IsOptional()
  @IsInt({ message: 'Thời lượng mặc định phải là số nguyên' })
  @Min(1, { message: 'Thời lượng mặc định phải lớn hơn 0' })
  defaultDurationMinutes?: number | null;

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'], { message: 'Ưu tiên mặc định không hợp lệ' })
  defaultPriority?: string;
}

export class UpdateWorkOrderTemplateDto {
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
  @IsUUID('4', { message: 'Loại công việc không hợp lệ' })
  workTypeId?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Ngành nghề yêu cầu không hợp lệ' })
  requiredTradeId?: string | null;

  @IsOptional()
  @IsArray({ message: 'Danh sách kỹ năng phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => RequiredSkillInputDto)
  requiredSkills?: RequiredSkillInputDto[];

  @IsOptional()
  @IsArray({ message: 'Checklist phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => ChecklistSnapshotInputDto)
  checklistSnapshot?: ChecklistSnapshotInputDto[];

  @IsOptional()
  @IsUUID('4', { message: 'Mẫu checklist nguồn không hợp lệ' })
  sourceChecklistTemplateId?: string | null;

  @IsOptional()
  @IsInt({ message: 'Thời lượng mặc định phải là số nguyên' })
  @Min(1, { message: 'Thời lượng mặc định phải lớn hơn 0' })
  defaultDurationMinutes?: number | null;

  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'], { message: 'Ưu tiên mặc định không hợp lệ' })
  defaultPriority?: string;

  @IsOptional()
  @IsInt({ message: 'Version mẫu không hợp lệ' })
  @Min(1, { message: 'Version mẫu không hợp lệ' })
  @Max(2147483647)
  expectedVersion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class ChangeWorkOrderTemplateStatusDto {
  @IsIn(['ACTIVATE', 'DEACTIVATE'], { message: 'Hành động không hợp lệ (ACTIVATE/DEACTIVATE)' })
  action!: WorkOrderTemplateLifecycleActionValue;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
