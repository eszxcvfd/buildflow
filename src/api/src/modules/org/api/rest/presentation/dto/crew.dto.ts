import { IsString, IsOptional, IsNotEmpty, IsUUID, MaxLength } from 'class-validator';

export class CreateCrewDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã đội không được để trống' })
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên đội không được để trống' })
  @MaxLength(120)
  name!: string;

  @IsUUID('4', { message: 'Trưởng nhóm không hợp lệ' })
  leaderUserId!: string;

  @IsOptional()
  @IsUUID('4', { message: 'Nhà thầu không hợp lệ' })
  contractorId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class UpdateCrewDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Trưởng nhóm không hợp lệ' })
  leaderUserId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Nhà thầu không hợp lệ' })
  contractorId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class CrewResponseDto {
  id!: string;
  code!: string;
  name!: string;
  description!: string | null;
  contractorId!: string | null;
  status!: string;
  eligible!: boolean;
  leaderUserId!: string | null;
  createdBy!: string;
  createdAt!: string;
  updatedAt!: string;
  /**
   * ORG-05 — chỉ có ở GET list (search): tên trưởng nhóm (join users qua
   * LEAD active, null khi chưa có LEAD) + số thành viên active.
   */
  leaderName?: string | null;
  memberCount?: number;
}

/**
 * ORG-SRS-007 (issue #30, D1) — POST /crews/:id/members chỉ quản lý MEMBER.
 * member_role luôn 'MEMBER' (LEAD qua leaderUserId swap). effectiveFrom
 * optional ISO date (default today), validate chi tiết ở use case (fieldErrors).
 */
export class CreateCrewMemberDto {
  @IsUUID('4', { message: 'Người dùng không hợp lệ' })
  userId!: string;

  @IsOptional()
  @IsString()
  effectiveFrom?: string | null;
}

/**
 * ORG-SRS-007 (issue #30, D2) — DELETE /crews/:id/members/:memberId (soft-deactivate).
 * effectiveTo optional ISO date (default today, phải >= effectiveFrom);
 * reason optional 1-500 ký tự, ghi vào cột audit_logs.reason.
 */
export class RemoveCrewMemberDto {
  @IsOptional()
  @IsString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class CrewMemberResponseDto {
  id!: string;
  userId!: string;
  memberRole!: string;
  effectiveFrom!: string;
  effectiveTo!: string | null;
  isActive!: boolean;
  addedBy!: string;
  createdAt!: string;
  userName!: string | null;
  userCode!: string | null;
}
