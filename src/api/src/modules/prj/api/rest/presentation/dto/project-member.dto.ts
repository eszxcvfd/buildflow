import { IsString, IsOptional, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

/**
 * PRJ-SRS-005 (issue #36, M1) — DTO cho quản lý thành viên dự án.
 * - POST whitelist: `userId` (uuid) + `projectRole`. `projectRole` chỉ check
 *   `IsString` ở transport; semantic (`MANAGER` → 400 fieldErrors `{projectRole}`,
 *   role lạ → 400) do use case trả thống nhất (tránh shape 400 generic nuốt fieldErrors).
 * - DELETE body optional `{reason?}` (1-500, ghi cột `audit_logs.reason`).
 */
export class AddProjectMemberDto {
  @IsUUID('4', { message: 'Người dùng không hợp lệ' })
  userId!: string;

  @IsString()
  @IsNotEmpty({ message: 'Vai trò thành viên không được để trống' })
  projectRole!: string;
}

export class RemoveProjectMemberDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

/** ProjectMemberDto (M1) — `createdAt` = `joined_at` (bảng không có `created_at`). */
export class ProjectMemberDto {
  id!: string;
  userId!: string;
  userName!: string | null;
  userCode!: string | null;
  projectRole!: string;
  joinedAt!: string;
  leftAt!: string | null;
  isActive!: boolean;
  addedBy!: string;
  createdAt!: string;
}
