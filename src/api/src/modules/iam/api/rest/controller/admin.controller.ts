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
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { CreateUserDto, UpdateUserDto, UpdateUserStatusDto } from '../presentation/dto/admin-user.dto';
import { toAdminUserResponse, toAdminUserListResponse } from '../presentation/mapper/admin-user.mapper';
import { CreateUserUseCase } from '../../../application/use-case/create-user.use-case';
import { UpdateUserUseCase } from '../../../application/use-case/update-user.use-case';
import { ChangeUserStatusUseCase } from '../../../application/use-case/change-user-status.use-case';
import { ListUsersUseCase, GetUserUseCase } from '../../../application/use-case/list-users.use-case';
import { TokenPayload } from '../../../application/port/token.port';

function assertAdmin(req: Request): TokenPayload {
  const user = (req as unknown as { user: TokenPayload }).user;
  if (!user) {
    throw new ForbiddenException('Không có quyền truy cập');
  }
  const roles = user.roles ?? [];
  if (!roles.includes('ADMIN')) {
    throw new ForbiddenException('Không có quyền truy cập');
  }
  return user;
}

function getRequestMeta(req: Request): { ip: string | null; userAgent: string | null; correlationId: string | null } {
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

@Controller('api/v1/admin/users')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly changeStatus: ChangeUserStatusUseCase,
    private readonly listUsers: ListUsersUseCase,
    private readonly getUser: GetUserUseCase,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateUserDto, @Req() req: Request) {
    const actor = assertAdmin(req);
    const meta = getRequestMeta(req);
    const { entity } = await this.createUser.execute({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      avatarUrl: dto.avatarUrl ?? null,
      employeeCode: dto.employeeCode ?? null,
      userType: dto.userType as 'STAFF' | 'WORKER' | undefined,
      contractorId: dto.contractorId ?? null,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminUserResponse(entity);
  }

  @Get()
  async list(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') limitOffset?: string,
  ) {
    assertAdmin(req);
    const ALLOWED = new Set(['ACTIVE', 'LOCKED', 'INACTIVE']);
    if (status !== undefined && status !== '') {
      if (!ALLOWED.has(status)) {
        throw new BadRequestException('Trạng thái không hợp lệ');
      }
    }
    let parsedLimit = 20;
    if (limit !== undefined && limit !== '') {
      parsedLimit = Number(limit);
      if (!Number.isInteger(parsedLimit) || Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        throw new BadRequestException('Limit không hợp lệ (1-100)');
      }
    }
    let parsedOffset = 0;
    if (limitOffset !== undefined && limitOffset !== '') {
      parsedOffset = Number(limitOffset);
      if (!Number.isInteger(parsedOffset) || Number.isNaN(parsedOffset) || parsedOffset < 0) {
        throw new BadRequestException('Offset không hợp lệ (phải >= 0)');
      }
    }
    const { entities } = await this.listUsers.execute({
      status: status || undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    });
    return toAdminUserListResponse(entities);
  }

  @Get(':id')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertAdmin(req);
    const { entity } = await this.getUser.execute({ userId: id });
    return toAdminUserResponse(entity);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ) {
    const actor = assertAdmin(req);
    const meta = getRequestMeta(req);
    const { entity } = await this.updateUser.execute({
      targetUserId: id,
      email: dto.email,
      fullName: dto.fullName,
      phone: dto.phone,
      avatarUrl: dto.avatarUrl,
      employeeCode: dto.employeeCode,
      userType: dto.userType as 'STAFF' | 'WORKER' | undefined,
      contractorId: dto.contractorId,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminUserResponse(entity);
  }

  @Patch(':id/status')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserStatusDto,
    @Req() req: Request,
  ) {
    const actor = assertAdmin(req);
    const meta = getRequestMeta(req);
    // correlation_id in audit_logs is uuid-typed: a non-UUID header must be rejected
    // as 400 with an actionable message instead of surfacing as a 500 audit-insert
    // failure (same strict pattern as admin-roles.controller.ts).
    if (meta.correlationId && !UUID_RE.test(meta.correlationId)) {
      throw new BadRequestException(
        'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
      );
    }
    const { entity } = await this.changeStatus.execute({
      targetUserId: id,
      status: dto.status,
      actorUserId: actor.sub,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
    });
    return toAdminUserResponse(entity);
  }
}
