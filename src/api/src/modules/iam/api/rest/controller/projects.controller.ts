import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../guard/jwt-auth.guard';
import { GetProjectUseCase } from '../../../application/use-case/get-project.use-case';
import { ListProjectsUseCase } from '../../../application/use-case/list-projects.use-case';
import { toProjectResponse, toProjectListResponse } from '../presentation/mapper/project.mapper';
import { TokenPayload } from '../../../application/port/token.port';

@Controller('api/v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly getProject: GetProjectUseCase,
    private readonly listProjects: ListProjectsUseCase,
  ) {}

  @Get()
  async list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const user = (req as unknown as { user: TokenPayload }).user;
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

    const { entities } = await this.listProjects.execute({
      userId: user.sub,
      actorRoles: user.roles ?? [],
      limit: parsedLimit,
      offset: parsedOffset,
    });

    return toProjectListResponse(entities);
  }

  @Get(':id')
  async getOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Req() req: Request,
  ) {
    const user = (req as unknown as { user: TokenPayload }).user;
    const ip = (req.headers['x-forwarded-for'] as string) || req.ip || null;
    const userAgent = (req.headers['user-agent'] as string) || null;
    const correlationId = (req.headers['x-correlation-id'] as string) || null;

    const { entity } = await this.getProject.execute({
      projectId: id,
      userId: user.sub,
      actorRoles: user.roles ?? [],
      correlationId,
      ipAddress: ip ? String(ip).split(',')[0].trim() : null,
      userAgent: userAgent ?? null,
    });

    return toProjectResponse(entity);
  }
}
