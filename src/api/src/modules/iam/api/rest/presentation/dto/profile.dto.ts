import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @MinLength(1, { message: 'Họ tên không được để trống' })
  @MaxLength(150, { message: 'Họ tên tối đa 150 ký tự' })
  fullName?: string;

  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @MaxLength(20, { message: 'Số điện thoại tối đa 20 ký tự' })
  phone?: string | null;

  @IsOptional()
  @IsString({ message: 'Avatar URL phải là chuỗi' })
  @MaxLength(500, { message: 'Avatar URL tối đa 500 ký tự' })
  @IsUrl({}, { message: 'Avatar URL không hợp lệ' })
  avatarUrl?: string | null;
}

export class ProfileResponseDto {
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
