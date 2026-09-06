import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CREW_REPOSITORY, CrewRepositoryPort, CrewMemberRow } from '../../domain/repository/crew-repository.port';
import { isValidIsoDateString } from '../../domain/service/crew-member.policy';

export interface ListCrewMembersInput {
  crewId: string;
  at?: string;
  includeInactive?: boolean;
}

export interface ListCrewMembersOutput {
  members: CrewMemberRow[];
}

function fieldError(field: string, message: string): BadRequestException {
  return new BadRequestException({ statusCode: 400, message, fieldErrors: { [field]: [message] } });
}

/**
 * ORG-SRS-007 (issue #30, D6) — tra cứu thành viên hiện tại + lịch sử.
 * - Default: chỉ active (is_active).
 * - `at=YYYY-MM-DD`: members có [effective_from, effective_to] INCLUSIVE hai
 *   đầu bao phủ date đó (NULL effective_to = open-ended), bất kể is_active
 *   (point-in-time phục vụ eligibility).
 * - `includeInactive=true`: toàn bộ lịch sử, effective_from DESC.
 * - Fix F7: thuần SELECT → pool read trực tiếp (pattern search-crews),
 *   không mở write transaction.
 */
@Injectable()
export class ListCrewMembersUseCase {
  constructor(
    @Inject(CREW_REPOSITORY) private readonly crewRepo: CrewRepositoryPort,
  ) {}

  async execute(input: ListCrewMembersInput): Promise<ListCrewMembersOutput> {
    const at = input.at && String(input.at) !== '' ? String(input.at) : undefined;
    if (at !== undefined && !isValidIsoDateString(at)) {
      throw fieldError('at', 'Ngày tra cứu không hợp lệ (YYYY-MM-DD)');
    }
    const crew = await this.crewRepo.findById(input.crewId);
    if (!crew) throw new NotFoundException('Không tìm thấy đội thi công');

    // Fix F7: pool read, không tx.
    const members = await this.crewRepo.listMembers({
      crewId: input.crewId,
      at,
      includeInactive: input.includeInactive,
    });
    const rows: CrewMemberRow[] = members;
    return { members: rows };
  }
}
