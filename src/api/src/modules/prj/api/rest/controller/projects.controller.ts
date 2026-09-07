import {
  Controller,
  Post,
  Patch,
  Param,
  Body,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { requireRoles } from '../../../../iam/api/rest/guard/roles.guard';
import { CreateProjectUseCase } from '../../../application/use-case/create-project.use-case';
import { UpdateProjectUseCase } from '../../../application/use-case/update-project.use-case';
import { CreateProjectDto, UpdateProjectDto } from '../presentation/dto/project.dto';
import { toProjectProfileResponse } from '../presentation/mapper/project.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';

/**
 * PRJ-SRS-001 (issue #32) — write slice dự án.
 * Chỉ sở hữu `POST /api/v1/projects` và `PATCH /api/v1/projects/:id`;
 * reads (`GET`, `GET :id`) ở lại iam `ProjectsController` (scope-integrated).
 * Write roles = ADMIN + PROJECT_MANAGER (P2); project-scope write checks
 * chi tiết defer sang #37 (PRJ-SRS-006).
 */
const PROJECT_WRITE_ROLES = ['ADMIN', 'PROJECT_MANAGER'];

function assertProjectWriteAccess(req: Request): TokenPayload {
  return requireRoles(
    req as unknown as { user?: { roles?: string[] } },
    PROJECT_WRITE_ROLES,
  ) as unknown as TokenPayload;
}

function getMeta(req: Request): { ip: string | null; userAgent: string | null; correlationId: string | null } {
  const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
  const userAgent = (req.headers['user-agent'] as string) || null;
  const correlationId = (req.headers['x-correlation-id'] as string) || null;
  return {
    ip: ip ? String(ip).split(',')[0].trim() : null,
    userAgent: userAgent ?? null,
    correlationId: correlationId ? String(correlationId).trim() : null,
  };
}

function assertStrictCorrelationId(correlationId: string | null): void {
  // Strict X-Correlation-Id (P6, IAM-SRS-008): header sai UUID → 400
  // actionable thay vì 500 audit-insert (audit_logs.correlation_id uuid-typed).
  if (correlationId && !UUID_RE.test(correlationId)) {
    throw new BadRequestException(
      'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
    );
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('api/v1/projects')
@UseGuards(JwtAuthGuard)
export class PrjProjectsController {
  constructor(
    private readonly createProject: CreateProjectUseCase,
    private readonly updateProject: UpdateProjectUseCase,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateProjectDto, @Req() req: Request) {
    const actor = assertProjectWriteAccess(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, managerName } = await this.createProject.execute({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      address: dto.address,
      timezone: dto.timezone ?? null,
      plannedStartDate: dto.plannedStartDate,
      plannedEndDate: dto.plannedEndDate,
      managerId: dto.managerId,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toProjectProfileResponse(entity, managerName, actor.sub);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: Request,
  ) {
    const actor = assertProjectWriteAccess(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, managerName } = await this.updateProject.execute({
      projectId: id,
      name: dto.name ?? undefined,
      description: dto.description,
      address: dto.address ?? undefined,
      timezone: dto.timezone ?? undefined,
      plannedStartDate: dto.plannedStartDate ?? undefined,
      plannedEndDate: dto.plannedEndDate ?? undefined,
      managerId: dto.managerId ?? undefined,
      code: dto.code ?? undefined,
      status: dto.status ?? undefined,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toProjectProfileResponse(entity, managerName, actor.sub);
  }
}
