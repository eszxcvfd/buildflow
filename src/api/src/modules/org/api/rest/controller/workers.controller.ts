import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Header,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { requireRoles } from '../../../../iam/api/rest/guard/roles.guard';
import { CreateWorkerUseCase } from '../../../application/use-case/create-worker.use-case';
import { UpdateWorkerUseCase } from '../../../application/use-case/update-worker.use-case';
import { GetWorkerUseCase } from '../../../application/use-case/get-worker.use-case';
import { SearchWorkersUseCase } from '../../../application/use-case/search-workers.use-case';
import { StatusTransitionWorkerUseCase } from '../../../application/use-case/status-transition-worker.use-case';
import { GetWorkerOpenWorkUseCase } from '../../../application/use-case/get-worker-open-work.use-case';
import { CreateWorkerDto, UpdateWorkerDto } from '../presentation/dto/worker.dto';
import { ChangeResourceStatusDto } from '../presentation/dto/resource-status.dto';
import { toWorkerResponse, toWorkerListResponse } from '../presentation/mapper/worker.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';

function assertAdmin(req: Request): TokenPayload {
  const user = (req as unknown as { user: TokenPayload }).user;
  if (!user) throw new ForbiddenException('Không có quyền truy cập');
  if (!user.roles?.includes('ADMIN')) throw new ForbiddenException('Không có quyền truy cập');
  return user;
}

/**
 * ORG-SRS-005 (issue #28) — roles allowed on READ paths (search + detail):
 * ADMIN keeps full access, PROJECT_MANAGER gets read-only directory access.
 * All write paths (POST/PATCH/status/open-work) stay ADMIN-only via assertAdmin.
 */
const DIRECTORY_READ_ROLES = ['ADMIN', 'PROJECT_MANAGER'];

/**
 * ORG-SRS-005 (issue #28) — filter validation errors carry a field-level shape
 * `{ statusCode: 400, message, fieldErrors: { <field>: [msg] } }` so the UI can
 * render errors per field. The `message` text is unchanged, so clients that
 * only read `message` keep working.
 */
function filterError(field: string, message: string): never {
  throw new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('api/v1/workers')
@UseGuards(JwtAuthGuard)
export class WorkersController {
  constructor(
    private readonly createWorker: CreateWorkerUseCase,
    private readonly updateWorker: UpdateWorkerUseCase,
    private readonly getWorker: GetWorkerUseCase,
    private readonly searchWorkers: SearchWorkersUseCase,
    private readonly transitionWorkerStatus: StatusTransitionWorkerUseCase,
    private readonly getWorkerOpenWork: GetWorkerOpenWorkUseCase,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateWorkerDto, @Req() req: Request) {
    const actor = assertAdmin(req);
    const meta = getMeta(req);
    // Admin/management endpoint: strict X-Correlation-Id policy — a non-UUID header
    // must be rejected as 400 with an actionable message instead of surfacing as a
    // 500 audit-insert failure (audit_logs.correlation_id is uuid-typed; same
    // pattern as admin-roles/admin user controllers).
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity } = await this.createWorker.execute({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      avatarUrl: null,
      employeeCode: dto.employeeCode ?? null,
      contractorId: dto.contractorId ?? null,
      trades: dto.trades ?? [],
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toWorkerResponse(entity);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async search(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('tradeId') tradeId?: string,
    @Query('skillLevel') skillLevel?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('crewId') crewId?: string,
  ) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, DIRECTORY_READ_ROLES);
    if (status && !['ACTIVE', 'INACTIVE', 'LOCKED'].includes(status)) {
      filterError('status', 'Trạng thái không hợp lệ');
    }
    let parsedLimit: number | undefined;
    let parsedOffset: number | undefined;
    let parsedSkill: number | undefined;
    if (limit !== undefined && limit !== '') {
      parsedLimit = Number(limit);
      if (!Number.isInteger(parsedLimit) || Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        filterError('limit', 'Limit không hợp lệ (1-100)');
      }
    }
    if (offset !== undefined && offset !== '') {
      parsedOffset = Number(offset);
      if (!Number.isInteger(parsedOffset) || Number.isNaN(parsedOffset) || parsedOffset < 0) {
        filterError('offset', 'Offset không hợp lệ (phải >= 0)');
      }
    }
    if (tradeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tradeId)) {
      filterError('tradeId', 'Trade ID không hợp lệ');
    }
    if (skillLevel !== undefined && skillLevel !== '') {
      parsedSkill = Number(skillLevel);
      if (!Number.isInteger(parsedSkill) || parsedSkill < 1 || parsedSkill > 5) filterError('skillLevel', 'Skill level phải là 1-5');
    }
    // ORG-SRS-007 (issue #30, D9): crewId filter — workers có ACTIVE membership trong đội.
    if (crewId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(crewId)) {
      filterError('crewId', 'Crew ID không hợp lệ');
    }
    // ORG-SRS-005 (issue #28) — sort whitelist: name → full_name,
    // createdAt → created_at; default createdAt/desc. Mapping to columns
    // happens in the repository layer (no client string interpolation).
    if (sort !== undefined && sort !== '' && !['name', 'createdAt'].includes(sort)) {
      filterError('sort', 'Sort không hợp lệ (name|createdAt)');
    }
    if (order !== undefined && order !== '' && !['asc', 'desc'].includes(order)) {
      filterError('order', 'Order không hợp lệ (asc|desc)');
    }
    const { entities, total } = await this.searchWorkers.execute({
      status: status || undefined,
      search: search || undefined,
      tradeId: tradeId || undefined,
      skillLevel: parsedSkill,
      crewId: crewId || undefined,
      sort: (sort || undefined) as 'name' | 'createdAt' | undefined,
      order: (order || undefined) as 'asc' | 'desc' | undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return { data: toWorkerListResponse(entities), total, limit: parsedLimit ?? 20, offset: parsedOffset ?? 0 };
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, DIRECTORY_READ_ROLES);
    const { entity } = await this.getWorker.execute({ workerId: id });
    return toWorkerResponse(entity);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateWorkerDto,
    @Req() req: Request,
  ) {
    const actor = assertAdmin(req);
    const meta = getMeta(req);
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity } = await this.updateWorker.execute({
      workerId: id,
      fullName: dto.fullName,
      phone: dto.phone,
      avatarUrl: dto.avatarUrl,
      employeeCode: dto.employeeCode,
      contractorId: dto.contractorId,
      trades: dto.trades,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toWorkerResponse(entity);
  }

  /**
   * ORG-SRS-004 (issue #27) — lifecycle worker. KHÔNG đụng PATCH /admin/users/:id/status
   * cũ (giữ nguyên cho LOCKED/security). Action enum API layer, KHÔNG đổi enum DB.
   */
  @Patch(':id/status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeResourceStatusDto,
    @Req() req: Request,
  ) {
    const actor = assertAdmin(req);
    const meta = getMeta(req);
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity, alreadyInState, warning } = await this.transitionWorkerStatus.execute({
      workerId: id,
      action: dto.action,
      reason: dto.reason ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return {
      ...toWorkerResponse(entity),
      alreadyInState,
      ...(warning !== undefined ? { warning } : {}),
    };
  }

  /**
   * ORG-SRS-004 (issue #27) — pre-check open work (UI confirm dialog), admin-only,
   * chỉ đếm, không chặn, không audit.
   */
  @Get(':id/open-work')
  async openWork(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertAdmin(req);
    return this.getWorkerOpenWork.execute({ workerId: id });
  }
}
