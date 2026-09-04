import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { PASSWORD_RESET_REPOSITORY, PasswordResetRepositoryPort } from '../../domain/repository/password-reset.repository.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { loadConfig } from '../../../../config/configuration';

export interface RequestPasswordResetInput {
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface RequestPasswordResetOutput {
  /** Always the same generic message (anti-enumeration). */
  message: string;
  /** Only set when reset delivery is not configured (demo/dev): allows manual token handoff. */
  resetUrl?: string;
}

export const RESET_TOKEN_TTL_MINUTES = 30;

@Injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(PASSWORD_RESET_REPOSITORY) private readonly resetRepo: PasswordResetRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<RequestPasswordResetOutput> {
    const generic = 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.';
    const normalized = input.email.trim().toLowerCase();
    const config = loadConfig();
    const user = await this.userRepo.findByEmail(normalized);

    let resetUrl: string | undefined;
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
        });
      } catch { /* best-effort */ }

      // No mail provider configured yet (SRS Should): expose reset URL for demo/dev only,
      // production would send via email service. Token never logged.
      if (config.jwtSecret.startsWith('dev-')) {
        const webBase = process.env.WEB_BASE_URL ?? 'http://localhost:3001';
        resetUrl = `${webBase}/reset-password?token=${token}`;
      }
    } else {
      // Unknown email: same generic response; audit without email existence hint
      try {
        await this.audit.log({
          actorUserId: null, action: 'IAM_PASSWORD_RESET_REQUESTED', entityType: 'USER', entityId: null,
          afterData: { reason: 'unknown_or_inactive' }, result: 'SUCCESS',
          ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null,
        });
      } catch { /* best-effort */ }
    }

    return { message: generic, resetUrl };
  }
}
