import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { createHash } from 'crypto';
import { PrismaService } from '../../../../prisma/prisma.service';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  status: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  rawToken?: string;
}

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        type: 'https://api.buildflow.invalid/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        code: 'UNAUTHORIZED',
        detail: 'Authentication required',
      });
    }

    const rawToken = authHeader.slice('Bearer '.length).trim();
    if (!rawToken) {
      throw new UnauthorizedException({
        type: 'https://api.buildflow.invalid/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        code: 'UNAUTHORIZED',
        detail: 'Authentication required',
      });
    }

    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || !session.user) {
      throw new UnauthorizedException({
        type: 'https://api.buildflow.invalid/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        code: 'UNAUTHORIZED',
        detail: 'Invalid or expired token',
      });
    }

    // Expiry check
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      // Optional: delete expired session
      await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new UnauthorizedException({
        type: 'https://api.buildflow.invalid/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        code: 'UNAUTHORIZED',
        detail: 'Invalid or expired token',
      });
    }

    // Locked/disabled user should also be rejected even if token exists
    if (session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        type: 'https://api.buildflow.invalid/problems/unauthorized',
        title: 'Unauthorized',
        status: 401,
        code: 'UNAUTHORIZED',
        detail: 'Invalid or expired token',
      });
    }

    request.user = {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
      status: session.user.status,
    };
    request.rawToken = rawToken;

    return true;
  }
}
