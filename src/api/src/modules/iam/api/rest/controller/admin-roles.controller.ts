import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { AssignRolesDto } from '../presentation/dto/role-assignment.dto';
import { GetUserRolesUseCase } from '../../../application/use-case/get-user-roles.use-case';
import { AssignRolesUseCase } from '../../../application/use-case/assign-roles.use-case';
import { TokenPayload } from '../../../application/port/token.port';

function assertAdmin(req: Request): TokenPayload {
  const user = (req as unknown as { user: TokenPayload }).user;
  if (!user) {
    throw new ForbiddenException('Không có quyền truy cập');
  }
  const roles = user.roles ?? [];
  if (!roles.includes('ADMIN')) {
    throw new ForbiddenException('Không có quyền truy cập');
  }
  return user;
}

function getRequestMeta(req: Request): { ip: string | null; userAgent: string | null; correlationId: string | null } {
  const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
  const userAgent = (req.headers['user-agent'] as string) || null;
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    null;
  return {
    ip: ip ? String(ip).split(',')[0].trim() : null,
    userAgent: userAgent ?? null,
    correlationId: correlationId ? String(correlationId).trim() : null,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('api/v1/admin/users')
@UseGuards(JwtAuthGuard)
export class AdminRolesController {
  constructor(
    private readonly getUserRolesUseCase: GetUserRolesUseCase,
    private readonly assignRolesUseCase: AssignRolesUseCase,
  ) {}

  @Get(':id/roles')
  async getRoles(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    const actor = assertAdmin(req);
    const result = await this.getUserRolesUseCase.execute({
      targetUserId: id,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
    });
    return {
      userId: result.targetUserId,
      roles: result.roles,
      effectivePolicy: result.effectivePolicy,
      // IAM-SRS-005 note: quyền hiện tại từ DB, quyền mới (nếu gán) có hiệu lực từ lần truy cập tiếp theo
    };
  }

  @Put(':id/roles')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async assign(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AssignRolesDto,
    @Req() req: Request,
  ) {
    const actor = assertAdmin(req);
    const meta = getRequestMeta(req);
    // correlation_id in audit_logs is uuid-typed: a non-UUID header must be rejected as 400
    // with an actionable message instead of surfacing as a 500 audit-insert failure.
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const result = await this.assignRolesUseCase.execute({
      targetUserId: id,
      roleIds: dto.roleIds,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      correlationId: meta.correlationId,
      reason: dto.reason ?? null,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return {
      userId: result.targetUserId,
      roles: result.roles,
      beforeRoleIds: result.beforeRoleIds,
      afterRoleIds: result.afterRoleIds,
      effectivePolicy: result.effectivePolicy,
    };
  }
}
