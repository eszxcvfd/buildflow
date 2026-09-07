import { NotFoundException } from '@nestjs/common';
import { ListProjectMembersUseCase } from './list-project-members.use-case';
import { ProjectRepositoryPort, ProjectMemberRow } from '../../domain/repository/project-repository.port';
import { ProjectEntity } from '../../domain/entity/project.entity';

const PID = '11111111-1111-4111-8111-111111111111';
const ACTOR = '44444444-4444-4444-8444-444444444444';

function makeProject(): ProjectEntity {
  return new ProjectEntity({
    id: PID,
    code: 'PRJ-001',
    name: 'Dự án A',
    description: null,
    address: '123 Đường Láng',
    timezone: 'Asia/Ho_Chi_Minh',
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2026-12-31',
    managerId: '22222222-2222-4222-8222-222222222222',
    status: 'ACTIVE',
    createdBy: ACTOR,
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
    updatedAt: new Date('2026-09-07T00:00:00.000Z'),
  });
}

function makeMember(id: string, isActive: boolean): ProjectMemberRow {
  const joinedAt = new Date('2026-09-07T01:00:00.000Z');
  return {
    id,
    projectId: PID,
    userId: `user-${id}`,
    projectRole: 'WORKER',
    joinedAt,
    leftAt: isActive ? null : new Date('2026-09-08T01:00:00.000Z'),
    isActive,
    addedBy: ACTOR,
    createdAt: joinedAt,
    userName: 'Nguyen Van A',
    userCode: 'EMP-1',
  };
}

describe('ListProjectMembersUseCase PRJ-SRS-005 (issue #36)', () => {
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let useCase: ListProjectMembersUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(async () => makeProject()),
      listMembers: jest.fn(async (filter) =>
        filter.includeInactive
          ? [makeMember('m1', true), makeMember('m2', false)]
          : [makeMember('m1', true)],
      ),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;
    useCase = new ListProjectMembersUseCase(projectRepo);
  });

  it('default active-only (không includeInactive → repo nhận falsy)', async () => {
    const out = await useCase.execute({ projectId: PID });
    expect(out.members).toHaveLength(1);
    expect(out.members[0].isActive).toBe(true);
    expect(projectRepo.listMembers).toHaveBeenCalledWith({ projectId: PID, includeInactive: undefined });
  });

  it('includeInactive=true → toàn bộ lịch sử (active + inactive)', async () => {
    const out = await useCase.execute({ projectId: PID, includeInactive: true });
    expect(out.members).toHaveLength(2);
    expect(projectRepo.listMembers).toHaveBeenCalledWith({ projectId: PID, includeInactive: true });
  });

  it('project không tồn tại → 404, không gọi listMembers', async () => {
    projectRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ projectId: PID })).rejects.toThrow(NotFoundException);
    expect(projectRepo.listMembers).not.toHaveBeenCalled();
  });
});
