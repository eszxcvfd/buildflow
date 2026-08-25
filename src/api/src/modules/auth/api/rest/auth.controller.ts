import { Body, Controller, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LoginDto, LoginResponseDto } from '../dto/login.dto';
import { LoginUseCase } from '../../application/use-case/login.use-case';
import { LogoutUseCase } from '../../application/use-case/logout.use-case';
import { BearerAuthGuard } from '../guard/bearer-auth.guard';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

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

  @Post('logout')
  @UseGuards(BearerAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 204, description: 'Logged out, session revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid or missing token' })
  async logout(@Headers('authorization') authHeader: string): Promise<void> {
    const rawToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
    if (!rawToken) {
      // Guard should have already rejected missing token, but keep defensive
      return;
    }
    await this.logoutUseCase.execute(rawToken);
  }
}
