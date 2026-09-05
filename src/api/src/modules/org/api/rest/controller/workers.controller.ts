import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { CreateWorkerUseCase } from '../../../application/use-case/create-worker.use-case';
import { UpdateWorkerUseCase } from '../../../application/use-case/update-worker.use-case';
import { GetWorkerUseCase } from '../../../application/use-case/get-worker.use-case';
import { SearchWorkersUseCase } from '../../../application/use-case/search-workers.use-case';
import { CreateWorkerDto, UpdateWorkerDto } from '../presentation/dto/worker.dto';
import { toWorkerResponse, toWorkerListResponse } from '../presentation/mapper/worker.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';

function assertAdmin(req: Request): TokenPayload {
  const user = (req as unknown as { user: TokenPayload }).user;
  if (!user) throw new ForbiddenException('Không có quyền truy cập');
  if (!user.roles?.includes('ADMIN')) throw new ForbiddenException('Không có quyền truy cập');
  return user;
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
  async search(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('tradeId') tradeId?: string,
    @Query('skillLevel') skillLevel?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    assertAdmin(req);
    if (status && !['ACTIVE', 'INACTIVE', 'LOCKED'].includes(status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }
    let parsedLimit: number | undefined;
    let parsedOffset: number | undefined;
    let parsedSkill: number | undefined;
    if (limit !== undefined && limit !== '') {
      parsedLimit = Number(limit);
      if (!Number.isInteger(parsedLimit) || Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        throw new BadRequestException('Limit không hợp lệ (1-100)');
      }
    }
    if (offset !== undefined && offset !== '') {
      parsedOffset = Number(offset);
      if (!Number.isInteger(parsedOffset) || Number.isNaN(parsedOffset) || parsedOffset < 0) {
        throw new BadRequestException('Offset không hợp lệ (phải >= 0)');
      }
    }
    if (tradeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tradeId)) {
      throw new BadRequestException('Trade ID không hợp lệ');
    }
    if (skillLevel !== undefined && skillLevel !== '') {
      parsedSkill = Number(skillLevel);
      if (!Number.isInteger(parsedSkill) || parsedSkill < 1 || parsedSkill > 5) throw new BadRequestException('Skill level phải là 1-5');
    }
    const { entities, total } = await this.searchWorkers.execute({
      status: status || undefined,
      search: search || undefined,
      tradeId: tradeId || undefined,
      skillLevel: parsedSkill,
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return { data: toWorkerListResponse(entities), total, limit: parsedLimit ?? 20, offset: parsedOffset ?? 0 };
  }

  @Get(':id')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertAdmin(req);
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
}
