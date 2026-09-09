import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { SearchJobBoardUseCase } from '../../../application/use-case/search-job-board.use-case';
import { toJobBoardListResponse } from '../presentation/mapper/job-board.mapper';
import { workOrderActor } from './work-orders.controller';
import { TokenPayload } from '../../../../iam/application/port/token.port';

function filterError(field: string, message: string): never {
  throw new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function actorRolesOf(actor: TokenPayload): string[] {
  return actor.roles ?? [];
}

/**
 * JOB-SRS-005 (issue #45) — Job Board list (BD3: controller RIÊNG, không
 * flag trên `GET /work-orders` — worker board và coordinator list khác
 * consumer, khác predicate SQL, khác item shape; xem ENDPOINTS §20).
 * - `GET /api/v1/job-board`: mọi user đã đăng nhập (`JwtAuthGuard`);
 *   ADMIN = tất cả available (bypass, chỉ debug-log), non-ADMIN = available
 *   của các project mình là ACTIVE member; membership rỗng → `200 empty`,
 *   KHÔNG 403 (BD2); endpoint KHÔNG nhận bất kỳ filter param nào
 *   (`projectId`/`status`/`search` là của #46 — BD2).
 * - Query lạ (unknown key) → BỎ QUA, không 400 (BD4 — parity
 *   `work-orders.controller.ts`: chỉ đọc `@Query('limit'/'offset')` từng
 *   param). Chỉ `limit`/`offset` GIÁ TRỊ sai → 400 `fieldErrors` (BD1).
 * - Read-only: không tx, không audit nghiệp vụ (BD8 — parity §17).
 * - `Cache-Control: no-store` (parity list §17).
 */
@Controller('api/v1/job-board')
@UseGuards(JwtAuthGuard)
export class JobBoardController {
  constructor(private readonly searchJobBoard: SearchJobBoardUseCase) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const actor = workOrderActor(req);
    let parsedLimit: number | undefined;
    let parsedOffset: number | undefined;
    if (limit !== undefined && limit !== '') {
      // F003 — pre-check chữ số thuần TRƯỚC Number(): chặn ' ', '0x10',
      // '1e2', '2.5' lọt qua Number() (' '→0, '0x10'→16); sai → 400 như cũ.
      if (!/^\d+$/.test(limit)) {
        filterError('limit', 'Limit không hợp lệ (1-100)');
      }
      parsedLimit = Number(limit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        filterError('limit', 'Limit không hợp lệ (1-100)');
      }
    }
    if (offset !== undefined && offset !== '') {
      if (!/^\d+$/.test(offset)) {
        filterError('offset', 'Offset không hợp lệ (phải >= 0)');
      }
      parsedOffset = Number(offset);
      if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        filterError('offset', 'Offset không hợp lệ (phải >= 0)');
      }
    }
    const { entities, total, now, activeAssignmentIds, workTypeRefs, projectRefs, areaRefs, tradeRefs } =
      await this.searchJobBoard.execute({
        limit: parsedLimit,
        offset: parsedOffset,
        actorUserId: actor.sub,
        actorRoles: actorRolesOf(actor),
      });
    return {
      data: toJobBoardListResponse(entities, {
        workTypeRefs,
        projectRefs,
        areaRefs,
        tradeRefs,
        activeAssignmentIds,
        now,
      }),
      total,
      limit: parsedLimit ?? 20,
      offset: parsedOffset ?? 0,
    };
  }
}
