import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { UserRepositoryPort } from '../../domain/repository/user.repository.port';
import { UserSnapshot } from '../../domain/entity/user.entity';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  status: string;
  failed_login_count: number;
  locked_until: Date | null;
}

function toSnapshot(row: UserRow): UserSnapshot {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    status: row.status as UserSnapshot['status'],
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until,
  };
}

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserSnapshot | null> {
    const row = await this.prisma.users.findFirst({ where: { email } });
    return row ? toSnapshot(row as unknown as UserRow) : null;
  }

  async save(user: UserSnapshot): Promise<void> {
    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        status: user.status,
        failed_login_count: user.failedLoginCount,
        locked_until: user.lockedUntil,
        updated_at: new Date(),
      },
    });
  }

  async findRolesByUserId(userId: string): Promise<Array<{ id: string; code: string; name: string }>> {
    const rows = await this.prisma.user_roles.findMany({
      where: { user_id: userId, is_active: true },
      include: { roles: true },
    });
    return rows
      .filter((r: { roles?: { is_active?: boolean } | null }) => r.roles?.is_active !== false)
      .map((r: { roles: { id: string; code: string; name: string } }) => ({
        id: r.roles.id,
        code: r.roles.code,
        name: r.roles.name,
      }));
  }

  async findProjectIdsByUserId(userId: string): Promise<string[]> {
    const rows = await this.prisma.project_members.findMany({
      where: { user_id: userId, is_active: true, left_at: null },
      select: { project_id: true },
    });
    return rows.map((r: { project_id: string }) => r.project_id);
  }
}
