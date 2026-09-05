import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { UserEntity } from '../../domain/entity/user.entity';

export interface UpdateProfileInput {
  userId: string;
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface UpdateProfileOutput {
  entity: UserEntity;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  async execute(input: UpdateProfileInput): Promise<UpdateProfileOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }

    const before = user.toPublicProfile();

    // Domain validation for profile fields
    try {
      user.updateProfile(
        {
          fullName: input.fullName,
          phone: input.phone,
          avatarUrl: input.avatarUrl,
        },
        new Date(),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
      throw new BadRequestException(msg);
    }

    await this.userRepo.save(user);

    const after = user.toPublicProfile();

    // Audit PII update per IAM-SRS-008: log actor, before/after, result
    // Do not log passwordHash or secrets; only public profile diff
    try {
      await this.audit.log({
        actorUserId: input.userId,
        action: 'IAM_PROFILE_UPDATED',
        entityType: 'USER',
        entityId: input.userId,
        beforeData: before,
        afterData: after,
        result: 'SUCCESS',
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        correlationId: input.correlationId ?? null,
      });
    } catch {
      // audit best-effort; profile update already succeeded
    }

    return { entity: user };
  }
}
