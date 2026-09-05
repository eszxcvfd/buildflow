import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PoolClient } from 'pg';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { PASSWORD_RESET_REPOSITORY, PasswordResetRepositoryPort } from '../../domain/repository/password-reset.repository.port';
import { HASHER_PORT, HasherPort } from '../port/hasher.port';
import { TOKEN_REVOCATION_PORT, TokenRevocationPort } from '../port/token-revocation.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../port/transaction.port';
import { validatePasswordPolicy } from '../../domain/service/password.policy';
import { loadConfig } from '../../../../config/configuration';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly resetRepo: PasswordResetRepositoryPort,
    @Inject(HASHER_PORT) private readonly hasher: HasherPort,
    @Inject(TOKEN_REVOCATION_PORT) private readonly revocation: TokenRevocationPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: ResetPasswordInput): Promise<{ reauthRequired: boolean }> {
    const policy = validatePasswordPolicy(input.newPassword);
    if (!policy.ok) throw new BadRequestException({ message: 'Mật khẩu mới không đáp ứng chính sách', errors: policy.errors });

    const tokenHash = createHash('sha256').update(input.token).digest('hex');
    const record = await this.resetRepo.findLatestUsableByHash(tokenHash);
    if (!record) {
      await this.auditFailed(input, null, 'invalid_or_expired');
      throw new UnauthorizedException('Link đặt lại không hợp lệ hoặc đã hết hạn');
    }

    const config = loadConfig();
    const now = new Date();
    const changedAt = now;

    // Conditional UPDATE inside tx enforces one-time semantics under concurrency:
    // only the first claimer flips used_at from NULL; losers see 0 rows and abort.
    await this.tx.withTransaction(async (client: PoolClient) => {
      const claimed = await client.query(
        `UPDATE public.password_reset_tokens SET used_at = $2 WHERE id = $1 AND used_at IS NULL RETURNING id`,
        [record.id, now],
      );
      if (claimed.rowCount === 0) {
        // Lost the race: token already consumed by another request.
        await this.auditFailed(input, record.userId, 'already_used');
        throw new UnauthorizedException('Link đặt lại không hợp lệ hoặc đã hết hạn');
      }
      if (this.userRepo.updatePasswordHash) {
        const updated = await this.userRepo.updatePasswordHash(record.userId, await this.hasher.hash(input.newPassword), changedAt, client);
        if (updated === 0) {
          // User row disappeared mid-transaction — refuse instead of silently succeeding.
          await this.auditFailed(input, record.userId, 'user_missing');
          throw new UnauthorizedException('Link đặt lại không hợp lệ hoặc đã hết hạn');
        }
      } else {
        throw new Error('User repository does not support password updates');
      }
      // Void any other outstanding tokens for this user
      await this.resetRepo.invalidateAllForUser(record.userId, now, client);
      if (this.audit.logWithClient) {
        await this.audit.logWithClient(client, {
          actorUserId: record.userId, action: 'IAM_PASSWORD_RESET_COMPLETED', entityType: 'USER', entityId: record.userId,
          result: 'SUCCESS', ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        });
      }
    });

    const ttlMs = parseExpiryMs(config.jwtExpiresIn);
    if (this.revocation.revokeAllForUserBefore) {
      await this.revocation.revokeAllForUserBefore(record.userId, changedAt, ttlMs);
    }

    return { reauthRequired: true };
  }

  /**
   * Best-effort FAILED audit for every rejected reset attempt.
   * NEVER logs the token value or its hash — only a coarse reason code.
   * Uses audit.log (own connection) so the FAILED entry survives the tx rollback.
   */
  private async auditFailed(input: ResetPasswordInput, actorUserId: string | null, reason: string): Promise<void> {
    try {
      await this.audit.log({
        actorUserId, action: 'IAM_PASSWORD_RESET_FAILED', entityType: 'USER', entityId: actorUserId,
        afterData: { reason }, result: 'FAILED',
        ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null,
        correlationId: input.correlationId ?? null,
      });
    } catch { /* best-effort */ }
  }
}

function parseExpiryMs(v: string): number {
  const m = /^(\d+)([smhd])$/.exec(v.trim());
  const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return m ? parseInt(m[1], 10) * mult[m[2]] : 3_600_000;
}
