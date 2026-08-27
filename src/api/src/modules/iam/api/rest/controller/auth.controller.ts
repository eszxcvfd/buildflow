import { Controller, Post, Get, Body, Req, UseGuards, UsePipes, ValidationPipe, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { LoginUseCase } from '../../../application/use-case/login.use-case';
import { LogoutUseCase } from '../../../application/use-case/logout.use-case';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { LoginRequestDto } from '../presentation/dto/login.dto';
import { toLoginResponse } from '../presentation/mapper/auth.mapper';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @Post('login')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async login(@Body() dto: LoginRequestDto, @Req() req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const userAgent = (req.headers['user-agent'] as string) || null;

    const result = await this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
      ipAddress: ip ? String(ip).split(',')[0].trim() : undefined,
      userAgent: userAgent ?? undefined,
    });

    return toLoginResponse(result);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  async logout(@Req() req: Request) {
    const auth = req.headers['authorization'] as string | undefined;
    const token = auth ? auth.slice(7) : '';
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const userAgent = (req.headers['user-agent'] as string) || null;

    await this.logoutUseCase.execute({
      token,
      ipAddress: ip ? String(ip).split(',')[0].trim() : undefined,
      userAgent: userAgent ?? undefined,
    });

    return { message: 'Đã đăng xuất' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    // JwtAuthGuard attaches req.user; return minimal profile to verify session validity
    return (req as unknown as { user: unknown }).user;
  }
}
