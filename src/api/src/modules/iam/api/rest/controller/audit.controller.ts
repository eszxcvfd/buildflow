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

const AUDIT_DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const AUDIT_RFC3339_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Strict `from`/`to` parsing for audit filters (IAM-SRS-008).
 * Accepts ONLY a date-only `YYYY-MM-DD` (normalized: `from` → `00:00:00.000Z`,
 * `to` → `23:59:59.999Z` end-of-day UTC so the chosen end-day is included) or
 * an RFC3339-ish timestamp used as-is. Anything else — including impossible
 * calendar dates like `2026-02-30` that `new Date()` silently rolls over to
 * March 2 — is rejected with an actionable 400.
 */
function parseAuditDate(value: string, field: 'From' | 'To'): Date {
  const invalid = () =>
    new BadRequestException(
      `${field} không hợp lệ — dùng YYYY-MM-DD hoặc ISO 8601 timestamp (ví dụ 2026-08-27 hoặc 2026-08-27T10:00:00Z)`,
    );
  const isDateOnly = AUDIT_DATE_ONLY_RE.test(value);
  if (!isDateOnly && !AUDIT_RFC3339_RE.test(value)) throw invalid();

  // Calendar validity: `new Date('2026-02-30…')` is NOT Invalid Date (rolls
  // over to 2026-03-02), so check the components before trusting the parse.
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth) throw invalid();
  if (!isDateOnly) {
    const time = value.slice(11);
    const hh = Number(time.slice(0, 2));
    const mm = Number(time.slice(3, 5));
    const ss = time.length >= 8 ? Number(time.slice(6, 8)) : 0;
    if (hh > 23 || mm > 59 || ss > 59) throw invalid();
  }

  const normalized = isDateOnly
    ? `${value}T${field === 'From' ? '00:00:00.000' : '23:59:59.999'}Z`
    : value;
  const parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) throw invalid();
  return parsed;
}

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
      parsedFrom = parseAuditDate(from, 'From');
    }
    if (to) {
      parsedTo = parseAuditDate(to, 'To');
    }
    if (parsedFrom && parsedTo && parsedFrom.getTime() > parsedTo.getTime()) {
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
