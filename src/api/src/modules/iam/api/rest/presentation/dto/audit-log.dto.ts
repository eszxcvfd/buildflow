export class AuditLogResponseDto {
  id!: string;
  actorUserId!: string | null;
  action!: string;
  entityType!: string;
  entityId!: string | null;
  beforeData!: unknown | null;
  afterData!: unknown | null;
  result!: string;
  ipAddress!: string | null;
  userAgent!: string | null;
  correlationId!: string | null;
  createdAt!: string;
}
