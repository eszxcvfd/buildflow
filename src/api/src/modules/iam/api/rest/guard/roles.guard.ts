import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly requiredRoles: string[],
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, ensure JWT is valid (delegates to JwtAuthGuard)
    const jwtValid = await this.jwtAuthGuard.canActivate(context);
    if (!jwtValid) return false;

    const req = context.switchToHttp().getRequest() as { user?: { roles?: string[] } };
    const roles = req.user?.roles ?? [];
    const hasRole = this.requiredRoles.some((r) => roles.includes(r));
    if (!hasRole) {
      throw new ForbiddenException('Không có quyền truy cập');
    }
    return true;
  }
}

// Factory helper to create ADMIN-only guard provider token if needed
export function createAdminGuard(jwtAuthGuard: JwtAuthGuard): RolesGuard {
  return new RolesGuard(jwtAuthGuard, ['ADMIN']);
}

/**
 * ORG-SRS-005 (issue #28) — shared imperative role check for controllers that
 * keep a local `assertAdmin` for write paths but widen specific READ paths
 * (e.g. resource directory GET search/detail → ADMIN + PROJECT_MANAGER).
 * JWT payload is server-derived (login use case), so a client cannot bypass
 * this check. Throws 403 when no allowed role is present (401 for missing
 * auth is enforced earlier by JwtAuthGuard).
 */
export function requireRoles(req: { user?: { roles?: string[] } }, roles: string[]): { roles?: string[] } {
  const user = req.user;
  if (!user) throw new ForbiddenException('Không có quyền truy cập');
  const userRoles = user.roles ?? [];
  if (!roles.some((r) => userRoles.includes(r))) {
    throw new ForbiddenException('Không có quyền truy cập');
  }
  return user;
}
