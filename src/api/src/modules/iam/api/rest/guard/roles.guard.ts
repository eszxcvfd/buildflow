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
