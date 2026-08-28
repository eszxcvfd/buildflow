import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  IsIn,
  IsUUID,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email!: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi' })
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(128)
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  @MaxLength(150)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({}, { message: 'Avatar URL không hợp lệ' })
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string | null;

  @IsOptional()
  @IsIn(['STAFF', 'WORKER'], { message: 'Loại tài khoản không hợp lệ' })
  userType?: 'STAFF' | 'WORKER';

  @IsOptional()
  @IsUUID('4', { message: 'Contractor ID không hợp lệ' })
  contractorId?: string | null;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @IsNotEmpty({ message: 'Họ tên không được để trống' })
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl({}, { message: 'Avatar URL không hợp lệ' })
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string | null;

  @IsOptional()
  @IsIn(['STAFF', 'WORKER'], { message: 'Loại tài khoản không hợp lệ' })
  userType?: 'STAFF' | 'WORKER';

  @IsOptional()
  @IsUUID('4', { message: 'Contractor ID không hợp lệ' })
  contractorId?: string | null;
}

export class UpdateUserStatusDto {
  @IsString()
  @IsIn(['ACTIVE', 'LOCKED', 'INACTIVE'], { message: 'Trạng thái không hợp lệ' })
  status!: 'ACTIVE' | 'LOCKED' | 'INACTIVE';
}

export class AdminUserResponseDto {
  id!: string;
  email!: string;
  fullName!: string;
  phone!: string | null;
  avatarUrl!: string | null;
  employeeCode!: string | null;
  userType!: string;
  contractorId!: string | null;
  status!: string;
  createdAt!: string;
  updatedAt!: string;
}
