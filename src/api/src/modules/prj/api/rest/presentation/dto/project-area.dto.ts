import { IsString, IsOptional, IsNotEmpty, IsBoolean, MaxLength } from 'class-validator';

/**
 * PRJ-SRS-003 (issue #34, A1) — DTO cho khu vực dự án.
 * - POST whitelist: `name` (bắt buộc) + `code` (optional).
 * - PATCH: `name?` (rename tại chỗ), `code?` (null = gỡ mã),
 *   `isActive?` (toggle; false = soft-retire), `reason?` (1-500, cột audit).
 * - Mọi semantic (trim, trùng tên/mã, scope) do use case trả 400/404/403/409
 *   thống nhất (tránh shape 400 generic nuốt fieldErrors).
 */
export class CreateProjectAreaDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'Tên khu vực không được để trống' })
  @MaxLength(150)
  name!: string;
}

export class UpdateProjectAreaDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái hoạt động không hợp lệ' })
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

/** ProjectAreaDto — `isActive=false` = đã retire (flag, giữ lịch sử). */
export class ProjectAreaDto {
  id!: string;
  projectId!: string;
  code!: string | null;
  name!: string;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;
}
