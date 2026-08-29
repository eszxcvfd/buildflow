import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { QueryAuditLogsUseCase } from '../../../application/use-case/query-audit-logs.use-case';
import { toAuditLogListResponse } from '../presentation/mapper/audit-log.mapper';
import { TokenPayload } from '../../../application/port/token.port';

@Controller('api/v1/audit-logs')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly queryAuditLogs: QueryAuditLogsUseCase) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('result') result?: string,
    @Query('correlationId') correlationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = (req as unknown as { user: TokenPayload }).user;

    let parsedLimit: number | undefined;
    let parsedOffset: number | undefined;
    let parsedFrom: Date | undefined;
    let parsedTo: Date | undefined;

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
    if (from) {
      parsedFrom = new Date(from);
      if (isNaN(parsedFrom.getTime())) throw new BadRequestException('From không hợp lệ (ISO date)');
    }
    if (to) {
      parsedTo = new Date(to);
      if (isNaN(parsedTo.getTime())) throw new BadRequestException('To không hợp lệ (ISO date)');
    }
    if (from && to && parsedFrom && parsedTo && parsedFrom.getTime() > parsedTo.getTime()) {
      throw new BadRequestException('Khoảng thời gian không hợp lệ');
    }
    if (result && result !== '' && !['SUCCESS', 'FAILED'].includes(result)) {
      throw new BadRequestException('Result không hợp lệ');
    }

    const { entities, total } = await this.queryAuditLogs.execute({
      actorUserId: user.sub,
      actorRoles: user.roles ?? [],
      filter: {
        action: action || undefined,
        actorUserId: actorUserId || undefined,
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        result: (result as 'SUCCESS' | 'FAILED') || undefined,
        correlationId: correlationId || undefined,
        from: parsedFrom,
        to: parsedTo,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });

    const data = toAuditLogListResponse(entities);
    return { data, total, limit: parsedLimit ?? 20, offset: parsedOffset ?? 0 };
  }
}
