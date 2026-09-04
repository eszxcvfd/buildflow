import { BadRequestException, Body, Controller, HttpCode, Patch, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { TokenPayload } from '../../../application/port/token.port';
import { ChangePasswordUseCase } from '../../../application/use-case/change-password.use-case';
import { RequestPasswordResetUseCase } from '../../../application/use-case/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../../application/use-case/reset-password.use-case';
import { ChangePasswordDto, RequestPasswordResetDto, ResetPasswordDto } from '../presentation/dto/password.dto';

@Controller()
export class PasswordController {
  constructor(
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly requestResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  private clientMeta(req: Request) {
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const userAgent = (req.headers['user-agent'] as string) || null;
    return {
      ipAddress: ip ? String(ip).split(',')[0].trim() : null,
      userAgent: userAgent ?? null,
    };
  }

  @Post('api/v1/auth/password-reset/request')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async requestReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    const meta = this.clientMeta(req);
    const out = await this.requestResetUseCase.execute({ email: dto.email, ...meta });
    // Anti-enumeration: always 200 with the same generic message.
    // resetUrl only present in dev/demo mode (no mail provider) — never in production config.
    const body: { message: string; resetUrl?: string } = { message: out.message };
    if (out.resetUrl) body.resetUrl = out.resetUrl;
    return body;
  }

  @Post('api/v1/auth/password-reset/confirm')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async confirmReset(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const meta = this.clientMeta(req);
    await this.resetPasswordUseCase.execute({ token: dto.token, newPassword: dto.newPassword, ...meta });
    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.', reauthRequired: true };
  }

  @Patch('api/v1/me/password')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    const user = (req as unknown as { user: TokenPayload }).user;
    if (dto.confirmPassword !== undefined && dto.confirmPassword !== dto.newPassword) {
      throw new BadRequestException('Xác nhận mật khẩu không khớp');
    }
    const meta = this.clientMeta(req);
    const out = await this.changePasswordUseCase.execute({
      userId: user.sub, currentPassword: dto.currentPassword, newPassword: dto.newPassword, ...meta,
    });
    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.', reauthRequired: out.reauthRequired };
  }
}
