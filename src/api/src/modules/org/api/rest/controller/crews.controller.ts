import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  HttpCode,
  Param,
  Query,
  Body,
  Req,
  Header,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { requireRoles } from '../../../../iam/api/rest/guard/roles.guard';
import { CreateCrewUseCase } from '../../../application/use-case/create-crew.use-case';
import { UpdateCrewUseCase } from '../../../application/use-case/update-crew.use-case';
import { GetCrewUseCase } from '../../../application/use-case/get-crew.use-case';
import { SearchCrewsUseCase } from '../../../application/use-case/search-crews.use-case';
import { StatusTransitionCrewUseCase } from '../../../application/use-case/status-transition-crew.use-case';
import { GetCrewOpenWorkUseCase } from '../../../application/use-case/get-crew-open-work.use-case';
import { AddCrewMemberUseCase } from '../../../application/use-case/add-crew-member.use-case';
import { RemoveCrewMemberUseCase } from '../../../application/use-case/remove-crew-member.use-case';
import { ListCrewMembersUseCase } from '../../../application/use-case/list-crew-members.use-case';
import { CreateCrewDto, UpdateCrewDto, CreateCrewMemberDto, RemoveCrewMemberDto } from '../presentation/dto/crew.dto';
import { ChangeResourceStatusDto } from '../presentation/dto/resource-status.dto';
import { toCrewResponse, toCrewListResponse, toCrewMemberResponse, toCrewMemberListResponse } from '../presentation/mapper/crew.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';

/**
 * ORG-SRS-006 (issue #29) — roles cho crews: read + write cho
 * ADMIN + PROJECT_MANAGER (SRS actor Điều phối viên — khác write admin-only
 * của workers/contractors/trades; KHÔNG widen nhầm endpoint khác).
 * WORKER-role → 403, anon → 401 (JwtAuthGuard).
 */
const CREW_ROLES = ['ADMIN', 'PROJECT_MANAGER'];

function assertCrewAccess(req: Request): TokenPayload {
  return requireRoles(
    req as unknown as { user?: { roles?: string[] } },
    CREW_ROLES,
  ) as unknown as TokenPayload;
}

/**
 * Filter validation errors carry a field-level shape
 * `{ statusCode: 400, message, fieldErrors: { <field>: [msg] } }` (pattern #28).
 */
function filterError(field: string, message: string): never {
  throw new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
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

@Controller('api/v1/crews')
@UseGuards(JwtAuthGuard)
export class CrewsController {
  constructor(
    private readonly createCrew: CreateCrewUseCase,
    private readonly updateCrew: UpdateCrewUseCase,
    private readonly getCrew: GetCrewUseCase,
    private readonly searchCrews: SearchCrewsUseCase,
    private readonly transitionCrewStatus: StatusTransitionCrewUseCase,
    private readonly getCrewOpenWork: GetCrewOpenWorkUseCase,
    private readonly addCrewMember: AddCrewMemberUseCase,
    private readonly removeCrewMember: RemoveCrewMemberUseCase,
    private readonly listCrewMembers: ListCrewMembersUseCase,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateCrewDto, @Req() req: Request) {
    const actor = assertCrewAccess(req);
    const meta = getMeta(req);
    // Strict X-Correlation-Id (admin/management): header sai UUID → 400
    // actionable thay vì 500 audit-insert (audit_logs.correlation_id uuid-typed).
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity } = await this.createCrew.execute({
      code: dto.code,
      name: dto.name,
      leaderUserId: dto.leaderUserId,
      contractorId: dto.contractorId ?? null,
      description: dto.description ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toCrewResponse(entity);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async search(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('eligibleOnly') eligibleOnly?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    assertCrewAccess(req);
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
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
    const eligibleFilter = eligibleOnly === 'true' || eligibleOnly === '1';
    if (eligibleFilter && status === 'INACTIVE') {
      filterError('eligibleOnly', 'Không thể lọc eligibleOnly với INACTIVE');
    }
    // Sort whitelist: name → name, createdAt → created_at; default createdAt/desc.
    if (sort !== undefined && sort !== '' && !['name', 'createdAt'].includes(sort)) {
      filterError('sort', 'Sort không hợp lệ (name|createdAt)');
    }
    if (order !== undefined && order !== '' && !['asc', 'desc'].includes(order)) {
      filterError('order', 'Order không hợp lệ (asc|desc)');
    }
    const { entities, total, enrichments } = await this.searchCrews.execute({
      status: status || undefined,
      search: search || undefined,
      limit: parsedLimit,
      offset: parsedOffset,
      eligibleOnly: eligibleFilter || undefined,
      sort: (sort || undefined) as 'name' | 'createdAt' | undefined,
      order: (order || undefined) as 'asc' | 'desc' | undefined,
    });
    // ORG-05 — list kèm leaderName/memberCount (mock cũ thiếu enrichments → null/0).
    return { data: toCrewListResponse(entities, enrichments), total, limit: parsedLimit ?? 20, offset: parsedOffset ?? 0 };
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertCrewAccess(req);
    const { entity } = await this.getCrew.execute({ crewId: id });
    return toCrewResponse(entity);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCrewDto,
    @Req() req: Request,
  ) {
    const actor = assertCrewAccess(req);
    const meta = getMeta(req);
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity } = await this.updateCrew.execute({
      crewId: id,
      name: dto.name,
      description: dto.description,
      contractorId: dto.contractorId,
      leaderUserId: dto.leaderUserId,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toCrewResponse(entity);
  }

  /**
   * ORG-SRS-006 (issue #29) — lifecycle đội, reuse resource-status.policy (#27).
   * Action enum API layer, KHÔNG đổi enum DB.
   */
  @Patch(':id/status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeResourceStatusDto,
    @Req() req: Request,
  ) {
    const actor = assertCrewAccess(req);
    const meta = getMeta(req);
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity, alreadyInState, warning } = await this.transitionCrewStatus.execute({
      crewId: id,
      action: dto.action,
      reason: dto.reason ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return {
      ...toCrewResponse(entity),
      alreadyInState,
      ...(warning !== undefined ? { warning } : {}),
    };
  }

  /**
   * ORG-SRS-006 (issue #29) — pre-check open work (UI confirm dialog):
   * chỉ đếm, không chặn, không audit.
   */
  @Get(':id/open-work')
  async openWork(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertCrewAccess(req);
    return this.getCrewOpenWork.execute({ crewId: id });
  }

  /**
   * ORG-SRS-007 (issue #30) — tra cứu thành viên hiện tại + lịch sử.
   * Default chỉ active; `?at=YYYY-MM-DD` point-in-time; `?includeInactive=true`
   * toàn bộ lịch sử. Same CREW_ROLES read (D7). Current data → no-store.
   */
  @Get(':id/members')
  @Header('Cache-Control', 'no-store')
  async listMembers(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
    @Query('at') at?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    assertCrewAccess(req);
    const { members } = await this.listCrewMembers.execute({
      crewId: id,
      at: at || undefined,
      includeInactive: includeInactive === 'true' || includeInactive === '1',
    });
    return { data: toCrewMemberListResponse(members), total: members.length };
  }

  /**
   * ORG-SRS-007 (issue #30, D1) — thêm thành viên role MEMBER (201).
   * LEAD không qua đây. member_role luôn 'MEMBER'.
   */
  @Post(':id/members')
  @HttpCode(201)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async addMember(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateCrewMemberDto,
    @Req() req: Request,
  ) {
    const actor = assertCrewAccess(req);
    const meta = getMeta(req);
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { member, warning } = await this.addCrewMember.execute({
      crewId: id,
      userId: dto.userId,
      effectiveFrom: dto.effectiveFrom ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return {
      ...toCrewMemberResponse(member),
      ...(warning !== undefined ? { warning } : {}),
    };
  }

  /**
   * ORG-SRS-007 (issue #30, D2) — xóa mềm thành viên (soft-deactivate, giữ lịch sử).
   * Idempotent: đã inactive → 200 {alreadyRemoved:true}, không audit.
   */
  @Delete(':id/members/:memberId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async removeMember(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Req() req: Request,
    @Body() dto?: RemoveCrewMemberDto,
  ) {
    const actor = assertCrewAccess(req);
    const meta = getMeta(req);
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { member, alreadyRemoved } = await this.removeCrewMember.execute({
      crewId: id,
      memberId,
      effectiveTo: dto?.effectiveTo ?? null,
      reason: dto?.reason ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return { ...toCrewMemberResponse(member), alreadyRemoved };
  }
}
