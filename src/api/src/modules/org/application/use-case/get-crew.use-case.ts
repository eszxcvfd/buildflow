import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CREW_REPOSITORY, CrewRepositoryPort } from '../../domain/repository/crew-repository.port';
import { CrewEntity } from '../../domain/entity/crew.entity';

export interface GetCrewInput { crewId: string; }

@Injectable()
export class GetCrewUseCase {
  constructor(@Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort) {}
  async execute(input: GetCrewInput): Promise<{ entity: CrewEntity }> {
    const entity = await this.crewRepo.findById(input.crewId);
    if (!entity) throw new NotFoundException('Không tìm thấy đội thi công');
    return { entity };
  }
}
