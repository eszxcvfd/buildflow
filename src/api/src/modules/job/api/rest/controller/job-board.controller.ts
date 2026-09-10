import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { SearchJobBoardUseCase } from '../../../application/use-case/search-job-board.use-case';
import { GetJobBoardFilterOptionsUseCase } from '../../../application/use-case/get-job-board-filter-options.use-case';
import { GetJobBoardDetailUseCase } from '../../../application/use-case/job-board-detail.use-case';
import { JobBoardFilterError, parseJobBoardFilters } from '../../../domain/service/job-board-filter.policy';
import { toJobBoardDetailResponse, toJobBoardListResponse } from '../presentation/mapper/job-board.mapper';
import { workOrderActor } from './work-orders.controller';
import { TokenPayload } from '../../../../iam/application/port/token.port';

function filterError(field: string | string[], message: string, code?: string): never {
  const fields = Array.isArray(field) ? field : [field];
  const fieldErrors: Record<string, string[]> = {};
  for (const f of fields) {
    fieldErrors[f] = [message];
  }
  // F001 (#46): date-range 400 mang `code: 'JOB_BOARD_DATE_RANGE_INVALID'`
  // (mirror #44 `JOB_BOARD_WINDOW_INVALID`); filter khác không có code.
  throw new BadRequestException(
    code === undefined
      ? { statusCode: 400, message, fieldErrors }
      : { statusCode: 400, message, code, fieldErrors },
  );
}

function actorRolesOf(actor: TokenPayload): string[] {
  return actor.roles ?? [];
}

/**
 * JOB-SRS-005 (issue #45) — Job Board list (BD3: controller RIÊNG, không
 * flag trên `GET /work-orders` — worker board và coordinator list khác
 * consumer, khác predicate SQL, khác item shape; xem ENDPOINTS §20) +
 * JOB-SRS-006 (issue #46, §20.1: 6 filter param AND-compose vào WHERE SQL).
 * - `GET /api/v1/job-board`: mọi user đã đăng nhập (`JwtAuthGuard`);
 *   ADMIN = tất cả available (bypass, chỉ debug-log), non-ADMIN = available
 *   của các project mình là ACTIVE member; membership rỗng + KHÔNG gửi
 *   `projectId` → `200 empty`, KHÔNG 403 (BD2); đã gửi `projectId` ∉ scope →
 *   `403` generic (BD12 — discharge ghi chú BD2).
 * - Filter (tất cả optional, absent/`''` = không filter): `projectId` đơn,
 *   `areaId`/`workTypeId` lặp được (`?areaId=a&areaId=b`), `dateFrom`/`dateTo`
 *   ISO-8601 bắt buộc offset (áp lên PLANNED dates, overlap instant),
 *   `skill` enum duy nhất `mine` (server resolve tradeIds — BD11).
 * - Query lạ (unknown key) → BỎ QUA, không 400 (BD4/BD14 — parity
 *   `work-orders.controller.ts`: chỉ đọc từng param). Chỉ param GIÁ TRỊ
 *   sai → 400 `fieldErrors` keyed (BD14).
 * - `GET /api/v1/job-board/filter-options`: nguồn picker cho WORKER
 *   (DISTINCT trên đúng WHERE availability+scope — BD13; membership rỗng →
 *   4 mảng rỗng + `now`; response `{ now, projects, areas, workTypes, trades }`
 *   — `now` top-level là clock server caller dùng chung instant).
 * - Read-only: không tx, không audit nghiệp vụ (BD8/BD18 — parity §17).
 * - `Cache-Control: no-store` (parity list §17).
 * - JOB-SRS-007 (issue #47, §20.2): `GET /api/v1/job-board/:id` — chi tiết
 *   công việc còn trống (scope-first #41, OMIT `createdBy`/`requestKey`/
 *   `hasActiveAssignment`, 409 `JOB_BOARD_CONFIG_INVALID` khi work-type ref
 *   lỗi). Khai báo SAU `filter-options` và `GET ''` (F9 — tránh nuốt route).
 */
@Controller('api/v1/job-board')
@UseGuards(JwtAuthGuard)
export class JobBoardController {
  constructor(
    private readonly searchJobBoard: SearchJobBoardUseCase,
    private readonly filterOptions: GetJobBoardFilterOptionsUseCase,
    private readonly jobBoardDetail: GetJobBoardDetailUseCase,
  ) {}

  @Get('filter-options')
  @Header('Cache-Control', 'no-store')
  async options(@Req() req: Request) {
    const actor = workOrderActor(req);
    return this.filterOptions.execute({
      actorUserId: actor.sub,
      actorRoles: actorRolesOf(actor),
    });
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query() query?: Record<string, unknown>,
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
    // JOB-SRS-006 (#46) — parse 6 filter param qua policy thuần (repeatable
    // `areaId`/`workTypeId` qua raw query object — BD4 giữ: key lạ ignore).
    let filters;
    try {
      filters = parseJobBoardFilters({
        projectId: query?.['projectId'],
        areaId: query?.['areaId'],
        workTypeId: query?.['workTypeId'],
        dateFrom: query?.['dateFrom'],
        dateTo: query?.['dateTo'],
        skill: query?.['skill'],
      });
    } catch (e) {
      if (e instanceof JobBoardFilterError) {
        filterError(e.fields, e.message, e.code);
      }
      throw e;
    }
    const { entities, total, now, activeAssignmentIds, workTypeRefs, projectRefs, areaRefs, tradeRefs } =
      await this.searchJobBoard.execute({
        limit: parsedLimit,
        offset: parsedOffset,
        actorUserId: actor.sub,
        actorRoles: actorRolesOf(actor),
        projectId: filters.projectId,
        areaIds: filters.areaIds,
        workTypeIds: filters.workTypeIds,
        plannedFrom: filters.dateFrom,
        plannedTo: filters.dateTo,
        skillMine: filters.skillMine || undefined,
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

  /**
   * JOB-SRS-007 (issue #47) — chi tiết công việc còn trống. Khai báo SAU
   * `filter-options` và `GET ''` (F9 — `@Get(':id')` trước sẽ nuốt route).
   * Id sai UUID → 400 stock Nest (`ParseUUIDPipe`, trước use case).
   */
  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async detail(@Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string, @Req() req: Request) {
    const actor = workOrderActor(req);
    const output = await this.jobBoardDetail.execute({
      workOrderId: id,
      actorUserId: actor.sub,
      actorRoles: actorRolesOf(actor),
    });
    return toJobBoardDetailResponse(output);
  }
}
