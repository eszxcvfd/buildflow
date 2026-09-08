import {
  Controller,
  Get,
  Param,
  Req,
  Header,
  UseGuards,
  ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { CheckWorkOrderPublishUseCase } from '../../../application/use-case/check-work-order-publish.use-case';
import { toPublishCheckResponse } from '../presentation/dto/work-order-publish-check.dto';
import { TokenPayload } from '../../../../iam/application/port/token.port';

/**
 * JOB-SRS-002 (issue #42) — actor server-derived từ JWT (`JwtAuthGuard` đã
 * gắn `req.user`). Scope trong use case (mirror `GET :id`).
 */
function publishCheckActor(req: Request): TokenPayload {
  const actor = (req as unknown as { user?: TokenPayload }).user;
  if (!actor || !actor.sub) {
    throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');
  }
  return actor;
}

/**
 * JOB-SRS-002 (issue #42) — kiểm tra điều kiện công bố Work Order.
 * - `GET /api/v1/work-orders/:id/publish-check`: read-scope như `GET :id`
 *   (ADMIN bypass hoặc bất kỳ ACTIVE member nào; non-member 403 kể cả id
 *   không tồn tại; ADMIN + missing → 404; id sai → 400; anon → 401).
 * - Advisory read-only: không mutate, không audit nghiệp vụ, `no-store`.
 *   Gate thật tái dùng ở #44/#47 (publish/assign re-check server-side).
 */
@Controller('api/v1/work-orders')
@UseGuards(JwtAuthGuard)
export class WorkOrderPublishCheckController {
  constructor(private readonly checkPublish: CheckWorkOrderPublishUseCase) {}

  @Get(':id/publish-check')
  @Header('Cache-Control', 'no-store')
  async check(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) id: string,
    @Req() req: Request,
  ) {
    const actor = publishCheckActor(req);
    const result = await this.checkPublish.execute({
      workOrderId: id,
      actorUserId: actor.sub,
      actorRoles: actor.roles ?? [],
      ipAddress: ((req.headers['x-forwarded-for'] as string) || req.ip || null)
        ? String((req.headers['x-forwarded-for'] as string) || req.ip).split(',')[0].trim()
        : null,
      userAgent: (req.headers['user-agent'] as string) || null,
      correlationId: (req.headers['x-correlation-id'] as string) || null,
    });
    return toPublishCheckResponse(result);
  }
}
