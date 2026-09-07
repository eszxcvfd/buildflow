import { IsString, IsOptional, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * PRJ-SRS-001 (issue #32) — DTO cho write slice dự án.
 * - POST whitelist: client không set được `status` (luôn `DRAFT`);
 *   controller dùng `forbidNonWhitelisted` nên field lạ (gồm `status`) → 400.
 * - PATCH whitelist P3: name, description, address, timezone,
 *   plannedStartDate, plannedEndDate, managerId. `code`/`status` khai báo
 *   optional ở đây để ValidationPipe giữ lại và controller/use case
 *   reject explicit 400 fieldErrors (không silent-ignore).
 * - `managerId`/ngày kế hoạch chỉ check `IsString` ở transport; mọi semantic
 *   (uuid, ACTIVE user, ISO date, end >= start) do use case trả 400 fieldErrors
 *   thống nhất (tránh shape 400 generic nuốt fieldErrors).
 */
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã dự án không được để trống' })
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên dự án không được để trống' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ dự án không được để trống' })
  @MaxLength(500)
  address!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'Ngày bắt đầu kế hoạch không được để trống' })
  plannedStartDate!: string;

  @IsString()
  @IsNotEmpty({ message: 'Ngày kết thúc kế hoạch không được để trống' })
  plannedEndDate!: string;

  @IsString()
  @IsNotEmpty({ message: 'Quản lý dự án không được để trống' })
  managerId!: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string | null;

  @IsOptional()
  @IsString()
  plannedStartDate?: string;

  @IsOptional()
  @IsString()
  plannedEndDate?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  /** Bất biến (P3) — có mặt → 400 fieldErrors `code`. */
  @IsOptional()
  @IsString()
  code?: string;

  /** Lifecycle #33 (P3) — có mặt → 400 fieldErrors `status`. */
  @IsOptional()
  @IsString()
  status?: string;
}

/** P8 — ProjectProfileDto. */
export class ProjectProfileDto {
  id!: string;
  code!: string;
  name!: string;
  description!: string | null;
  address!: string;
  timezone!: string;
  plannedStartDate!: string;
  plannedEndDate!: string;
  managerId!: string;
  managerName!: string | null;
  status!: string;
  createdBy!: string;
  createdAt!: string;
  updatedBy!: string;
  updatedAt!: string;
}

/**
 * PRJ-SRS-002 (issue #33, L1) — DTO cho `PATCH /api/v1/projects/:id/status`.
 * `action` chỉ check `IsString` ở transport; action chưa biết → 400 ở use case,
 * action biết nhưng không hợp lệ với trạng thái hiện tại → 409 INVALID_TRANSITION.
 * `reason` semantic (bắt buộc cho PAUSE/CLOSE/REOPEN, 1-500) do use case trả
 * 400 fieldErrors thống nhất (tránh shape 400 generic nuốt fieldErrors).
 */
export class TransitionProjectStatusDto {
  @IsString()
  @IsNotEmpty({ message: 'Action không được để trống' })
  action!: string;

  @IsOptional()
  @IsString()
  reason?: string | null;
}
