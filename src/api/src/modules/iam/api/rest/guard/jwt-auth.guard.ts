import { CanActivate, ExecutionContext, Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { JwtTokenService } from '../../../infrastructure/security/jwt-token.service';
import { TOKEN_REVOCATION_PORT, TokenRevocationPort } from '../../../application/port/token-revocation.port';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtTokenService,
    @Inject(TOKEN_REVOCATION_PORT) private readonly revocation: TokenRevocationPort,
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
      // Attach user context for downstream handlers
      req.user = payload;
      (req as unknown as { token?: string }).token = token;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');
    }
  }
}
