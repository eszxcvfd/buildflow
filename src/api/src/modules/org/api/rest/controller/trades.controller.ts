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
import { CreateTradeUseCase } from '../../../application/use-case/create-trade.use-case';
import { UpdateTradeUseCase } from '../../../application/use-case/update-trade.use-case';
import { ChangeTradeStatusUseCase } from '../../../application/use-case/change-trade-status.use-case';
import { GetTradeUseCase } from '../../../application/use-case/get-trade.use-case';
import { SearchTradesUseCase } from '../../../application/use-case/search-trades.use-case';
import { CreateTradeDto, UpdateTradeDto, ChangeTradeStatusDto } from '../presentation/dto/trade.dto';
import { toTradeResponse, toTradeListResponse } from '../presentation/mapper/trade.mapper';
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

@Controller('api/v1/trades')
@UseGuards(JwtAuthGuard)
export class TradesController {
  constructor(
    private readonly createTrade: CreateTradeUseCase,
    private readonly updateTrade: UpdateTradeUseCase,
    private readonly changeTradeStatus: ChangeTradeStatusUseCase,
    private readonly getTrade: GetTradeUseCase,
    private readonly searchTrades: SearchTradesUseCase,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateTradeDto, @Req() req: Request) {
    const actor = assertAdmin(req);
    const meta = getMeta(req);
    // Admin/management endpoint: strict X-Correlation-Id policy — a non-UUID header
    // must be rejected as 400 with an actionable message instead of surfacing as a
    // 500 audit-insert failure (audit_logs.correlation_id is uuid-typed; same
    // pattern as workers/contractors controllers).
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity } = await this.createTrade.execute({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      status: dto.status ?? 'ACTIVE',
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toTradeResponse(entity);
  }

  @Get()
  async search(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    assertAdmin(req);
    if (status && !['ACTIVE', 'INACTIVE', 'ALL'].includes(status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }
    let parsedLimit: number | undefined;
    let parsedOffset: number | undefined;
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
    const { entities, total } = await this.searchTrades.execute({
      status: (status || undefined) as 'ACTIVE' | 'INACTIVE' | 'ALL' | undefined,
      search: search || undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return { data: toTradeListResponse(entities), total, limit: parsedLimit ?? 20, offset: parsedOffset ?? 0 };
  }

  @Get(':id')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertAdmin(req);
    const { entity } = await this.getTrade.execute({ tradeId: id });
    return toTradeResponse(entity);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateTradeDto, @Req() req: Request) {
    const actor = assertAdmin(req);
    const meta = getMeta(req);
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity } = await this.updateTrade.execute({
      tradeId: id,
      code: dto.code,
      name: dto.name,
      description: dto.description,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toTradeResponse(entity);
  }

  @Patch(':id/status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async changeStatus(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ChangeTradeStatusDto, @Req() req: Request) {
    const actor = assertAdmin(req);
    const meta = getMeta(req);
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity, warning } = await this.changeTradeStatus.execute({
      tradeId: id,
      status: dto.status,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toTradeResponse(entity, warning);
  }
}