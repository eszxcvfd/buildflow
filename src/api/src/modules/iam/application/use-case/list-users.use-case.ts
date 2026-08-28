import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { UserEntity } from '../../domain/entity/user.entity';

const ALLOWED_STATUSES = new Set(['ACTIVE', 'LOCKED', 'INACTIVE']);

export interface ListUsersInput {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface GetUserInput {
  userId: string;
}

@Injectable()
export class ListUsersUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort) {}

  async execute(input: ListUsersInput): Promise<{ entities: UserEntity[] }> {
    if (!this.userRepo.findAll) {
      return { entities: [] };
    }
    if (input.status !== undefined && input.status !== null && input.status !== '') {
      if (!ALLOWED_STATUSES.has(input.status)) {
        throw new BadRequestException('Trạng thái không hợp lệ');
      }
    }
    if (input.limit !== undefined) {
      if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
        throw new BadRequestException('Limit không hợp lệ (1-100)');
      }
    }
    if (input.offset !== undefined) {
      if (!Number.isInteger(input.offset) || input.offset < 0) {
        throw new BadRequestException('Offset không hợp lệ (phải >= 0)');
      }
    }
    const entities = await this.userRepo.findAll({
      status: input.status,
      limit: input.limit,
      offset: input.offset,
    });
    return { entities };
  }
}

@Injectable()
export class GetUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort) {}

  async execute(input: GetUserInput): Promise<{ entity: UserEntity }> {
    const entity = await this.userRepo.findById(input.userId);
    if (!entity) {
      const { NotFoundException } = await import('@nestjs/common');
      throw new NotFoundException('Không tìm thấy tài khoản');
    }
    return { entity };
  }
}
