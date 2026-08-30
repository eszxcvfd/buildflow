import { IsString, IsOptional, IsIn, MaxLength, IsEmail, IsNotEmpty } from 'class-validator';

export class CreateContractorDto {
  @IsString()
  @IsNotEmpty({ message: 'Mã nhà thầu không được để trống' })
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên nhà thầu không được để trống' })
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Thông tin liên hệ không được để trống' })
  @MaxLength(150)
  contactName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email?: string | null;

  @IsString()
  @IsNotEmpty({ message: 'Phạm vi công việc không được để trống' })
  @MaxLength(1000)
  scope!: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'Trạng thái không hợp lệ' })
  status?: 'ACTIVE' | 'INACTIVE';
}

export class UpdateContractorDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  scope?: string | null;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'Trạng thái không hợp lệ' })
  status?: 'ACTIVE' | 'INACTIVE';
}

export class ContractorResponseDto {
  id!: string;
  code!: string;
  name!: string;
  contactName!: string | null;
  phone!: string | null;
  email!: string | null;
  status!: string;
  scope!: string | null;
  eligible!: boolean;
  createdBy!: string;
  createdAt!: string;
  updatedAt!: string;
}
