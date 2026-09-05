import { Inject, Injectable, ConflictException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PoolClient } from 'pg';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { AUDIT_PORT, AuditPort } from '../port/audit.port';
import { HASHER_PORT, HasherPort } from '../port/hasher.port';
import { TRANSACTION_PORT, TransactionPort } from '../port/transaction.port';
import { UserEntity } from '../../domain/entity/user.entity';

function isUniqueViolationError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as Record<string, unknown>;
  if (err['code'] === '23505') return true;
  const constraint = String(err['constraint'] ?? '');
  if (/ux_users/i.test(constraint)) return true;
  const msg = String((err['message'] as string) ?? '');
  if (/duplicate key|unique constraint|23505|ux_users/i.test(msg)) return true;
  const detail = String((err['detail'] as string) ?? '');
  if (/already exists/i.test(detail)) return true;
  return false;
}

function mapUniqueViolation(e: unknown): string {
  const err = e as Record<string, unknown>;
  const constraint = String(err['constraint'] ?? '');
  const detail = String((err['detail'] as string) ?? err['message'] ?? '');
  if (/ux_users_email_lower/i.test(constraint) || /lower\(email\)/i.test(detail) || /\(email\)/i.test(detail) && /users/i.test(detail)) {
    return 'Email đã tồn tại';
  }
  if (/ux_users_phone/i.test(constraint) || /\(phone\)/i.test(detail)) {
    return 'Số điện thoại đã tồn tại';
  }
  if (/ux_users_employee_code/i.test(constraint) || /\(employee_code\)/i.test(detail)) {
    return 'Mã nhân viên đã tồn tại';
  }
  // fallback generic based on detail containing column name
  if (/employee_code/i.test(detail)) return 'Mã nhân viên đã tồn tại';
  if (/phone/i.test(detail)) return 'Số điện thoại đã tồn tại';
  return 'Email đã tồn tại';
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  employeeCode?: string | null;
  userType?: 'STAFF' | 'WORKER';
  contractorId?: string | null;
  actorUserId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

export interface CreateUserOutput {
  entity: UserEntity;
}

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort,
    @Inject(HASHER_PORT) private readonly hasher: HasherPort,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(TRANSACTION_PORT) private readonly tx: TransactionPort,
  ) {}

  async execute(input: CreateUserInput): Promise<CreateUserOutput> {
    const normalizedEmail = input.email.trim().toLowerCase();

    // Uniqueness check on email (case-insensitive)
    const existing = await this.userRepo.findByEmail(normalizedEmail);
    if (existing) {
      throw new ConflictException('Email đã tồn tại');
    }

    // Unique employeeCode if provided
    if (input.employeeCode && this.userRepo.findByEmployeeCode) {
      const byCode = await this.userRepo.findByEmployeeCode(input.employeeCode.trim());
      if (byCode) {
        throw new ConflictException('Mã nhân viên đã tồn tại');
      }
    }

    // Domain validation via entity construction
    const now = new Date();
    const id = randomUUID();

    let passwordHash: string;
    try {
      passwordHash = await this.hasher.hash(input.password);
    } catch {
      throw new BadRequestException('Không thể băm mật khẩu');
    }

    const entity = new UserEntity({
      id,
      email: normalizedEmail,
      passwordHash,
      fullName: input.fullName.trim(),
      phone: input.phone ?? null,
      avatarUrl: input.avatarUrl ?? null,
      employeeCode: input.employeeCode ? input.employeeCode.trim() : null,
      userType: input.userType ?? 'STAFF',
      contractorId: input.contractorId ?? null,
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    });

    // Validate through domain method (reuse validation)
    try {
      entity.updateAdmin(
        {
          email: normalizedEmail,
          fullName: input.fullName,
          phone: input.phone ?? undefined,
          avatarUrl: input.avatarUrl ?? undefined,
          employeeCode: input.employeeCode ?? undefined,
          userType: input.userType ?? undefined,
          contractorId: input.contractorId ?? undefined,
        },
        now,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Dữ liệu không hợp lệ';
      throw new BadRequestException(msg);
    }

    // Password length already validated via DTO, but double-check
    if (input.password.length < 8) {
      throw new BadRequestException('Mật khẩu tối thiểu 8 ký tự');
    }

    // Atomic mutation + audit in shared DB transaction per P1 fix: both commit or both rollback
    await this.tx.withTransaction(async (client: PoolClient) => {
      try {
        if (this.userRepo.createWithClient) {
          await this.userRepo.createWithClient(client, entity);
        } else {
          await this.userRepo.create(entity);
        }
      } catch (e) {
        if (e instanceof ConflictException) throw e;
        if (isUniqueViolationError(e)) {
          throw new ConflictException(mapUniqueViolation(e));
        }
        throw e;
      }

      try {
        const payload = {
          actorUserId: input.actorUserId,
          action: 'IAM_USER_CREATED',
          entityType: 'USER',
          entityId: id,
          afterData: entity.toPublicProfile(),
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
        if (e instanceof ConflictException || e instanceof BadRequestException) throw e;
        throw new InternalServerErrorException('Không thể ghi nhật ký kiểm toán');
      }
    });

    return { entity };
  }
}
