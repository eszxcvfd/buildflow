import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi' })
  @MinLength(1, { message: 'Mật khẩu hiện tại không được để trống' })
  @MaxLength(128)
  currentPassword!: string;

  @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  @MaxLength(128)
  @Matches(/[A-Za-z]/, { message: 'Mật khẩu mới phải chứa ít nhất một chữ cái' })
  @Matches(/[0-9]/, { message: 'Mật khẩu mới phải chứa ít nhất một chữ số' })
  newPassword!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  confirmPassword?: string;
}

export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255)
  email!: string;
}

export class ResetPasswordDto {
  @IsString({ message: 'Token không hợp lệ' })
  @MinLength(10, { message: 'Token không hợp lệ' })
  @MaxLength(255)
  token!: string;

  @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  @MaxLength(128)
  @Matches(/[A-Za-z]/, { message: 'Mật khẩu mới phải chứa ít nhất một chữ cái' })
  @Matches(/[0-9]/, { message: 'Mật khẩu mới phải chứa ít nhất một chữ số' })
  newPassword!: string;
}

export class ChangePasswordResponseDto {
  message!: string;
  reauthRequired!: boolean;
}

export class RequestPasswordResetResponseDto {
  message!: string;
  /** Only present in non-production (demo/test): reset link for manual delivery. */
  resetUrl?: string;
}
