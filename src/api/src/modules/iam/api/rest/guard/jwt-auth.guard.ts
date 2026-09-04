import { CanActivate, ExecutionContext, Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtTokenService } from '../../../infrastructure/security/jwt-token.service';
import { TOKEN_REVOCATION_PORT, TokenRevocationPort } from '../../../application/port/token-revocation.port';
import { USER_REPOSITORY, UserRepositoryPort } from '../../../domain/repository/user-repository.port';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtTokenService,
    @Inject(TOKEN_REVOCATION_PORT) private readonly revocation: TokenRevocationPort,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers['authorization'] as string | undefined;
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');
    }
    const token = auth.slice(7);
    try {
      const payload = await this.jwtService.verify(token);
      // Enforce jti: token without jti cannot be revoked — reject to preserve AC "token sau logout phải bị từ chối"
      if (!payload.jti) {
        throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');
      }
      const revoked = await this.revocation.isRevoked(payload.jti);
      if (revoked) {
        throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');
      }
      // IAM-SRS-007: reject tokens issued before the user's password cutoff
      if (this.revocation.isUserRevokedBefore) {
        const cutoff = await this.getPasswordChangedCutoff(payload.sub);
        if (cutoff && (await this.revocation.isUserRevokedBefore(payload.sub, payload.iat, cutoff))) {
          throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');
        }
      }
      // Attach user context for downstream handlers
      req.user = payload;
      (req as unknown as { token?: string }).token = token;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');
    }
  }

  private cutoffCache = new Map<string, { at: number; value: Date | null }>();
  private async getPasswordChangedCutoff(userId: string): Promise<Date | null> {
    if (!this.userRepo || !this.userRepo.getPasswordChangedAt) return null;
    const cached = this.cutoffCache.get(userId);
    const now = Date.now();
    if (cached && now - cached.at < 30_000) return cached.value;
    const value = await this.userRepo.getPasswordChangedAt!(userId);
    this.cutoffCache.set(userId, { at: now, value });
    return value;
  }
}
