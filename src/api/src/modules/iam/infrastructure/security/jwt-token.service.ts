import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { TokenPort, TokenPayload } from '../../application/port/token.port';
import { loadConfig } from '../../../../config/configuration';

@Injectable()
export class JwtTokenService implements TokenPort {
  async sign(payload: TokenPayload): Promise<{ token: string; expiresAt: Date }> {
    const config = loadConfig();
    const expiresIn = config.jwtExpiresIn;
    const jti = payload.jti ?? randomUUID();
    const token = jwt.sign(
      {
        sub: payload.sub,
        email: payload.email,
        roles: payload.roles,
        projectIds: payload.projectIds ?? [],
        jti,
      },
      config.jwtSecret,
      { expiresIn: expiresIn as unknown as number } as jwt.SignOptions,
    );

    // Decode to get exp
    const decoded = jwt.decode(token) as { exp?: number; jti?: string } | null;
    let expiresAt: Date;
    if (decoded && typeof decoded.exp === 'number') {
      expiresAt = new Date(decoded.exp * 1000);
    } else {
      // fallback 1h
      expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    }

    return { token, expiresAt };
  }

  async verify(token: string): Promise<TokenPayload> {
    const config = loadConfig();
    const decoded = jwt.verify(token, config.jwtSecret) as unknown as TokenPayload & {
      sub: string;
      jti: string;
      exp: number;
      iat: number;
    };
    return {
      sub: decoded.sub,
      email: decoded.email,
      roles: decoded.roles,
      projectIds: (decoded as unknown as { projectIds?: string[] }).projectIds,
      jti: decoded.jti,
      exp: decoded.exp,
      iat: decoded.iat,
    };
  }
}
