import {
  Controller,
  Post,
  Patch,
  Get,
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
import { CreateProjectUseCase } from '../../../application/use-case/create-project.use-case';
import { UpdateProjectUseCase } from '../../../application/use-case/update-project.use-case';
import { TransitionProjectStatusUseCase } from '../../../application/use-case/transition-project-status.use-case';
import { AddProjectMemberUseCase } from '../../../application/use-case/add-project-member.use-case';
import { RemoveProjectMemberUseCase } from '../../../application/use-case/remove-project-member.use-case';
import { ListProjectMembersUseCase } from '../../../application/use-case/list-project-members.use-case';
import { CreateProjectAreaUseCase } from '../../../application/use-case/create-project-area.use-case';
import { UpdateProjectAreaUseCase } from '../../../application/use-case/update-project-area.use-case';
import { ListProjectAreasUseCase } from '../../../application/use-case/list-project-areas.use-case';
import { CreateProjectDto, UpdateProjectDto, TransitionProjectStatusDto } from '../presentation/dto/project.dto';
import { AddProjectMemberDto, RemoveProjectMemberDto } from '../presentation/dto/project-member.dto';
import { CreateProjectAreaDto, UpdateProjectAreaDto } from '../presentation/dto/project-area.dto';
import { toProjectProfileResponse } from '../presentation/mapper/project.mapper';
import { toProjectMemberResponse, toProjectMemberListResponse } from '../presentation/mapper/project-member.mapper';
import { toProjectAreaResponse, toProjectAreaListResponse } from '../presentation/mapper/project-area.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';

/**
 * PRJ-SRS-001 (issue #32) — write slice dự án.
 * Chỉ sở hữu `POST /api/v1/projects` và `PATCH /api/v1/projects/:id`;
 * reads (`GET`, `GET :id`) ở lại iam `ProjectsController` (scope-integrated).
 * PRJ-SRS-002 (issue #33, L1-L6) — thêm `PATCH /api/v1/projects/:id/status`.
 * PRJ-SRS-005 (issue #36, M1-M6) — thêm `GET|POST /api/v1/projects/:id/members`
 * và `DELETE /api/v1/projects/:id/members/:memberId`.
 * PRJ-SRS-003 (issue #34, A1-A6) — thêm `GET|POST /api/v1/projects/:id/areas`
 * và `PATCH /api/v1/projects/:id/areas/:areaId`.
 * Write roles = ADMIN + PROJECT_MANAGER (P2, L2); project-scope write checks
 * chi tiết defer sang #37 (PRJ-SRS-006) — riêng areas enforce membership
 * ngay từ slice này (A4, xem ENDPOINTS.md §13). Reads areas mở cho mọi
 * ACTIVE member (WO picker tương lai phục vụ cả worker).
  */
const PROJECT_WRITE_ROLES = ['ADMIN', 'PROJECT_MANAGER'];

/**
 * PRJ-SRS-006 (issue #37) — actor server-derived tu JWT (`JwtAuthGuard` da gan
 * `req.user`). Khong gate global role o day: use case enforce project-scope
 * (403 khi ngoai scope). Client khong the gia actor (JWT signed, login cap).
 */
function projectActor(req: Request): TokenPayload {
  return (req as unknown as { user: TokenPayload }).user;
}

function assertProjectWriteAccess(req: Request): TokenPayload {
  return requireRoles(
    req as unknown as { user?: { roles?: string[] } },
    PROJECT_WRITE_ROLES,
  ) as unknown as TokenPayload;
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
  // Strict X-Correlation-Id (P6, IAM-SRS-008): header sai UUID → 400
  // actionable thay vì 500 audit-insert (audit_logs.correlation_id uuid-typed).
  if (correlationId && !UUID_RE.test(correlationId)) {
    throw new BadRequestException(
      'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
    );
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('api/v1/projects')
@UseGuards(JwtAuthGuard)
export class PrjProjectsController {
  constructor(
    private readonly createProject: CreateProjectUseCase,
    private readonly updateProject: UpdateProjectUseCase,
    private readonly transitionStatus: TransitionProjectStatusUseCase,
    private readonly addProjectMember: AddProjectMemberUseCase,
    private readonly removeProjectMember: RemoveProjectMemberUseCase,
    private readonly listProjectMembers: ListProjectMembersUseCase,
    private readonly createProjectArea: CreateProjectAreaUseCase,
    private readonly updateProjectArea: UpdateProjectAreaUseCase,
    private readonly listProjectAreas: ListProjectAreasUseCase,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateProjectDto, @Req() req: Request) {
    const actor = assertProjectWriteAccess(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, managerName } = await this.createProject.execute({
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      address: dto.address,
      timezone: dto.timezone ?? null,
      plannedStartDate: dto.plannedStartDate,
      plannedEndDate: dto.plannedEndDate,
      managerId: dto.managerId,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toProjectProfileResponse(entity, managerName, actor.sub);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: Request,
  ) {
    const actor = projectActor(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, managerName } = await this.updateProject.execute({
      projectId: id,
      name: dto.name ?? undefined,
      description: dto.description,
      address: dto.address ?? undefined,
      timezone: dto.timezone ?? undefined,
      plannedStartDate: dto.plannedStartDate ?? undefined,
      plannedEndDate: dto.plannedEndDate ?? undefined,
      managerId: dto.managerId ?? undefined,
      code: dto.code ?? undefined,
      status: dto.status ?? undefined,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toProjectProfileResponse(entity, managerName, actor.sub);
  }

  @Patch(':id/status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async transition(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: TransitionProjectStatusDto,
    @Req() req: Request,
  ) {
    const actor = projectActor(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { entity, managerName, alreadyInState } = await this.transitionStatus.execute({
      projectId: id,
      action: dto.action,
      reason: dto.reason ?? null,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return { ...toProjectProfileResponse(entity, managerName, actor.sub), alreadyInState };
  }

  /**
   * PRJ-SRS-005 (issue #36, M1/M5) — tra cứu thành viên dự án.
   * Default chỉ active; `?includeInactive=true` toàn bộ lịch sử (`joined_at` DESC).
   * PRJ-SRS-006 (issue #37): mở cho mọi ACTIVE member + ADMIN (use-case guard) — xem ENDPOINTS.md §15;
   * current data → no-store.
   */
  @Get(':id/members')
  @Header('Cache-Control', 'no-store')
  async listMembers(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Req() req: Request,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const actor = projectActor(req);
    const meta = getMeta(req);
    const { members } = await this.listProjectMembers.execute({
      projectId: id,
      includeInactive: includeInactive === 'true' || includeInactive === '1',
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return { data: toProjectMemberListResponse(members), total: members.length };
  }

  /**
   * PRJ-SRS-005 (issue #36, M1) — thêm thành viên (`201`).
   * `projectRole` chỉ `COORDINATOR`|`QC`|`WORKER`|`VIEWER`;
   * `MANAGER` → 400 fieldErrors `{projectRole}` (đặt qua PATCH managerId).
   */
  @Post(':id/members')
  @HttpCode(201)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async addMember(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Body() dto: AddProjectMemberDto,
    @Req() req: Request,
  ) {
    const actor = projectActor(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { member } = await this.addProjectMember.execute({
      projectId: id,
      userId: dto.userId,
      projectRole: dto.projectRole,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toProjectMemberResponse(member);
  }

  /**
   * PRJ-SRS-005 (issue #36, M2) — xóa mềm thành viên (soft-deactivate, giữ lịch sử).
   * Idempotent: đã inactive → 200 `{alreadyRemoved:true}`, không audit.
   * Membership của manager hiện tại → 409 `MANAGER_MEMBER`.
   */
  @Delete(':id/members/:memberId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async removeMember(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Param('memberId', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) memberId: string,
    @Req() req: Request,
    @Body() dto?: RemoveProjectMemberDto,
  ) {
    const actor = projectActor(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { member, alreadyRemoved } = await this.removeProjectMember.execute({
      projectId: id,
      memberId,
      reason: dto?.reason ?? null,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return { ...toProjectMemberResponse(member), alreadyRemoved };
  }

  /**
   * PRJ-SRS-003 (issue #34, A1/A4) — tạo khu vực trong dự án (`201`).
   * Writes = PROJECT_WRITE_ROLES; scope A4 (ADMIN bypass, PM phải là member)
   * do use case enforce → non-member PM 403. Strict `X-Correlation-Id`.
   */
  @Post(':projectId/areas')
  @HttpCode(201)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async createArea(
    @Param('projectId', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) projectId: string,
    @Body() dto: CreateProjectAreaDto,
    @Req() req: Request,
  ) {
    const actor = assertProjectWriteAccess(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { area } = await this.createProjectArea.execute({
      projectId,
      code: dto.code ?? null,
      name: dto.name,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toProjectAreaResponse(area);
  }

  /**
   * PRJ-SRS-003 (issue #34, A1/A4) — cập nhật khu vực: rename tại chỗ /
   * đổi mã / toggle active. Deactivate đã inactive → `{alreadyInactive: true}`.
   * PRJ-SRS-007 (issue #38) — retire kèm `usage` + `warning` khi đang bị WO mở
   * tham chiếu (mirror work-types #35 warning shape).
   */
  @Patch(':projectId/areas/:areaId')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async updateArea(
    @Param('projectId', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) projectId: string,
    @Param('areaId', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) areaId: string,
    @Body() dto: UpdateProjectAreaDto,
    @Req() req: Request,
  ) {
    const actor = assertProjectWriteAccess(req);
    const meta = getMeta(req);
    assertStrictCorrelationId(meta.correlationId);
    const { area, alreadyInactive, usage, warning } = await this.updateProjectArea.execute({
      projectId,
      areaId,
      name: dto.name ?? undefined,
      code: dto.code ?? undefined,
      isActive: dto.isActive ?? undefined,
      reason: dto.reason ?? null,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toProjectAreaResponse(area, { usage, warning, alreadyInactive });
  }

  /**
   * PRJ-SRS-007 (issue #38) — picker khu vực cho giao dịch mới (tạo Work
   * Order): chỉ khu vực còn hoạt động, sắp `name ASC` (mirror
   * `GET /work-types/active` #35). Scope như list: mọi ACTIVE member
   * (kể cả WORKER) — ADMIN bypass. Current data → no-store.
   */
  @Get(':projectId/areas/active')
  @Header('Cache-Control', 'no-store')
  async listActiveAreas(
    @Param('projectId', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) projectId: string,
    @Req() req: Request,
  ) {
    const user = (req as unknown as { user: TokenPayload }).user;
    const { areas } = await this.listProjectAreas.execute({
      projectId,
      activeOnly: true,
      actorUserId: user.sub,
      actorRoles: user.roles ?? [],
    });
    return { data: toProjectAreaListResponse(areas), total: areas.length };
  }

  /**
   * PRJ-SRS-003 (issue #34, A1/A4) — tra cứu khu vực theo dự án.
   * Default kèm inactive (flag `isActive`); `?activeOnly=true` chỉ active
   * (future Work Order picker). Mọi ACTIVE member đều đọc được (kể cả
   * WORKER) — scope A4 do use case enforce; ADMIN bypass. Current data → no-store.
   */
  @Get(':projectId/areas')
  @Header('Cache-Control', 'no-store')
  async listAreas(
    @Param('projectId', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) projectId: string,
    @Req() req: Request,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const user = (req as unknown as { user: TokenPayload }).user;
    const { areas } = await this.listProjectAreas.execute({
      projectId,
      activeOnly: activeOnly === 'true' || activeOnly === '1',
      actorUserId: user.sub,
      actorRoles: user.roles ?? [],
    });
    return { data: toProjectAreaListResponse(areas), total: areas.length };
  }
}
