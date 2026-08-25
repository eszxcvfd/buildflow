import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { UserEntity } from '../../../domain/entity/user.entity';
import { UserRepositoryPort } from '../../../domain/repository/user-repository.port';

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    if (!row) return null;
    return this.toDomain(row);
  }

  private toDomain(row: {
    id: string;
    email: string;
    passwordHash: string;
    role: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): UserEntity {
    return new UserEntity(
      row.id,
      row.email,
      row.passwordHash,
      row.role as UserEntity['role'],
      row.status as UserEntity['status'],
      row.createdAt,
      row.updatedAt,
    );
  }
}
