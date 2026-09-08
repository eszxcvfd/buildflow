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
  HttpCode,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { requireRoles } from '../../../../iam/api/rest/guard/roles.guard';
import { CreateWorkTypeUseCase } from '../../../application/use-case/create-work-type.use-case';
import { SearchWorkTypesUseCase } from '../../../application/use-case/search-work-types.use-case';
import { GetWorkTypeUseCase } from '../../../application/use-case/get-work-type.use-case';
import { UpdateWorkTypeUseCase } from '../../../application/use-case/update-work-type.use-case';
import { ChangeWorkTypeStatusUseCase } from '../../../application/use-case/change-work-type-status.use-case';
import { ListActiveWorkTypesUseCase } from '../../../application/use-case/list-active-work-types.use-case';
import {
  ChangeWorkTypeStatusDto,
  CreateWorkTypeDto,
  UpdateWorkTypeDto,
} from '../presentation/dto/work-type.dto';
import { toWorkTypeListResponse, toWorkTypeResponse } from '../presentation/mapper/work-type.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';

/**
 * PRJ-SRS-004 (issue #35) — catalog loại công việc.
 * Tác nhân Quản trị viên/Điều phối viên → read + write mở cho
 * `ADMIN` + `PROJECT_MANAGER` (JWT roles server-derived, không bypass).
 * Chưa xác thực → `401` (JwtAuthGuard); sai role → `403`.
 */
const WORK_TYPE_ROLES = ['ADMIN', 'PROJECT_MANAGER'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // Strict X-Correlation-Id (precedent trades/projects): header sai UUID → 400
  // actionable thay vì 500 audit-insert (audit_logs.correlation_id uuid-typed).
  if (correlationId && !UUID_RE.test(correlationId)) {
    throw new BadRequestException(
      'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
    );
  }
}

function filterError(field: string, message: string): never {
  throw new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

@Controller('api/v1/work-types')
@UseGuards(JwtAuthGuard)
export class WorkTypesController {
  constructor(
    private readonly createWorkType: CreateWorkTypeUseCase,
    private readonly searchWorkTypes: SearchWorkTypesUseCase,
    private readonly getWorkType: GetWorkTypeUseCase,
    private readonly updateWorkType: UpdateWorkTypeUseCase,
    private readonly changeWorkTypeStatus: ChangeWorkTypeStatusUseCase,
    private readonly listActiveWorkTypes: ListActiveWorkTypesUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateWorkTypeDto, @Req() req: Request) {
    const actor = requireRoles(
      req as unknown as { user?: { roles?: string[] } },
      WORK_TYPE_ROLES,
    ) as unknown as TokenPayload;
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity } = await this.createWorkType.execute({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      group: dto.group ?? null,
      requiredTradeId: dto.requiredTradeId ?? null,
      requiredFields: dto.requiredFields ?? [],
      defaultDurationMinutes: dto.defaultDurationMinutes ?? null,
      defaultPriority: (dto.defaultPriority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | undefined) ?? undefined,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toWorkTypeResponse(entity);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async search(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('group') group?: string,
    @Query('tradeId') tradeId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, WORK_TYPE_ROLES);
    if (status && !['ACTIVE', 'INACTIVE', 'ALL'].includes(status)) {
      filterError('status', 'Trạng thái không hợp lệ');
    }
    if (tradeId && !UUID_RE.test(tradeId)) {
      filterError('tradeId', 'Ngành nghề không hợp lệ');
    }
    let parsedLimit: number | undefined;
    let parsedOffset: number | undefined;
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
    const { entities, total } = await this.searchWorkTypes.execute({
      status: (status || undefined) as 'ACTIVE' | 'INACTIVE' | 'ALL' | undefined,
      group: group || undefined,
      tradeId: tradeId || undefined,
      search: search || undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return { data: toWorkTypeListResponse(entities), total, limit: parsedLimit ?? 20, offset: parsedOffset ?? 0 };
  }

  /**
   * Picker cho JOB (Work Order mới): chỉ loại còn hoạt động.
   * Khai báo trước `GET :id` để `/active` không bị nuốt bởi param route.
   */
  @Get('active')
  @Header('Cache-Control', 'no-store')
  async listActive(@Req() req: Request) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, WORK_TYPE_ROLES);
    const { entities } = await this.listActiveWorkTypes.execute();
    return { data: toWorkTypeListResponse(entities), total: entities.length };
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async getOne(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Req() req: Request) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, WORK_TYPE_ROLES);
    const { entity, usage } = await this.getWorkType.execute({ workTypeId: id });
    return toWorkTypeResponse(entity, { usage });
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdateWorkTypeDto,
    @Req() req: Request,
  ) {
    const actor = requireRoles(
      req as unknown as { user?: { roles?: string[] } },
      WORK_TYPE_ROLES,
    ) as unknown as TokenPayload;
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, versionChanged, warning } = await this.updateWorkType.execute({
      workTypeId: id,
      code: dto.code,
      name: dto.name,
      description: dto.description,
      group: dto.group,
      requiredTradeId: dto.requiredTradeId,
      requiredFields: dto.requiredFields as unknown,
      defaultDurationMinutes: dto.defaultDurationMinutes,
      defaultPriority: dto.defaultPriority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | undefined,
      expectedConfigVersion: dto.expectedConfigVersion,
      reason: dto.reason ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return { ...toWorkTypeResponse(entity, { warning }), versionChanged };
  }

  @Post(':id/status')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async changeStatus(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: ChangeWorkTypeStatusDto,
    @Req() req: Request,
  ) {
    const actor = requireRoles(
      req as unknown as { user?: { roles?: string[] } },
      WORK_TYPE_ROLES,
    ) as unknown as TokenPayload;
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, alreadyInState, warning } = await this.changeWorkTypeStatus.execute({
      workTypeId: id,
      action: dto.action,
      reason: dto.reason ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return { ...toWorkTypeResponse(entity, { warning }), alreadyInState };
  }
}
