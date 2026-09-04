import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * IAM-SRS-007: confirmPassword is REQUIRED (contract: Web/Mobile build against this).
 * Server also validates confirmPassword === newPassword in the controller.
 */
export class ChangePasswordDto {
  @IsString({ message: 'Mật khẩu hiện tại phải là chuỗi' })
  @MinLength(1, { message: 'Mật khẩu hiện tại không được để trống' })
  @MaxLength(128, { message: 'Mật khẩu hiện tại tối đa 128 ký tự' })
  currentPassword!: string;

  @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  @MaxLength(128, { message: 'Mật khẩu mới tối đa 128 ký tự' })
  @Matches(/[A-Za-z]/, { message: 'Mật khẩu mới phải chứa ít nhất một chữ cái' })
  @Matches(/[0-9]/, { message: 'Mật khẩu mới phải chứa ít nhất một chữ số' })
  newPassword!: string;

  @IsString({ message: 'Xác nhận mật khẩu phải là chuỗi' })
  @MinLength(8, { message: 'Xác nhận mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(128, { message: 'Xác nhận mật khẩu tối đa 128 ký tự' })
  confirmPassword!: string;
}

export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(255, { message: 'Email tối đa 255 ký tự' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString({ message: 'Token không hợp lệ' })
  @MinLength(10, { message: 'Token không hợp lệ' })
  @MaxLength(255, { message: 'Token không hợp lệ' })
  token!: string;

  @IsString({ message: 'Mật khẩu mới phải là chuỗi' })
  @MinLength(8, { message: 'Mật khẩu mới tối thiểu 8 ký tự' })
  @MaxLength(128, { message: 'Mật khẩu mới tối đa 128 ký tự' })
  @Matches(/[A-Za-z]/, { message: 'Mật khẩu mới phải chứa ít nhất một chữ cái' })
  @Matches(/[0-9]/, { message: 'Mật khẩu mới phải chứa ít nhất một chữ số' })
  newPassword!: string;

  @IsString({ message: 'Xác nhận mật khẩu phải là chuỗi' })
  @MinLength(8, { message: 'Xác nhận mật khẩu tối thiểu 8 ký tự' })
  @MaxLength(128, { message: 'Xác nhận mật khẩu tối đa 128 ký tự' })
  confirmPassword!: string;
}

export class ChangePasswordResponseDto {
  message!: string;
  reauthRequired!: boolean;
}

/** Anti-enumeration: response NEVER contains a reset link/token (IAM-SRS-007 contract). */
export class RequestPasswordResetResponseDto {
  message!: string;
}
