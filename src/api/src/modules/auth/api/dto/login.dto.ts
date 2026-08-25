import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'worker1@example.com', description: 'Worker email' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Password123!', description: 'Account password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}

export class LoginResponseUserDto {
  @ApiProperty({ example: 'clx123' })
  id!: string;

  @ApiProperty({ example: 'worker1@example.com' })
  email!: string;

  @ApiProperty({ example: 'WORKER', enum: ['WORKER', 'ADMIN', 'COORDINATOR'] })
  role!: string;

  @ApiProperty({ example: 'ACTIVE', enum: ['ACTIVE', 'LOCKED', 'DISABLED'] })
  status!: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: 'a1b2c3...' })
  token!: string;

  @ApiProperty({ type: LoginResponseUserDto })
  user!: LoginResponseUserDto;
}
