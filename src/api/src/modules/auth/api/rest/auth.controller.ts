import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginDto, LoginResponseDto } from '../dto/login.dto';
import { LoginUseCase } from '../../application/use-case/login.use-case';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Worker login with email and password' })
  @ApiResponse({ status: 200, description: 'Login success, returns opaque bearer token', type: LoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials (generic, no existence leak)' })
  @ApiResponse({ status: 400, description: 'Validation error - problem-details' })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    const result = await this.loginUseCase.execute({ email: dto.email, password: dto.password });
    return result;
  }
}
