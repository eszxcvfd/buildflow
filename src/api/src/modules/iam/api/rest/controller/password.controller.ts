import { BadRequestException, Body, Controller, HttpCode, Patch, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { TokenPayload } from '../../../application/port/token.port';
import { ChangePasswordUseCase } from '../../../application/use-case/change-password.use-case';
import { RequestPasswordResetUseCase } from '../../../application/use-case/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../../application/use-case/reset-password.use-case';
import { ChangePasswordDto, RequestPasswordResetDto, ResetPasswordDto } from '../presentation/dto/password.dto';

// Plain IPv4: 4 dot-separated decimal octets 0-255 (no leading-empty groups).
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
// Simplified IPv6: hex groups separated by ':', optional '::' compression (max one),
// optional trailing IPv4-mapped part. Good enough to guard the inet column from garbage.
const IPV6_RE = /^(([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|([0-9A-Fa-f]{1,4}:){1,7}:(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6})?|:(?::[0-9A-Fa-f]{1,4}){1,7}|::)$/;

/**
 * Extract the first client IP from an X-Forwarded-For header (or a bare IP).
 * Returns null when nothing valid is found — callers must not push unvalidated
 * garbage into an inet column.
 */
export function parseClientIp(xff: string | null | undefined): string | null {
  if (!xff) return null;
  const first = String(xff).split(',')[0]?.trim();
  if (!first) return null;
  // Strip optional port for plain IPv4 ("1.2.3.4:5678") and brackets for IPv6 ("[::1]:80")
  let candidate = first;
  const bracket = /^\[(.+)\](?::\d+)?$/.exec(candidate);
  if (bracket) candidate = bracket[1];
  if (IPV4_RE.test(candidate) || IPV6_RE.test(candidate)) return candidate;
  const barePort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(candidate);
  if (barePort && IPV4_RE.test(barePort[1])) return barePort[1];
  return null;
}

@Controller()
export class PasswordController {
  constructor(
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly requestResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  private clientMeta(req: Request) {
    const xff = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const userAgent = (req.headers['user-agent'] as string) || null;
    return {
      ipAddress: parseClientIp(xff),
      userAgent: userAgent ?? null,
    };
  }

  private assertConfirmMatch(confirmPassword: string, newPassword: string): void {
    if (confirmPassword !== newPassword) {
      throw new BadRequestException({
        message: 'Xác nhận mật khẩu không khớp',
        errors: { confirmPassword: 'Xác nhận mật khẩu không khớp với mật khẩu mới' },
      });
    }
  }

  @Post('api/v1/auth/password-reset/request')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async requestReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    const meta = this.clientMeta(req);
    const out = await this.requestResetUseCase.execute({ email: dto.email, ...meta });
    // Anti-enumeration contract: the response is ALWAYS the generic message.
    // No resetUrl/reset link may ever be returned here (any environment).
    return { message: out.message };
  }

  @Post('api/v1/auth/password-reset/confirm')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async confirmReset(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    this.assertConfirmMatch(dto.confirmPassword, dto.newPassword);
    const meta = this.clientMeta(req);
    await this.resetPasswordUseCase.execute({ token: dto.token, newPassword: dto.newPassword, ...meta });
    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.', reauthRequired: true };
  }

  @Patch('api/v1/me/password')
  @UseGuards(JwtAuthGuard)
  // whitelist (strip) — KHÔNG forbidNonWhitelisted ở endpoint này: trường lạ (vd. userId)
  // do client tự gắn vào body phải bị loại bỏ, request vẫn đổi mật khẩu cho subject của JWT
  // (chống mass-assignment, IAM-SRS-007).
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request) {
    this.assertConfirmMatch(dto.confirmPassword, dto.newPassword);
    const user = (req as unknown as { user: TokenPayload }).user;
    const meta = this.clientMeta(req);
    const out = await this.changePasswordUseCase.execute({
      userId: user.sub, currentPassword: dto.currentPassword, newPassword: dto.newPassword, ...meta,
    });
    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.', reauthRequired: out.reauthRequired };
  }
}
