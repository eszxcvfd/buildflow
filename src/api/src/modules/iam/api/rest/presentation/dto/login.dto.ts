import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginRequestDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Mật khẩu không được để trống' })
  @MaxLength(128)
  password!: string;
}

export class LoginResponseDto {
  accessToken!: string;
  expiresAt!: string;
  user!: {
    id: string;
    email: string;
    fullName: string;
    status: string;
    userType: string;
  };
  roles!: Array<{ id: string; code: string; name: string }>;
  projectIds!: string[];
}
