import { IsEmail, IsOptional, IsString, IsUUID, MaxLength, IsInt, Min, Max, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WorkerTradeDto {
  @IsUUID('4', { message: 'Trade ID không hợp lệ' })
  tradeId!: string;

  @IsInt({ message: 'Skill level phải là số nguyên' })
  @Min(1, { message: 'Skill level tối thiểu 1' })
  @Max(5, { message: 'Skill level tối đa 5' })
  skillLevel!: number;
}

export class CreateWorkerDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  @IsString()
  @MaxLength(150)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Contractor ID không hợp lệ' })
  contractorId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkerTradeDto)
  trades?: WorkerTradeDto[];
}

export class UpdateWorkerDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string | null;

  @IsOptional()
  @IsUUID('4', { message: 'Contractor ID không hợp lệ' })
  contractorId?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkerTradeDto)
  trades?: WorkerTradeDto[];
}

export class WorkerResponseDto {
  id!: string;
  email!: string;
  fullName!: string;
  phone!: string | null;
  avatarUrl!: string | null;
  employeeCode!: string | null;
  userType!: string;
  contractorId!: string | null;
  status!: string;
  trades!: Array<{ tradeId: string; skillLevel: number; effectiveFrom?: string; isActive?: boolean }>;
  eligible!: boolean;
  createdAt!: string;
  updatedAt!: string;
  /**
   * ORG-05 — active memberships của worker (chỉ có ở GET list/detail;
   * create/update/status dùng toWorkerResponse nên không có key này).
   */
  crews?: Array<{ crewId: string; crewCode: string; crewName: string; memberRole: 'LEAD' | 'MEMBER' }>;
}

/**
 * ORG-03/ORG-05 — item của `GET /api/v1/workers/:workerId/crews`
 * (active only; lịch sử is_active=false KHÔNG trả).
 */
export class WorkerCrewMembershipDto {
  crewId!: string;
  crewCode!: string;
  crewName!: string;
  crewStatus!: 'ACTIVE' | 'INACTIVE';
  memberRole!: 'LEAD' | 'MEMBER';
  effectiveFrom!: string;
  effectiveTo!: string | null;
}
