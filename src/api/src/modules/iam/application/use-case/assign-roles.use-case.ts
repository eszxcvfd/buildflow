import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { ROLE_REPOSITORY, RoleRepositoryPort } from '../../domain/repository/role-repository.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../port/transaction.port';

export interface AssignRolesInput {
  targetUserId: string;
  roleIds: string[];
  actorUserId: string;
  actorRoles: string[]; // server-derived roles, never trust UI payload
  correlationId?: string | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AssignRolesOutput {
  targetUserId: string;
  beforeRoleIds: string[];
  afterRoleIds: string[];
  roles: Array<{ id: string; code: string; name: string }>;
  effectivePolicy: string;
}

@Injectable()
export class AssignRolesUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(ROLE_REPOSITORY) private readonly roleRepo: RoleRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: AssignRolesInput): Promise<AssignRolesOutput> {
    // Server-side authorization: every mutation checks admin privilege server-side
    if (!input.actorRoles.includes('ADMIN')) {
      throw new ForbiddenException('Không có quyền truy cập');
    }

    const target = await this.userRepo.findById(input.targetUserId);
    if (!target) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    // Normalize: trim, dedupe, remove empty
    const deduped = [...new Set((input.roleIds ?? []).map((id) => String(id).trim()).filter(Boolean))];

    // Business rule: policy requires >=1 role -> empty list must be rejected with no partial save
    // Per IAM-SRS-005: danh sách rỗng nếu policy yêu cầu ≥1 role → không lưu một phần
    if (deduped.length === 0) {
      throw new BadRequestException('Danh sách role không được để trống (policy yêu cầu ≥1 role)');
    }

    // Validate UUID format early
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const id of deduped) {
      if (!uuidRegex.test(id)) {
        throw new BadRequestException(`Role ID không hợp lệ: ${id}`);
      }
    }

    // Fetch roles and validate existence + active (only approved/active roles can be assigned)
    const roles = await this.roleRepo.findByIds(deduped);
    const foundMap = new Map(roles.map((r) => [r.id, r]));
    const missingOrInactive: string[] = [];
    for (const id of deduped) {
      const r = foundMap.get(id);
      if (!r || !r.isAssignable()) {
        missingOrInactive.push(id);
      }
    }
    if (missingOrInactive.length > 0) {
      throw new BadRequestException(
        `Role không tồn tại hoặc đã ngừng hoạt động: ${missingOrInactive.join(', ')}`,
      );
    }

    // Server-side privilege escalation guard: assignment must not create privilege beyond admin scope
    // Actor is ADMIN already, but we still prevent bypass: audit that check is server-derived
    // For future non-ADMIN assigners, this would additionally forbid assigning roles they don't possess
    // Currently: ADMIN can assign any approved role; non-ADMIN already blocked above
    // But we still enforce that if a role code is ADMIN and actor is not ADMIN -> forbidden (defense in depth)
    // Since ADMIN is required, this is satisfied, but we keep the check for auditability
    const requestedCodes = roles.map((r) => r.code);
    if (requestedCodes.includes('ADMIN') && !input.actorRoles.includes('ADMIN')) {
      throw new ForbiddenException('Không thể gán quyền vượt phạm vi admin');
    }

    let beforeRoleIds: string[] = [];
    let afterRoleIds: string[] = [];

    // Atomic mutation + audit in shared transaction per needsFix P1 #621398dd
    await this.tx.withTransaction(async (client: PoolClient) => {
      const now = new Date();

      // Capture before snapshot inside transaction (snapshot at BEGIN)
      if (this.roleRepo.findActiveRoleIdsByUserIdWithClient) {
        beforeRoleIds = await this.roleRepo.findActiveRoleIdsByUserIdWithClient(client, input.targetUserId);
      } else if (this.roleRepo.findActiveRoleIdsByUserId) {
        beforeRoleIds = await this.roleRepo.findActiveRoleIdsByUserId(input.targetUserId);
      } else {
        // fallback via userRepo
        const beforeRoles = await this.userRepo.findActiveRolesByUserId(input.targetUserId);
        beforeRoleIds = beforeRoles.map((r) => r.id);
      }

      // Sort for deterministic audit compare
      beforeRoleIds = [...beforeRoleIds].sort();
      afterRoleIds = [...deduped].sort();

      // Replace assignments atomically
      if (this.roleRepo.replaceUserRolesWithClient) {
        await this.roleRepo.replaceUserRolesWithClient(client, {
          userId: input.targetUserId,
          roleIds: deduped,
          actorUserId: input.actorUserId,
          now,
        });
      } else {
        // Fallback: direct SQL via client if repo lacks method (should not happen in prod)
        await client.query(
          `UPDATE public.user_roles SET is_active = false, revoked_by = $2, revoked_at = $3 WHERE user_id = $1 AND is_active = true`,
          [input.targetUserId, input.actorUserId, now],
        );
        for (const roleId of deduped) {
          await client.query(
            `INSERT INTO public.user_roles (id, user_id, role_id, assigned_by, assigned_at, is_active) VALUES (gen_random_uuid(), $1, $2, $3, $4, true)`,
            [input.targetUserId, roleId, input.actorUserId, now],
          );
        }
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'IAM_ROLE_ASSIGNED',
          entityType: 'USER',
          entityId: input.targetUserId,
          beforeData: {
            roleIds: beforeRoleIds,
            // IAM-SRS-005 before/after role assignment per spec
          },
          afterData: {
            roleIds: afterRoleIds,
            effectivePolicy: 'PERMISSION_EFFECTIVE_NEXT_LOGIN',
            reason: input.reason ?? null,
            correlationId: input.correlationId ?? null,
          },
          result: 'SUCCESS' as const,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        };
        if (this.audit.logWithClient) {
          await this.audit.logWithClient(client, payload);
        } else {
          await this.audit.log(payload);
        }
      } catch (e) {
        if (e instanceof BadRequestException || e instanceof NotFoundException || e instanceof ForbiddenException) throw e;
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    // Fetch full role details for response (post-commit read)
    const assignedRoles = roles
      .filter((r) => afterRoleIds.includes(r.id))
      .map((r) => ({ id: r.id, code: r.code, name: r.name }))
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      targetUserId: input.targetUserId,
      beforeRoleIds,
      afterRoleIds,
      roles: assignedRoles,
      // IAM-SRS-005: permission effective from next access per session policy; document clearly, no over-engineered invalidation
      effectivePolicy: 'PERMISSION_EFFECTIVE_NEXT_LOGIN: quyền mới có hiệu lực từ lần truy cập tiếp theo (yêu cầu đăng nhập lại / token mới nếu session cũ)',
    };
  }
}
