import { Injectable, Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { HASHER_PORT, HasherPort } from '../port/hasher.port';
import { TOKEN_PORT, TokenPort } from '../port/token.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { loadConfig } from '../../../../config/configuration';

export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string | null;
}

export interface LoginOutput {
  accessToken: string;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    fullName: string;
    status: string;
    userType: string;
  };
  roles: Array<{ id: string; code: string; name: string }>;
  projectIds: string[];
}

const GENERIC_INVALID_MSG = 'Thông tin đăng nhập không hợp lệ';
const INACTIVE_MSG = 'Tài khoản đã ngừng hoạt động';
const LOCKED_MSG = 'Tài khoản đang bị khóa';

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(HASHER_PORT) private readonly hasher: HasherPort,
    @Inject(TOKEN_PORT) private readonly tokenPort: TokenPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const config = loadConfig();
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = new Date();

    const user = await this.userRepo.findByEmail(normalizedEmail);

    // Generic error to avoid disclosing existence
    if (!user) {
      try {
        await this.audit.log({
          actorUserId: null,
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'USER',
          entityId: null,
          afterData: { email: normalizedEmail, reason: 'user_not_found' },
          result: 'FAILED',
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        });
      } catch (_e) { void _e; }
      throw new UnauthorizedException(GENERIC_INVALID_MSG);
    }

    // Check inactive / locked status per SRS
    if (user.isInactive()) {
      try {
        await this.audit.log({
          actorUserId: user.id,
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'USER',
          entityId: user.id,
          afterData: { reason: 'inactive' },
          result: 'FAILED',
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        });
      } catch (_e) { void _e; }
      throw new ForbiddenException(INACTIVE_MSG);
    }

    // Auto-unlock expired temporary lock (distinguish manual LOCKED vs auto-lock with expiry)
    const hadExpiredLock = user.clearExpiredLock(now);
    if (hadExpiredLock) {
      await this.userRepo.save(user);
    }

    if (user.isCurrentlyLocked(now)) {
      try {
        await this.audit.log({
          actorUserId: user.id,
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'USER',
          entityId: user.id,
          afterData: { reason: 'locked', lockedUntil: user.lockedUntil },
          result: 'FAILED',
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        });
      } catch (_e) { void _e; }
      throw new ForbiddenException(LOCKED_MSG);
    }

    const passwordValid = await this.hasher.compare(input.password, user.passwordHash);

    if (!passwordValid) {
      const { locked } = user.recordFailedAttempt(now, config.loginMaxFailedAttempts, config.loginLockDurationMinutes);
      await this.userRepo.save(user);
      try {
        await this.audit.log({
          actorUserId: user.id,
          action: 'AUTH_LOGIN_FAILED',
          entityType: 'USER',
          entityId: user.id,
          afterData: {
            reason: 'invalid_password',
            failedLoginCount: user.failedLoginCount,
            locked,
            lockedUntil: user.lockedUntil ?? null,
          },
          result: 'FAILED',
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          correlationId: input.correlationId ?? null,
        });
      } catch (_e) { void _e; }
      // If just got locked, return locked message per alternate flow
      if (locked) {
        throw new ForbiddenException(LOCKED_MSG);
      }
      throw new UnauthorizedException(GENERIC_INVALID_MSG);
    }

    // Success path: reset failed counters, update lastLogin
    user.resetFailedAttempts(now);
    await this.userRepo.save(user);

    const roles = await this.userRepo.findActiveRolesByUserId(user.id);
    const projectIds = await this.userRepo.findActiveProjectIdsByUserId(user.id);

    const roleCodes = roles.map((r) => r.code);
    const { token, expiresAt } = await this.tokenPort.sign({
      sub: user.id,
      email: user.email,
      roles: roleCodes,
      projectIds,
    });

    try {
      await this.audit.log({
        actorUserId: user.id,
        action: 'AUTH_LOGIN_SUCCESS',
        entityType: 'USER',
        entityId: user.id,
        afterData: { email: user.email, roles: roleCodes },
        result: 'SUCCESS',
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId ?? null,
      });
    } catch (_e) { void _e; }


    return {
      accessToken: token,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.getProps().fullName,
        status: user.status,
        userType: user.userType,
      },
      roles,
      projectIds,
    };
  }
}
