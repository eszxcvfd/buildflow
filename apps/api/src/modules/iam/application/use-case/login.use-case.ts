import { Inject, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user.repository.port';
import { UserEntity } from '../../domain/entity/user.entity';
import { HASHER_PORT, HasherPort } from '../port/hasher.port';
import { TOKEN_PORT, TokenPort } from '../port/token.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { LOGIN_LIMITER_PORT, LoginLimiterPort } from '../port/login-limiter.port';

export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginOutput {
  accessToken: string;
  expiresAt: Date;
  user: { id: string; email: string; fullName: string; status: string };
  roles: Array<{ id: string; code: string; name: string }>;
  projectIds: string[];
}

export const GENERIC_INVALID_MSG = 'Thông tin đăng nhập không hợp lệ';
export const ACCOUNT_LOCKED_MSG = 'Tài khoản bị khóa, thử lại sau';

const LOGIN_MAX_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;
const LIMITER_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(HASHER_PORT) private readonly hasher: HasherPort,
    @Inject(TOKEN_PORT) private readonly tokenPort: TokenPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(LOGIN_LIMITER_PORT) private readonly limiter: LoginLimiterPort,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = new Date();
    const limiterKey = `${input.ipAddress ?? 'unknown'}:${normalizedEmail}`;

    if (await this.limiter.isBlocked(limiterKey)) {
      await this.auditLog(null, 'AUTH_LOGIN_BLOCKED', normalizedEmail, input, 'FAILED', { reason: 'rate_limited' });
      throw new ForbiddenException(ACCOUNT_LOCKED_MSG);
    }

    const snapshot = await this.userRepo.findByEmail(normalizedEmail);
    if (!snapshot) {
      await this.limiter.recordFailure(limiterKey, LIMITER_WINDOW_SECONDS);
      await this.auditLog(null, 'AUTH_LOGIN_FAILED', normalizedEmail, input, 'FAILED', { reason: 'user_not_found' });
      throw new UnauthorizedException(GENERIC_INVALID_MSG);
    }

    const user = new UserEntity(snapshot);

    if (user.isInactive()) {
      await this.auditLog(user.id, 'AUTH_LOGIN_FAILED', user.email, input, 'FAILED', { reason: 'inactive' });
      throw new UnauthorizedException(GENERIC_INVALID_MSG);
    }

    user.clearExpiredLock(now);

    if (user.isCurrentlyLocked(now)) {
      await this.limiter.recordFailure(limiterKey, LIMITER_WINDOW_SECONDS);
      await this.auditLog(user.id, 'AUTH_LOGIN_FAILED', user.email, input, 'FAILED', { reason: 'locked' });
      throw new ForbiddenException(ACCOUNT_LOCKED_MSG);
    }

    const passwordValid = await this.hasher.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      const { locked } = user.recordFailedAttempt(now, LOGIN_MAX_ATTEMPTS, LOCK_DURATION_MINUTES);
      await this.userRepo.save(user.getSnapshot());
      await this.limiter.recordFailure(limiterKey, LIMITER_WINDOW_SECONDS);
      await this.auditLog(user.id, 'AUTH_LOGIN_FAILED', user.email, input, 'FAILED', {
        reason: 'invalid_password',
        failedLoginCount: user.failedLoginCount,
        locked,
      });
      throw new UnauthorizedException(GENERIC_INVALID_MSG);
    }

    user.resetFailedAttempts();
    await this.userRepo.save(user.getSnapshot());
    await this.limiter.reset(limiterKey);

    const roles = await this.userRepo.findRolesByUserId(user.id);
    const projectIds = await this.userRepo.findProjectIdsByUserId(user.id);
    const { token, expiresAt } = await this.tokenPort.sign({
      sub: user.id,
      email: user.email,
      roles: roles.map((r) => r.code),
      projectIds,
    });

    await this.auditLog(user.id, 'AUTH_LOGIN_SUCCESS', user.email, input, 'SUCCESS', { roles: roles.map((r) => r.code) });

    return {
      accessToken: token,
      expiresAt,
      user: { id: user.id, email: user.email, fullName: user.fullName, status: user.status },
      roles,
      projectIds,
    };
  }

  private async auditLog(
    actorUserId: string | null,
    action: string,
    email: string,
    input: LoginInput,
    result: 'SUCCESS' | 'FAILED',
    afterData: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.audit.log({
        actorUserId,
        action,
        entityType: 'USER',
        entityId: actorUserId,
        afterData: { email, ...afterData },
        result,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
    } catch {
      // Audit is best-effort; login correctness must not depend on it
    }
  }
}
