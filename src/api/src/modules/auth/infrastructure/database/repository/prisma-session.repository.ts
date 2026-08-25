import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { SessionEntity } from '../../../domain/entity/session.entity';
import { SessionRepositoryPort } from '../../../domain/repository/session-repository.port';

@Injectable()
export class PrismaSessionRepository implements SessionRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: { userId: string; tokenHash: string; expiresAt: Date | null }): Promise<SessionEntity> {
    const row = await this.prisma.session.create({
      data: {
        userId: params.userId,
        tokenHash: params.tokenHash,
        expiresAt: params.expiresAt,
      },
    });
    return this.toDomain(row);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionEntity | null> {
    const row = await this.prisma.session.findUnique({ where: { tokenHash } });
    if (!row) return null;
    return this.toDomain(row);
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.session.delete({ where: { id } }).catch(() => undefined);
  }

  private toDomain(row: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date | null;
    createdAt: Date;
  }): SessionEntity {
    return new SessionEntity(row.id, row.userId, row.tokenHash, row.expiresAt, row.createdAt);
  }
}
