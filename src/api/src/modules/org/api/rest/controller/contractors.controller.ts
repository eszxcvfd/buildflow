import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Req,
  Header,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ForbiddenException,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { requireRoles } from '../../../../iam/api/rest/guard/roles.guard';
import { CreateContractorUseCase } from '../../../application/use-case/create-contractor.use-case';
import { UpdateContractorUseCase } from '../../../application/use-case/update-contractor.use-case';
import { GetContractorUseCase } from '../../../application/use-case/get-contractor.use-case';
import { SearchContractorsUseCase } from '../../../application/use-case/search-contractors.use-case';
import { StatusTransitionContractorUseCase } from '../../../application/use-case/status-transition-contractor.use-case';
import { GetContractorOpenWorkUseCase } from '../../../application/use-case/get-contractor-open-work.use-case';
import { CreateContractorDto, UpdateContractorDto } from '../presentation/dto/contractor.dto';
import { ChangeResourceStatusDto } from '../presentation/dto/resource-status.dto';
import { toContractorResponse, toContractorListResponse } from '../presentation/mapper/contractor.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';

function assertAdmin(req: Request): TokenPayload {
  const user = (req as unknown as { user: TokenPayload }).user;
  if (!user) throw new ForbiddenException('Không có quyền truy cập');
  if (!user.roles?.includes('ADMIN')) throw new ForbiddenException('Không có quyền truy cập');
  return user;
}

/**
 * ORG-SRS-005 (issue #28) — roles allowed on READ paths (search + detail):
 * ADMIN keeps full access, PROJECT_MANAGER gets read-only directory access.
 * All write paths (POST/PATCH/status/open-work) stay ADMIN-only via assertAdmin.
 */
const DIRECTORY_READ_ROLES = ['ADMIN', 'PROJECT_MANAGER'];

/**
 * ORG-SRS-005 (issue #28) — filter validation errors carry a field-level shape
 * `{ statusCode: 400, message, fieldErrors: { <field>: [msg] } }` so the UI can
 * render errors per field. The `message` text is unchanged, so clients that
 * only read `message` keep working.
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

@Controller('api/v1/contractors')
@UseGuards(JwtAuthGuard)
export class ContractorsController {
  constructor(
    private readonly createContractor: CreateContractorUseCase,
    private readonly updateContractor: UpdateContractorUseCase,
    private readonly getContractor: GetContractorUseCase,
    private readonly searchContractors: SearchContractorsUseCase,
    private readonly transitionContractorStatus: StatusTransitionContractorUseCase,
    private readonly getContractorOpenWork: GetContractorOpenWorkUseCase,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateContractorDto, @Req() req: Request) {
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
    const { entity } = await this.createContractor.execute({
      code: dto.code,
      name: dto.name,
      contactName: dto.contactName,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      scope: dto.scope,
      status: dto.status ?? 'ACTIVE',
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toContractorResponse(entity);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async search(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('scope') scope?: string,
    @Query('eligibleOnly') eligibleOnly?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, DIRECTORY_READ_ROLES);
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
    // ORG-SRS-005 (issue #28) — sort whitelist: name → name,
    // createdAt → created_at; default createdAt/desc. Mapping to columns
    // happens in the repository layer (no client string interpolation).
    if (sort !== undefined && sort !== '' && !['name', 'createdAt'].includes(sort)) {
      filterError('sort', 'Sort không hợp lệ (name|createdAt)');
    }
    if (order !== undefined && order !== '' && !['asc', 'desc'].includes(order)) {
      filterError('order', 'Order không hợp lệ (asc|desc)');
    }
    const { entities, total } = await this.searchContractors.execute({
      status: status || undefined,
      search: search || undefined,
      scope: scope || undefined,
      limit: parsedLimit,
      offset: parsedOffset,
      eligibleOnly: eligibleFilter || undefined,
      sort: (sort || undefined) as 'name' | 'createdAt' | undefined,
      order: (order || undefined) as 'asc' | 'desc' | undefined,
    });
    return { data: toContractorListResponse(entities), total, limit: parsedLimit ?? 20, offset: parsedOffset ?? 0 };
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    requireRoles(req as unknown as { user?: { roles?: string[] } }, DIRECTORY_READ_ROLES);
    const { entity } = await this.getContractor.execute({ contractorId: id });
    return toContractorResponse(entity);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateContractorDto,
    @Req() req: Request,
  ) {
    const actor = assertAdmin(req);
    const meta = getMeta(req);
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity } = await this.updateContractor.execute({
      contractorId: id,
      code: dto.code,
      name: dto.name,
      contactName: dto.contactName,
      phone: dto.phone,
      email: dto.email,
      scope: dto.scope,
      status: dto.status,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toContractorResponse(entity);
  }

  /**
   * ORG-SRS-004 (issue #27) — lifecycle nhà thầu. PATCH /contractors/:id inline
   * status cũ vẫn hoạt động (backward-compat, deprecated — xem ENDPOINTS.md).
   * Action enum API layer, KHÔNG đổi enum DB.
   */
  @Patch(':id/status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeResourceStatusDto,
    @Req() req: Request,
  ) {
    const actor = assertAdmin(req);
    const meta = getMeta(req);
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity, alreadyInState, warning } = await this.transitionContractorStatus.execute({
      contractorId: id,
      action: dto.action,
      reason: dto.reason ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return {
      ...toContractorResponse(entity),
      alreadyInState,
      ...(warning !== undefined ? { warning } : {}),
    };
  }

  /**
   * ORG-SRS-004 (issue #27) — pre-check open work (UI confirm dialog), admin-only,
   * chỉ đếm, không chặn, không audit.
   */
  @Get(':id/open-work')
  async openWork(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertAdmin(req);
    return this.getContractorOpenWork.execute({ contractorId: id });
  }
}
