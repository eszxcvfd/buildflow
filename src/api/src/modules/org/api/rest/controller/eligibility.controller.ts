import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Header,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { requireRoles } from '../../../../iam/api/rest/guard/roles.guard';
import { TokenPayload } from '../../../../iam/application/port/token.port';
import { CheckWorkerEligibilityUseCase } from '../../../application/use-case/check-worker-eligibility.use-case';
import { CheckCrewEligibilityUseCase } from '../../../application/use-case/check-crew-eligibility.use-case';
import { isValidIsoDateString, todayDateOnly } from '../../../domain/service/crew-member.policy';

/**
 * ORG-SRS-008 (issue #31) — dữ liệu điều kiện nhận việc (advisory pre-check,
 * KHÔNG phải authorization; assignment CREATE + snapshot + re-check-at-write
 * thuộc slice JOB-SRS tương lai).
 *
 * Roles: GET workers/:workerId + crews/:crewId → ADMIN + PROJECT_MANAGER;
 * GET me → JwtAuthGuard only (server tự resolve worker theo JWT sub).
 * Read-only: không transaction, không ghi audit → X-Correlation-Id lenient
 * (reuse khi là UUID, ngược lại generate mới, không bao giờ 400).
 * Mọi GET trả `Cache-Control: no-store`.
 */
const ELIGIBILITY_READ_ROLES = ['ADMIN', 'PROJECT_MANAGER'];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function filterError(field: string, message: string): never {
  throw new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

function getCorrelationId(req: Request): string | null {
  const raw = req.headers['x-correlation-id'];
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  return trimmed === '' ? null : trimmed;
}

@Controller('api/v1/eligibility')
@UseGuards(JwtAuthGuard)
export class EligibilityController {
  constructor(
    private readonly checkWorkerEligibility: CheckWorkerEligibilityUseCase,
    private readonly checkCrewEligibility: CheckCrewEligibilityUseCase,
  ) {}

  @Get('workers/:workerId')
  @Header('Cache-Control', 'no-store')
  async checkWorker(
    @Param('workerId', new ParseUUIDPipe()) workerId: string,
    @Req() req: Request,
    @Query('tradeId') tradeId?: string,
    @Query('skillLevel') skillLevel?: string,
    @Query('at') at?: string,
  ) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, ELIGIBILITY_READ_ROLES);
    const { parsedTradeId, parsedSkill, parsedAt } = this.parseWorkerQuery(tradeId, skillLevel, at);
    return this.checkWorkerEligibility.execute({
      workerId,
      tradeId: parsedTradeId,
      skillLevel: parsedSkill,
      at: parsedAt,
      correlationId: getCorrelationId(req),
    });
  }

  @Get('me')
  @Header('Cache-Control', 'no-store')
  async checkMe(
    @Req() req: Request,
    @Query('tradeId') tradeId?: string,
    @Query('skillLevel') skillLevel?: string,
    @Query('at') at?: string,
  ) {
    // JwtAuthGuard only — không check role; server resolve worker theo JWT sub.
    const actor = (req as unknown as { user: TokenPayload }).user;
    const { parsedTradeId, parsedSkill, parsedAt } = this.parseWorkerQuery(tradeId, skillLevel, at);
    return this.checkWorkerEligibility.execute({
      workerId: actor.sub,
      tradeId: parsedTradeId,
      skillLevel: parsedSkill,
      at: parsedAt,
      correlationId: getCorrelationId(req),
      notFoundMessage: 'user không có hồ sơ worker',
    });
  }

  @Get('crews/:crewId')
  @Header('Cache-Control', 'no-store')
  async checkCrew(
    @Param('crewId', new ParseUUIDPipe()) crewId: string,
    @Req() req: Request,
  ) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, ELIGIBILITY_READ_ROLES);
    return this.checkCrewEligibility.execute({
      crewId,
      correlationId: getCorrelationId(req),
    });
  }

  private parseWorkerQuery(
    tradeId?: string,
    skillLevel?: string,
    at?: string,
  ): { parsedTradeId: string | null; parsedSkill: number | null; parsedAt: string } {
    let parsedTradeId: string | null = null;
    if (tradeId !== undefined && tradeId !== '') {
      if (!UUID_RE.test(tradeId)) filterError('tradeId', 'Trade ID không hợp lệ');
      parsedTradeId = tradeId;
    }
    let parsedSkill: number | null = null;
    if (skillLevel !== undefined && skillLevel !== '') {
      parsedSkill = Number(skillLevel);
      if (!Number.isInteger(parsedSkill) || parsedSkill < 1 || parsedSkill > 5) {
        filterError('skillLevel', 'Skill level phải là 1-5');
      }
    }
    let parsedAt = todayDateOnly();
    if (at !== undefined && at !== '') {
      if (!isValidIsoDateString(at)) filterError('at', 'Ngày tra cứu không hợp lệ (YYYY-MM-DD)');
      parsedAt = at;
    }
    return { parsedTradeId, parsedSkill, parsedAt };
  }
}
