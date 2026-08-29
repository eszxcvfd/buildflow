import { IsArray, IsOptional, IsString, IsUUID, ArrayUnique, MaxLength } from 'class-validator';

export class AssignRolesDto {
  @IsArray({ message: 'roleIds phải là mảng' })
  @ArrayUnique({ message: 'roleIds không được trùng lặp' })
  @IsUUID('4', { each: true, message: 'roleIds phải là UUID v4 hợp lệ' })
  roleIds!: string[];

  @IsOptional()
  @IsString({ message: 'reason phải là chuỗi' })
  @MaxLength(500, { message: 'reason tối đa 500 ký tự' })
  reason?: string | null;
}

export class RoleDto {
  id!: string;
  code!: string;
  name!: string;
}

export class AssignRolesResponseDto {
  userId!: string;
  roles!: RoleDto[];
  beforeRoleIds!: string[];
  afterRoleIds!: string[];
  effectivePolicy!: string;
}

export class GetRolesResponseDto {
  userId!: string;
  roles!: RoleDto[];
  effectivePolicy!: string;
}
