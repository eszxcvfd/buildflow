import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { PASSWORD_RESET_REPOSITORY, PasswordResetRepositoryPort } from '../../domain/repository/password-reset.repository.port';
import { HASHER_PORT, HasherPort } from '../port/hasher.port';
import { TOKEN_PORT, TokenPort } from '../port/token.port';
import { TOKEN_REVOCATION_PORT, TokenRevocationPort } from '../port/token-revocation.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../port/transaction.port';
import { validatePasswordPolicy } from '../../domain/service/password.policy';
import { loadConfig } from '../../../../config/configuration';

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface ChangePasswordOutput {
  reauthRequired: boolean;
  passwordChangedAt: Date;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly resetRepo: PasswordResetRepositoryPort,
    @Inject(HASHER_PORT) private readonly hasher: HasherPort,
    @Inject(TOKEN_PORT) private readonly tokenPort: TokenPort,
    @Inject(TOKEN_REVOCATION_PORT) private readonly revocation: TokenRevocationPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: ChangePasswordInput): Promise<ChangePasswordOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) throw new UnauthorizedException('Phiên hết hạn, vui lòng đăng nhập lại');

    const currentOk = await this.hasher.compare(input.currentPassword, user.passwordHash);
    if (!currentOk) {
      try {
        await this.audit.log({
          actorUserId: user.id, action: 'IAM_PASSWORD_CHANGE_FAILED', entityType: 'USER', entityId: user.id,
          afterData: { reason: 'wrong_current_password' }, result: 'FAILED',
          ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null,
        });
      } catch { /* best-effort */ }
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    const policy = validatePasswordPolicy(input.newPassword);
    if (!policy.ok) throw new BadRequestException({ message: 'Mật khẩu mới không đáp ứng chính sách', errors: policy.errors });

    // Config for cutoff TTL: max session lifetime bounds revocation memory
    const config = loadConfig();
    const now = new Date();
    const changedAt = now;

    await this.tx.withTransaction(async (client: PoolClient) => {
      if (this.userRepo.updatePasswordHash) {
        await this.userRepo.updatePasswordHash(user.id, await this.hasher.hash(input.newPassword), changedAt, client);
      } else {
        throw new Error('User repository does not support password updates');
      }
      // One-time reset tokens are voided on password change
      await this.resetRepo.invalidateAllForUser(user.id, now, client);
      if (this.audit.logWithClient) {
        await this.audit.logWithClient(client, {
          actorUserId: user.id, action: 'IAM_PASSWORD_CHANGED', entityType: 'USER', entityId: user.id,
          result: 'SUCCESS', ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null,
        });
      } else {
        await this.audit.log({ actorUserId: user.id, action: 'IAM_PASSWORD_CHANGED', entityType: 'USER', entityId: user.id, result: 'SUCCESS' });
      }
    });

    // Invalidate sessions issued before the change (cutoff = changedAt).
    // Max TTL bounds the in-memory cutoff lifetime; natural token expiry handles the rest.
    const ttlMs = parseExpiryMs(config.jwtExpiresIn);
    if (this.revocation.revokeAllForUserBefore) {
      await this.revocation.revokeAllForUserBefore(user.id, changedAt, ttlMs);
    }

    return { reauthRequired: true, passwordChangedAt: changedAt };
  }
}

function parseExpiryMs(v: string): number {
  const m = /^(\d+)([smhd])$/.exec(v.trim());
  const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return m ? parseInt(m[1], 10) * mult[m[2]] : 3_600_000;
}
