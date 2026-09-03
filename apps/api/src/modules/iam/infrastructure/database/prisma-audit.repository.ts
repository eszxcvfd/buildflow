import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { AuditPort, AuditLogParams } from '../../application/port/audit.port';

@Injectable()
export class PrismaAuditRepository implements AuditPort {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams): Promise<void> {
    await this.prisma.audit_logs.create({
      data: {
        actor_user_id: params.actorUserId ?? null,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId ?? null,
        after_data: params.afterData ? JSON.parse(JSON.stringify(params.afterData)) : undefined,
        result: params.result,
        ip_address: params.ipAddress ?? null,
        user_agent: params.userAgent ?? null,
      },
    });
  }
}
