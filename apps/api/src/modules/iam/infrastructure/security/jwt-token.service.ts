import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { TokenPort, TokenPayload } from '../../application/port/token.port';

const DEFAULT_TTL_SECONDS = 3600;

@Injectable()
export class JwtTokenService implements TokenPort {
  sign(payload: TokenPayload): Promise<{ token: string; expiresAt: Date }> {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is required');
    const expiresIn = Number(process.env.JWT_TTL_SECONDS ?? DEFAULT_TTL_SECONDS);
    const token = jwt.sign(payload, secret, { expiresIn });
    return Promise.resolve({ token, expiresAt: new Date(Date.now() + expiresIn * 1000) });
  }
}
