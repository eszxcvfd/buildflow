import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../../domain/repository/user-repository.port';
import { UserEntity } from '../../domain/entity/user.entity';

export interface GetProfileInput {
  userId: string;
}

export interface GetProfileOutput {
  entity: UserEntity;
}

@Injectable()
export class GetProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepo: UserRepositoryPort) {}

  async execute(input: GetProfileInput): Promise<GetProfileOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new NotFoundException('Không tìm thấy hồ sơ');
    }
    return { entity: user };
  }
}
