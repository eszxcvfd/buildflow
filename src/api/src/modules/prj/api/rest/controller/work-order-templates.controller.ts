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
import { CreateWorkOrderTemplateUseCase } from '../../../application/use-case/create-work-order-template.use-case';
import { SearchWorkOrderTemplatesUseCase } from '../../../application/use-case/search-work-order-templates.use-case';
import { GetWorkOrderTemplateUseCase } from '../../../application/use-case/get-work-order-template.use-case';
import { UpdateWorkOrderTemplateUseCase } from '../../../application/use-case/update-work-order-template.use-case';
import { ChangeWorkOrderTemplateStatusUseCase } from '../../../application/use-case/change-work-order-template-status.use-case';
import { ListActiveWorkOrderTemplatesUseCase } from '../../../application/use-case/list-active-work-order-templates.use-case';
import {
  ChangeWorkOrderTemplateStatusDto,
  CreateWorkOrderTemplateDto,
  UpdateWorkOrderTemplateDto,
} from '../presentation/dto/work-order-template.dto';
import { toWorkOrderTemplateListResponse, toWorkOrderTemplateResponse } from '../presentation/mapper/work-order-template.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';

/**
 * PRJ-SRS-008 (issue #39) — catalog mẫu công việc.
 * Tác nhân Điều phối viên + Quản trị viên → read + write mở cho
 * `ADMIN` + `PROJECT_MANAGER` (JWT roles server-derived, không bypass;
 * mirror work-types #35 — catalog toàn cục, không project-scope).
 * Chưa xác thực → `401` (JwtAuthGuard); sai role → `403`.
 * KHÔNG có endpoint `/apply` ở slice này (JOB chưa tồn tại — prefill sẽ dùng
 * `GET /active` + `GET /:id` ở JOB-SRS-001; decision xem ENDPOINTS.md §16).
 */
const WO_TEMPLATE_ROLES = ['ADMIN', 'PROJECT_MANAGER'];

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
  // Strict X-Correlation-Id (precedent trades/projects/work-types): header sai
  // UUID → 400 actionable thay vì 500 audit-insert (audit_logs.correlation_id uuid-typed).
  if (correlationId && !UUID_RE.test(correlationId)) {
    throw new BadRequestException(
      'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
    );
  }
}

function filterError(field: string, message: string): never {
  throw new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

@Controller('api/v1/work-order-templates')
@UseGuards(JwtAuthGuard)
export class WorkOrderTemplatesController {
  constructor(
    private readonly createTemplate: CreateWorkOrderTemplateUseCase,
    private readonly searchTemplates: SearchWorkOrderTemplatesUseCase,
    private readonly getTemplate: GetWorkOrderTemplateUseCase,
    private readonly updateTemplate: UpdateWorkOrderTemplateUseCase,
    private readonly changeTemplateStatus: ChangeWorkOrderTemplateStatusUseCase,
    private readonly listActiveTemplates: ListActiveWorkOrderTemplatesUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateWorkOrderTemplateDto, @Req() req: Request) {
    const actor = requireRoles(
      req as unknown as { user?: { roles?: string[] } },
      WO_TEMPLATE_ROLES,
    ) as unknown as TokenPayload;
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity } = await this.createTemplate.execute({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      workTypeId: dto.workTypeId ?? null,
      requiredTradeId: dto.requiredTradeId ?? null,
      requiredSkills: dto.requiredSkills ?? [],
      checklistSnapshot: dto.checklistSnapshot as unknown,
      sourceChecklistTemplateId: dto.sourceChecklistTemplateId ?? null,
      defaultDurationMinutes: dto.defaultDurationMinutes ?? null,
      defaultPriority: (dto.defaultPriority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | undefined) ?? undefined,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toWorkOrderTemplateResponse(entity);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async search(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('workTypeId') workTypeId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, WO_TEMPLATE_ROLES);
    if (status && !['DRAFT', 'ACTIVE', 'INACTIVE', 'ALL'].includes(status)) {
      filterError('status', 'Trạng thái không hợp lệ');
    }
    if (workTypeId && !UUID_RE.test(workTypeId)) {
      filterError('workTypeId', 'Loại công việc không hợp lệ');
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
    const { entities, total } = await this.searchTemplates.execute({
      status: (status || undefined) as 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ALL' | undefined,
      workTypeId: workTypeId || undefined,
      search: search || undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return { data: toWorkOrderTemplateListResponse(entities), total, limit: parsedLimit ?? 20, offset: parsedOffset ?? 0 };
  }

  /**
   * Picker cho JOB (Work Order mới): chỉ mẫu ACTIVE.
   * Khai báo trước `GET :id` để `/active` không bị nuốt bởi param route.
   */
  @Get('active')
  @Header('Cache-Control', 'no-store')
  async listActive(@Req() req: Request) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, WO_TEMPLATE_ROLES);
    const { entities } = await this.listActiveTemplates.execute();
    return { data: toWorkOrderTemplateListResponse(entities), total: entities.length };
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async getOne(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Req() req: Request) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, WO_TEMPLATE_ROLES);
    const { entity } = await this.getTemplate.execute({ templateId: id });
    return toWorkOrderTemplateResponse(entity);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdateWorkOrderTemplateDto,
    @Req() req: Request,
  ) {
    const actor = requireRoles(
      req as unknown as { user?: { roles?: string[] } },
      WO_TEMPLATE_ROLES,
    ) as unknown as TokenPayload;
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, versionChanged } = await this.updateTemplate.execute({
      templateId: id,
      code: dto.code,
      name: dto.name,
      description: dto.description,
      workTypeId: dto.workTypeId,
      requiredTradeId: dto.requiredTradeId,
      requiredSkills: dto.requiredSkills as unknown,
      checklistSnapshot: dto.checklistSnapshot as unknown,
      sourceChecklistTemplateId: dto.sourceChecklistTemplateId,
      defaultDurationMinutes: dto.defaultDurationMinutes,
      defaultPriority: dto.defaultPriority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | undefined,
      expectedVersion: dto.expectedVersion,
      reason: dto.reason ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return { ...toWorkOrderTemplateResponse(entity), versionChanged };
  }

  @Post(':id/status')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async changeStatus(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: ChangeWorkOrderTemplateStatusDto,
    @Req() req: Request,
  ) {
    const actor = requireRoles(
      req as unknown as { user?: { roles?: string[] } },
      WO_TEMPLATE_ROLES,
    ) as unknown as TokenPayload;
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, alreadyInState } = await this.changeTemplateStatus.execute({
      templateId: id,
      action: dto.action,
      reason: dto.reason ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return { ...toWorkOrderTemplateResponse(entity), alreadyInState };
  }
}
