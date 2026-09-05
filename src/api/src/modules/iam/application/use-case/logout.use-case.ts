import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { TOKEN_PORT, TokenPort } from '../port/token.port';
import { TOKEN_REVOCATION_PORT, TokenRevocationPort } from '../port/token-revocation.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import * as jwt from 'jsonwebtoken';

export interface LogoutInput {
  token: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string | null;
}

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(TOKEN_PORT) private readonly tokenPort: TokenPort,
    @Inject(TOKEN_REVOCATION_PORT) private readonly revocation: TokenRevocationPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    let payload: { sub: string; jti?: string; exp?: number };
    try {
      payload = await this.tokenPort.verify(input.token);
    } catch {
      throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');
    }

    const jti = payload.jti;
    if (!jti) {
      throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');
    }

    // Decode without verify to get exp for TTL if verify didn't return exp
    let expiresAt: Date;
    if (payload.exp) {
      expiresAt = new Date(payload.exp * 1000);
    } else {
      const decoded = jwt.decode(input.token) as { exp?: number } | null;
      if (decoded?.exp) {
        expiresAt = new Date(decoded.exp * 1000);
      } else {
        expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      }
    }

    await this.revocation.revoke(jti, expiresAt);

    try {
      await this.audit.log({
        actorUserId: payload.sub,
        action: 'AUTH_LOGOUT',
        entityType: 'USER',
        entityId: payload.sub,
        afterData: { jti, expiresAt: expiresAt.toISOString() },
        result: 'SUCCESS',
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId ?? null,
      });
    } catch (_e) { void _e; }

  }
}
