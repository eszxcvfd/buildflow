import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Req,
  Res,
  Header,
  HttpCode,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../../iam/api/rest/guard/jwt-auth.guard';
import { UploadAttachmentUseCase } from '../../../application/use-case/upload-attachment.use-case';
import {
  ListAttachmentsUseCase,
  DownloadAttachmentUseCase,
  RetireAttachmentUseCase,
} from '../../../application/use-case/attachment-read-retire.use-case';
import {
  UploadAttachmentBodyDto,
  RetireAttachmentDto,
} from '../presentation/dto/attachment.dto';
import {
  toAttachmentResponse,
  toAttachmentListResponse,
} from '../presentation/mapper/attachment.mapper';
import { TokenPayload } from '../../../../iam/application/port/token.port';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shape tối thiểu của file qua memory storage (không phụ thuộc @types/multer). */
interface MemoryFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * PRJ-SRS-009 (issue #40) — actor server-derived từ JWT. KHÔNG gate global
 * role ở đây: upload/retire enforce project-write-scope, list/download
 * enforce project-member-scope trong use case (403 khi ngoài scope).
 */
function attachmentActor(req: Request): TokenPayload {
  return (req as unknown as { user: TokenPayload }).user;
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
  // Strict X-Correlation-Id (precedent prj writes): header sai UUID → 400
  // actionable thay vì 500 audit-insert (audit_logs.correlation_id uuid-typed).
  if (correlationId && !UUID_RE.test(correlationId)) {
    throw new BadRequestException(
      'X-Correlation-Id phải là UUID hợp lệ (audit_logs.correlation_id là uuid-typed)',
    );
  }
}

/**
 * `Content-Disposition: attachment` với filename an toàn: tên đã sanitize lúc
 * upload (không path separator/control chars) + quote + RFC 5987 fallback cho
 * Unicode. Không lộ storageKey/path vật lý.
 */
function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function actorInput(req: Request): {
  actorUserId: string;
  actorRoles: string[];
  ip: string | null;
  userAgent: string | null;
  correlationId: string | null;
} {
  const actor = attachmentActor(req);
  const meta = getMeta(req);
  return {
    actorUserId: actor.sub,
    actorRoles: actor.roles ?? [],
    ip: meta.ip,
    userAgent: meta.userAgent,
    correlationId: meta.correlationId,
  };
}

/**
 * PRJ-SRS-009 (issue #40) — attachments project-scope.
 * - `POST /api/v1/projects/:id/attachments` (multipart `file` + `caption?` +
 *   `requestKey?`): multer memory storage mặc định (buffer, chưa chạm disk)
 *   → validate server-side (size/mime/magic/tên) → ghi disk → DB tx. KHÔNG
 *   dùng diskStorage: validate và requestKey-replay check chạy TRƯỚC khi
 *   chạm disk (replay không ghi file mới; file quá hạn/không phê duyệt không
 *   bao giờ xuống disk).
 * - `GET /api/v1/projects/:id/attachments`: metadata cả active + inactive.
 * - `GET .../:attId/content`: stream bytes, `Content-Disposition: attachment`.
 * - `PATCH .../:attId/retire {reason?}`: soft-retire, idempotent.
 */
@Controller('api/v1/projects')
@UseGuards(JwtAuthGuard)
export class ProjectAttachmentsController {
  constructor(
    private readonly uploadAttachment: UploadAttachmentUseCase,
    private readonly listAttachments: ListAttachmentsUseCase,
    private readonly downloadAttachment: DownloadAttachmentUseCase,
    private readonly retireAttachment: RetireAttachmentUseCase,
  ) {}

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async upload(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) projectId: string,
    @UploadedFile() file: MemoryFile | undefined,
    @Body() dto: UploadAttachmentBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const a = actorInput(req);
    assertStrictCorrelationId(a.correlationId);
    if (!file || !file.buffer) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Vui lòng chọn tệp đính kèm',
        fieldErrors: { file: ['Vui lòng chọn tệp đính kèm'] },
      });
    }
    const { entity, idempotentReplay } = await this.uploadAttachment.execute({
      projectId,
      file: { buffer: file.buffer, originalName: file.originalname, mimeType: file.mimetype },
      caption: dto.caption ?? null,
      requestKey: dto.requestKey ?? null,
      actorUserId: a.actorUserId,
      actorRoles: a.actorRoles,
      ipAddress: a.ip,
      userAgent: a.userAgent,
      correlationId: a.correlationId,
    });
    res.status(idempotentReplay ? 200 : 201);
    return toAttachmentResponse(entity, idempotentReplay ? { idempotentReplay: true } : {});
  }

  @Get(':id/attachments')
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) projectId: string,
    @Req() req: Request,
  ) {
    const a = actorInput(req);
    const { data } = await this.listAttachments.execute({
      projectId,
      actorUserId: a.actorUserId,
      actorRoles: a.actorRoles,
      ipAddress: a.ip,
      userAgent: a.userAgent,
      correlationId: a.correlationId,
    });
    return toAttachmentListResponse(data);
  }

  @Get(':id/attachments/:attId/content')
  async download(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) projectId: string,
    @Param('attId', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) attId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const a = actorInput(req);
    const { entity, data } = await this.downloadAttachment.execute({
      projectId,
      attachmentId: attId,
      actorUserId: a.actorUserId,
      actorRoles: a.actorRoles,
      ipAddress: a.ip,
      userAgent: a.userAgent,
      correlationId: a.correlationId,
    });
    res.set({
      'Content-Type': entity.mimeType,
      'Content-Length': String(data.length),
      'Content-Disposition': contentDisposition(entity.fileName),
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(data);
  }

  @Patch(':id/attachments/:attId/retire')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async retire(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) projectId: string,
    @Param('attId', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) attId: string,
    @Body() dto: RetireAttachmentDto,
    @Req() req: Request,
  ) {
    const a = actorInput(req);
    assertStrictCorrelationId(a.correlationId);
    const { entity, alreadyInactive } = await this.retireAttachment.execute({
      projectId,
      attachmentId: attId,
      reason: dto.reason ?? null,
      actorUserId: a.actorUserId,
      actorRoles: a.actorRoles,
      ipAddress: a.ip,
      userAgent: a.userAgent,
      correlationId: a.correlationId,
    });
    return toAttachmentResponse(entity, alreadyInactive ? { alreadyInactive: true } : {});
  }
}

/**
 * PRJ-SRS-009 (issue #40) — WO extension (cùng bảng + cùng scope service, rẻ
 * vì chỉ resolve `project_id` từ WO rồi delegate cùng use case). Route đặt
 * trong prj module (owner slice) thay vì job module — job không cần đổi.
 * - `POST /api/v1/work-orders/:id/attachments` (multipart, mirror project)
 * - `GET /api/v1/work-orders/:id/attachments` (metadata list của WO)
 * - `GET .../:attId/content` (stream; att phải thuộc WO trên path)
 * - `PATCH .../:attId/retire {reason?}` (soft-retire, idempotent)
 */
@Controller('api/v1/work-orders')
@UseGuards(JwtAuthGuard)
export class WorkOrderAttachmentsController {
  constructor(
    private readonly uploadAttachment: UploadAttachmentUseCase,
    private readonly listAttachments: ListAttachmentsUseCase,
    private readonly downloadAttachment: DownloadAttachmentUseCase,
    private readonly retireAttachment: RetireAttachmentUseCase,
  ) {}

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file'))
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async upload(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) workOrderId: string,
    @UploadedFile() file: MemoryFile | undefined,
    @Body() dto: UploadAttachmentBodyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const a = actorInput(req);
    assertStrictCorrelationId(a.correlationId);
    if (!file || !file.buffer) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Vui lòng chọn tệp đính kèm',
        fieldErrors: { file: ['Vui lòng chọn tệp đính kèm'] },
      });
    }
    const { entity, idempotentReplay } = await this.uploadAttachment.execute({
      workOrderId,
      file: { buffer: file.buffer, originalName: file.originalname, mimeType: file.mimetype },
      caption: dto.caption ?? null,
      requestKey: dto.requestKey ?? null,
      actorUserId: a.actorUserId,
      actorRoles: a.actorRoles,
      ipAddress: a.ip,
      userAgent: a.userAgent,
      correlationId: a.correlationId,
    });
    res.status(idempotentReplay ? 200 : 201);
    return toAttachmentResponse(entity, idempotentReplay ? { idempotentReplay: true } : {});
  }

  @Get(':id/attachments')
  @Header('Cache-Control', 'no-store')
  async list(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) workOrderId: string,
    @Req() req: Request,
  ) {
    const a = actorInput(req);
    const { data } = await this.listAttachments.execute({
      workOrderId,
      actorUserId: a.actorUserId,
      actorRoles: a.actorRoles,
      ipAddress: a.ip,
      userAgent: a.userAgent,
      correlationId: a.correlationId,
    });
    return toAttachmentListResponse(data);
  }

  @Get(':id/attachments/:attId/content')
  async download(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) workOrderId: string,
    @Param('attId', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) attId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const a = actorInput(req);
    const { entity, data } = await this.downloadAttachment.execute({
      workOrderId,
      attachmentId: attId,
      actorUserId: a.actorUserId,
      actorRoles: a.actorRoles,
      ipAddress: a.ip,
      userAgent: a.userAgent,
      correlationId: a.correlationId,
    });
    res.set({
      'Content-Type': entity.mimeType,
      'Content-Length': String(data.length),
      'Content-Disposition': contentDisposition(entity.fileName),
      'Cache-Control': 'no-store',
    });
    return new StreamableFile(data);
  }

  @Patch(':id/attachments/:attId/retire')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async retire(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) workOrderId: string,
    @Param('attId', new ParseUUIDPipe({ errorHttpStatusCode: 400 })) attId: string,
    @Body() dto: RetireAttachmentDto,
    @Req() req: Request,
  ) {
    const a = actorInput(req);
    assertStrictCorrelationId(a.correlationId);
    const { entity, alreadyInactive } = await this.retireAttachment.execute({
      workOrderId,
      attachmentId: attId,
      reason: dto.reason ?? null,
      actorUserId: a.actorUserId,
      actorRoles: a.actorRoles,
      ipAddress: a.ip,
      userAgent: a.userAgent,
      correlationId: a.correlationId,
    });
    return toAttachmentResponse(entity, alreadyInactive ? { alreadyInactive: true } : {});
  }
}
