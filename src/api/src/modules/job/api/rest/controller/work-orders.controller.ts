import {
  Controller,
  Get,
  Post,
  Param,
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
import { CreateWorkOrderDto } from '../presentation/dto/work-order.dto';
import { toWorkOrderResponse } from '../presentation/mapper/work-order.mapper';
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

/**
 * JOB-SRS-001 (issue #41) — tạo Work Order nháp + đọc chi tiết.
 * - `POST /api/v1/work-orders`: scope-first write (ADMIN bypass hoặc member
 *   MANAGER/COORDINATOR), strict `X-Correlation-Id`; replay `requestKey`
 *   trùng → `200` + `idempotentReplay: true`, ngược lại `201`.
 * - `GET /api/v1/work-orders/:id`: bất kỳ ACTIVE member nào của project chứa
 *   WO (kể cả WORKER) + ADMIN bypass; non-member 403 (kể cả id không tồn tại).
 * - Slice này: không gán người thực hiện, không job board (defer #42/#44).
 */
@Controller('api/v1/work-orders')
@UseGuards(JwtAuthGuard)
export class WorkOrdersController {
  constructor(
    private readonly createWorkOrder: CreateWorkOrderUseCase,
    private readonly getWorkOrder: GetWorkOrderUseCase,
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
}
