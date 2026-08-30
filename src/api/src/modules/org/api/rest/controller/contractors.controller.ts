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
import { CreateContractorUseCase } from '../../../application/use-case/create-contractor.use-case';
import { UpdateContractorUseCase } from '../../../application/use-case/update-contractor.use-case';
import { GetContractorUseCase } from '../../../application/use-case/get-contractor.use-case';
import { SearchContractorsUseCase } from '../../../application/use-case/search-contractors.use-case';
import { CreateContractorDto, UpdateContractorDto } from '../presentation/dto/contractor.dto';
import { toContractorResponse, toContractorListResponse } from '../presentation/mapper/contractor.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';

function assertAdmin(req: Request): TokenPayload {
  const user = (req as unknown as { user: TokenPayload }).user;
  if (!user) throw new ForbiddenException('Không có quyền truy cập');
  if (!user.roles?.includes('ADMIN')) throw new ForbiddenException('Không có quyền truy cập');
  return user;
}

function getMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
  const userAgent = (req.headers['user-agent'] as string) || null;
  return { ip: ip ? String(ip).split(',')[0].trim() : null, userAgent: userAgent ?? null };
}

@Controller('api/v1/contractors')
@UseGuards(JwtAuthGuard)
export class ContractorsController {
  constructor(
    private readonly createContractor: CreateContractorUseCase,
    private readonly updateContractor: UpdateContractorUseCase,
    private readonly getContractor: GetContractorUseCase,
    private readonly searchContractors: SearchContractorsUseCase,
  ) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async create(@Body() dto: CreateContractorDto, @Req() req: Request) {
    const actor = assertAdmin(req);
    const meta = getMeta(req);
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
    });
    return toContractorResponse(entity);
  }

  @Get()
  async search(
    @Req() req: Request,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('scope') scope?: string,
    @Query('eligibleOnly') eligibleOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    assertAdmin(req);
    if (status && !['ACTIVE', 'INACTIVE'].includes(status)) {
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
    const eligibleFilter = eligibleOnly === 'true' || eligibleOnly === '1';
    if (eligibleFilter && status === 'INACTIVE') {
      throw new BadRequestException('Không thể lọc eligibleOnly với INACTIVE');
    }
    const { entities, total } = await this.searchContractors.execute({
      status: status || undefined,
      search: search || undefined,
      scope: scope || undefined,
      limit: parsedLimit,
      offset: parsedOffset,
      eligibleOnly: eligibleFilter || undefined,
    });
    return { data: toContractorListResponse(entities), total, limit: parsedLimit ?? 20, offset: parsedOffset ?? 0 };
  }

  @Get(':id')
  async getOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    assertAdmin(req);
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
    });
    return toContractorResponse(entity);
  }
}
