import { Controller, Post, Body, Req, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { LoginUseCase } from '../../../application/use-case/login.use-case';
import { LoginRequestDto } from '../presentation/dto/login.dto';
import { toLoginResponse } from '../presentation/mapper/auth.mapper';

@Controller('auth')
export class AuthController {
  constructor(private readonly loginUseCase: LoginUseCase) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginRequestDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : (req.ip ?? undefined);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined;

    const result = await this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
      ipAddress: ip || undefined,
      userAgent,
    });
    return toLoginResponse(result);
  }
}
