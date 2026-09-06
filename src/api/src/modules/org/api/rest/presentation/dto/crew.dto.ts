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
}
