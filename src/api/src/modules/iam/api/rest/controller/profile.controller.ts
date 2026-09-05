import { Body, Controller, Get, Patch, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { GetProfileUseCase } from '../../../application/use-case/get-profile.use-case';
import { UpdateProfileUseCase } from '../../../application/use-case/update-profile.use-case';
import { UpdateProfileDto } from '../presentation/dto/profile.dto';
import { toProfileResponse } from '../presentation/mapper/profile.mapper';
import { TokenPayload } from '../../../application/port/token.port';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('api/v1/me')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly getProfile: GetProfileUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
  ) {}

  @Get('profile')
  async getProfileHandler(@Req() req: Request) {
    const user = (req as unknown as { user: TokenPayload }).user;
    const { entity } = await this.getProfile.execute({ userId: user.sub });
    return toProfileResponse(entity);
  }

  @Patch('profile')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async updateProfileHandler(@Body() dto: UpdateProfileDto, @Req() req: Request) {
    const user = (req as unknown as { user: TokenPayload }).user;
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const userAgent = (req.headers['user-agent'] as string) || null;
    // Authenticated self-service policy: lenient like login/logout — an absent or
    // malformed X-Correlation-Id must NEVER block a profile update, it just yields
    // an audit row without correlation (no dedup).
    const rawCorrelationId = (req.headers['x-correlation-id'] as string | undefined) ?? null;
    const correlationId = rawCorrelationId ? String(rawCorrelationId).trim() : null;
    const validCorrelationId = correlationId && UUID_RE.test(correlationId) ? correlationId : undefined;

    const { entity } = await this.updateProfile.execute({
      userId: user.sub,
      fullName: dto.fullName,
      phone: dto.phone,
      avatarUrl: dto.avatarUrl,
      ipAddress: ip ? String(ip).split(',')[0].trim() : null,
      userAgent: userAgent ?? null,
      correlationId: validCorrelationId,
    });

    return toProfileResponse(entity);
  }
}
