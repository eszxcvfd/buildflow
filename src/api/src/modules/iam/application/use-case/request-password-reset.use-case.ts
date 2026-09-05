import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { PASSWORD_RESET_REPOSITORY, PasswordResetRepositoryPort } from '../../domain/repository/password-reset.repository.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { TRANSACTION_PORT, TransactionPort } from '../port/transaction.port';

export interface RequestPasswordResetInput {
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface RequestPasswordResetOutput {
  /** Always the same generic message (anti-enumeration). Never carries a reset link. */
  message: string;
}

export const RESET_TOKEN_TTL_MINUTES = 30;

/** Internal sentinel: thrown inside the tx callback to force ROLLBACK of the dummy write. */
class DummyWriteRollback extends Error {}

// Fixed dummy hash (SHA-256 of a constant). Never queried, only used to occupy the
// same write path; the tx is always rolled back so the unique index is never polluted.
const DUMMY_TOKEN_HASH = createHash('sha256').update('buildflow:password-reset:dummy-write').digest('hex');

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly resetRepo: PasswordResetRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<RequestPasswordResetOutput> {
    const generic = 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.';
    const normalized = input.email.trim().toLowerCase();
    const user = await this.userRepo.findByEmail(normalized);

    // Best-effort housekeeping: purge expired tokens on the request path.
    // Runs on EVERY branch → also contributes equalizing the write work per request.
    try {
      await this.resetRepo.deleteExpired();
    } catch { /* best-effort */ }

    if (user && user.isActive()) {
      // 48 hex chars = 192 bits entropy; stored only as SHA-256 hash
      const token = randomBytes(24).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
      await this.resetRepo.create({ userId: user.id, tokenHash, expiresAt });

      // Audit without any credential/token material
      try {
        await this.audit.log({
          actorUserId: user.id, action: 'IAM_PASSWORD_RESET_REQUESTED', entityType: 'USER', entityId: user.id,
          afterData: { expiresAt: expiresAt.toISOString() }, result: 'SUCCESS',
          ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        });
      } catch { /* best-effort */ }
    } else {
      // Unknown email: same generic response; audit without email existence hint
      try {
        await this.audit.log({
          actorUserId: null, action: 'IAM_PASSWORD_RESET_REQUESTED', entityType: 'USER', entityId: null,
          afterData: { reason: 'unknown_or_inactive' }, result: 'SUCCESS',
          ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        });
      } catch { /* best-effort */ }

      // Timing side-channel hardening (IAM-SRS-007): the unknown/inactive branch must
      // perform a write of equivalent cost to the token-issuing branch.
      // The TransactionPort has no rollback-only API, so we run the dummy INSERT inside
      // withTransaction and throw a sentinel to trigger ROLLBACK (PgTransactionManager
      // rolls back on any callback error). For an unknown email the dummy user_id fails
      // the FK check → the statement errors → ROLLBACK as well; either way the request
      // still consumes a BEGIN/INSERT/ROLLBACK write transaction like the success path.
      // NOTE: any error here is swallowed — response must stay generic (best-effort).
      await this.dummyWriteWithRollback(user ? user.id : randomUUID()).catch(() => { /* best-effort */ });
    }

    return { message: generic };
  }

  /**
   * Dummy INSERT into password_reset_tokens inside a transaction, then force ROLLBACK.
   * Never persists anything; exists purely to balance the write timing between branches.
   */
  private async dummyWriteWithRollback(userId: string): Promise<void> {
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await this.tx.withTransaction(async (client) => {
      await client.query(
        `INSERT INTO public.password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, DUMMY_TOKEN_HASH, expiresAt],
      );
      throw new DummyWriteRollback();
    }).catch((e: unknown) => {
      if (e instanceof DummyWriteRollback) return;
      // FK violation (unknown email → user_id does not exist) also lands here: the tx
      // has already been rolled back by the transaction manager. Swallow silently.
    });
  }
}
