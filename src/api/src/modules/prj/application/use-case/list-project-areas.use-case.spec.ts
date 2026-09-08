import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListProjectAreasUseCase } from './list-project-areas.use-case';
import { ProjectRepositoryPort, ProjectAreaRepositoryPort, ProjectAreaRow } from '../../domain/repository/project-repository.port';
import { ProjectScopeService } from '../../../iam/application/service/project-scope.service';
import { ProjectEntity } from '../../domain/entity/project.entity';

const PID = '11111111-1111-4111-8111-111111111111';
const MANAGER = '22222222-2222-4222-8222-222222222222';
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
    managerId: MANAGER,
    status: 'ACTIVE',
    createdBy: ACTOR,
    createdAt: new Date('2026-09-07T00:00:00.000Z'),
    updatedAt: new Date('2026-09-07T00:00:00.000Z'),
  });
}

function makeArea(name: string, isActive: boolean): ProjectAreaRow {
  const now = new Date('2026-09-07T01:00:00.000Z');
  return {
    id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${name.length}${isActive ? '1' : '0'}`,
    projectId: PID,
    code: null,
    name,
    isActive,
    createdAt: now,
    updatedAt: now,
  };
}

describe('ListProjectAreasUseCase PRJ-SRS-003 (issue #34)', () => {
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let areaRepo: jest.Mocked<ProjectAreaRepositoryPort>;
  let scope: jest.Mocked<ProjectScopeService>;
  let useCase: ListProjectAreasUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(async () => makeProject()),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;
    areaRepo = {
      isActiveProjectMember: jest.fn(async () => true),
      listAreas: jest.fn(async (filter: { activeOnly?: boolean }) =>
        filter.activeOnly ? [makeArea('Khu A', true)] : [makeArea('Khu A', true), makeArea('Khu B', false)],
      ),
    } as unknown as jest.Mocked<ProjectAreaRepositoryPort>;
    scope = {
      assertProjectMemberScope: jest.fn(async () => ({ isAdminBypass: false })),
    } as unknown as jest.Mocked<ProjectScopeService>;
    useCase = new ListProjectAreasUseCase(projectRepo, areaRepo, scope);
  });

  it('happy: default kèm inactive; activeOnly=true chỉ active', async () => {
    const all = await useCase.execute({ projectId: PID, actorUserId: ACTOR, actorRoles: ['ADMIN'] });
    expect(all.areas).toHaveLength(2);
    expect(areaRepo.listAreas).toHaveBeenCalledWith({ projectId: PID, activeOnly: undefined });
    const active = await useCase.execute({ projectId: PID, activeOnly: true, actorUserId: ACTOR, actorRoles: ['ADMIN'] });
    expect(active.areas).toHaveLength(1);
    expect(areaRepo.listAreas).toHaveBeenCalledWith({ projectId: PID, activeOnly: true });
  });

  it('member WORKER đọc được (WO picker tương lai); non-member PM → 403; project 404', async () => {
    const out = await useCase.execute({ projectId: PID, actorUserId: ACTOR, actorRoles: ['WORKER'] });
    expect(out.areas).toHaveLength(2);
    expect(scope.assertProjectMemberScope).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ACTOR, actorRoles: ['WORKER'], projectId: PID, auditBypass: false }),
    );
    (scope.assertProjectMemberScope as jest.Mock).mockRejectedValueOnce(
      new ForbiddenException('Không có quyền truy cập dự án này'),
    );
    (areaRepo.listAreas as jest.Mock).mockClear();
    const err = await useCase
      .execute({ projectId: PID, actorUserId: ACTOR, actorRoles: ['PROJECT_MANAGER'] })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(areaRepo.listAreas).not.toHaveBeenCalled();
    projectRepo.findById.mockResolvedValue(null);
    const missing = await useCase
      .execute({ projectId: PID, actorUserId: ACTOR, actorRoles: ['ADMIN'] })
      .catch((e: unknown) => e);
    expect(missing).toBeInstanceOf(NotFoundException);
  });
});
