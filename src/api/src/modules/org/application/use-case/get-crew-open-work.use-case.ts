import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CREW_REPOSITORY, CrewRepositoryPort } from '../../domain/repository/crew-repository.port';

/**
 * ORG-SRS-006 (issue #29) — pre-check open work của đội trước khi xác nhận
 * SUSPEND/TERMINATE. Chỉ đếm, không chặn, không ghi audit.
 */
export interface GetCrewOpenWorkInput { crewId: string; }

export interface GetCrewOpenWorkOutput { openAssignments: number; }

@Injectable()
export class GetCrewOpenWorkUseCase {
  constructor(@Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort) {}

  async execute(input: GetCrewOpenWorkInput): Promise<GetCrewOpenWorkOutput> {
    const crew = await this.crewRepo.findById(input.crewId);
    if (!crew) throw new NotFoundException('Không tìm thấy đội thi công');
    const openAssignments = await this.crewRepo.countOpenAssignments(input.crewId);
    return { openAssignments };
  }
}
