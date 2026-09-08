import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Res,
  Header,
  HttpCode,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { CreateWorkOrderUseCase } from '../../../application/use-case/create-work-order.use-case';
import { GetWorkOrderUseCase } from '../../../application/use-case/get-work-order.use-case';
import { SearchWorkOrdersUseCase, SearchWorkOrdersStatus } from '../../../application/use-case/search-work-orders.use-case';
import { UpdateWorkOrderUseCase } from '../../../application/use-case/update-work-order.use-case';
import { CreateWorkOrderDto, UpdateWorkOrderDto } from '../presentation/dto/work-order.dto';
import { toWorkOrderListResponse, toWorkOrderResponse } from '../presentation/mapper/work-order.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';
import { WorkOrderPriority } from '../../../domain/service/work-order.policy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * JOB-SRS-001 (issue #41) — actor server-derived từ JWT (`JwtAuthGuard` đã
 * gắn `req.user`). KHÔNG gate global role ở đây: write/read enforce
 * project-scope trong use case (403 khi ngoài scope). Client không thể giả
 * actor (JWT signed, login cấp).
 */
function workOrderActor(req: Request): TokenPayload {
  const actor = (req as unknown as { user?: TokenPayload }).user;
  if (!actor || !actor.sub) {
    throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');
  }
  return actor;
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
  // Strict X-Correlation-Id (precedent prj writes): header sai UUID → 400
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

const WORK_ORDER_LIST_STATUSES: readonly string[] = [
  'DRAFT',
  'READY',
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'WORK_DONE',
  'CLOSED',
  'CANCELLED',
  'ALL',
];

/**
 * JOB-SRS-001 (issue #41) — tạo Work Order nháp + đọc chi tiết.
 * - `POST /api/v1/work-orders`: scope-first write (ADMIN bypass hoặc member
 *   MANAGER/COORDINATOR), strict `X-Correlation-Id`; replay `requestKey`
 *   trùng → `200` + `idempotentReplay: true`, ngược lại `201`.
 * - `GET /api/v1/work-orders/:id`: bất kỳ ACTIVE member nào của project chứa
 *   WO (kể cả WORKER) + ADMIN bypass; non-member 403 (kể cả id không tồn tại).
 * - `PATCH /api/v1/work-orders/:id` (JOB-SRS-003 `#43`): write-scope của
 *   project chứa WO (ADMIN bypass hoặc ACTIVE member MANAGER/COORDINATOR;
 *   non-member 403 kể cả id missing, ADMIN missing → 404); state policy +
 *   optimistic lock `expectedVersion` (409 `WORK_ORDER_CONFLICT`); field khóa
 *   → 400 `WORK_ORDER_FIELD_LOCKED`; đổi lịch/skill ở ASSIGNED/IN_PROGRESS
 *   bắt buộc `reason`; terminal chỉ ADMIN + reason ngoại lệ.
 * - Slice này: không gán người thực hiện, không job board (defer #42/#44).
 * - `GET /api/v1/work-orders` (list): mọi user đã đăng nhập; ADMIN = tất cả
 *   (bypass, chỉ debug-log), non-ADMIN = WO của các project mình là ACTIVE
 *   member (`resolveAccessibleProjectIds` → `project_id = ANY(...)`;
 *   membership rỗng → `data []`, không 403; `projectId` ngoài scope → 403
 *   generic). Filter `projectId`/`status`/`search` + `limit`/`offset`.
 *   Khai báo TRƯỚC `GET :id` để `/` không bị nuốt bởi param route.
 */
@Controller('api/v1/work-orders')
@UseGuards(JwtAuthGuard)
export class WorkOrdersController {
  constructor(
    private readonly createWorkOrder: CreateWorkOrderUseCase,
    private readonly getWorkOrder: GetWorkOrderUseCase,
    private readonly searchWorkOrders: SearchWorkOrdersUseCase,
    private readonly updateWorkOrder: UpdateWorkOrderUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(
    @Body() dto: CreateWorkOrderDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const actor = workOrderActor(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, workTypeName, idempotentReplay } = await this.createWorkOrder.execute({
      projectId: dto.projectId,
      areaId: dto.areaId ?? null,
      workTypeId: dto.workTypeId,
      requiredTradeId: dto.requiredTradeId ?? null,
      code: dto.code ?? null,
      title: dto.title,
      description: dto.description ?? null,
      instructions: dto.instructions ?? null,
      priority: (dto.priority as WorkOrderPriority | undefined) ?? undefined,
      plannedStartAt: dto.plannedStartAt ?? null,
      plannedEndAt: dto.plannedEndAt ?? null,
      plannedHeadcount: dto.plannedHeadcount ?? null,
      requestKey: dto.requestKey ?? null,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    if (idempotentReplay) res.status(200);
    return { ...toWorkOrderResponse(entity, { workTypeName }), ...(idempotentReplay ? { idempotentReplay: true } : {}) };
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async search(
    @Req() req: Request,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const actor = workOrderActor(req);
    const meta = getMeta(req);
    if (projectId && !UUID_RE.test(projectId)) {
      filterError('projectId', 'Dự án không hợp lệ');
    }
    if (status && !WORK_ORDER_LIST_STATUSES.includes(status)) {
      filterError('status', 'Trạng thái không hợp lệ');
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
    const { entities, total, workTypeRefs, projectRefs } = await this.searchWorkOrders.execute({
      projectId: projectId || undefined,
      status: (status || undefined) as SearchWorkOrdersStatus | undefined,
      search: search || undefined,
      limit: parsedLimit,
      offset: parsedOffset,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return {
      data: toWorkOrderListResponse(entities, { workTypeRefs, projectRefs }),
      total,
      limit: parsedLimit ?? 20,
      offset: parsedOffset ?? 0,
    };
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async getOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Req() req: Request,
  ) {
    const actor = workOrderActor(req);
    const meta = getMeta(req);
    const { entity, workTypeName } = await this.getWorkOrder.execute({
      workOrderId: id,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toWorkOrderResponse(entity, { workTypeName });
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdateWorkOrderDto,
    @Req() req: Request,
  ) {
    const actor = workOrderActor(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, workTypeName } = await this.updateWorkOrder.execute({
      workOrderId: id,
      description: dto.description,
      instructions: dto.instructions,
      priority: dto.priority ?? undefined,
      dueAt: dto.dueAt,
      plannedStartAt: dto.plannedStartAt,
      plannedEndAt: dto.plannedEndAt,
      requiredTradeId: dto.requiredTradeId,
      workTypeId: dto.workTypeId,
      expectedVersion: dto.expectedVersion,
      reason: dto.reason,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toWorkOrderResponse(entity, { workTypeName });
  }
}
