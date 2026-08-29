import { BadRequestException } from '@nestjs/common';
import { ListProjectsUseCase } from './list-projects.use-case';
import { ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { ProjectEntity } from '../../domain/entity/project.entity';
import { ProjectScopeService } from '../service/project-scope.service';

function makeProject(id: string): ProjectEntity {
  return new ProjectEntity({
    id,
    code: `P-${id.slice(0,4)}`,
    name: `Project ${id.slice(0,4)}`,
    status: 'ACTIVE',
    managerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

describe('ListProjectsUseCase IAM-SRS-006', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const p1 = '11111111-1111-4111-8111-111111111111';
  const p2 = '22222222-2222-4222-8222-222222222222';
  const p3 = '33333333-3333-4333-8333-333333333333';

  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let scope: jest.Mocked<ProjectScopeService>;
  let useCase: ListProjectsUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(),
      findByIds: jest.fn(async (ids: string[]) => ids.map(makeProject)),
      findAll: jest.fn(async () => [p1, p2, p3].map(makeProject)),
      exists: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;

    scope = {
      assertAccess: jest.fn(),
      resolveAccessibleProjectIds: jest.fn(),
      isMember: jest.fn(),
    } as unknown as jest.Mocked<ProjectScopeService>;

    useCase = new ListProjectsUseCase(projectRepo, scope);
  });

  it('ADMIN thấy tất cả projects (không filter)', async () => {
    scope.resolveAccessibleProjectIds.mockResolvedValue(null);
    const out = await useCase.execute({ userId, actorRoles: ['ADMIN'] });
    expect(out.isAdminBypass).toBe(true);
    expect(projectRepo.findAll).toHaveBeenCalled();
    expect(out.entities).toHaveLength(3);
  });

  it('member chỉ thấy project trong scope, không leak ngoài scope', async () => {
    scope.resolveAccessibleProjectIds.mockResolvedValue([p1, p2]);
    projectRepo.findByIds.mockResolvedValue([makeProject(p1), makeProject(p2)]);
    const out = await useCase.execute({ userId, actorRoles: ['WORKER'] });
    expect(out.entities.map((e) => e.id).sort()).toEqual([p1, p2].sort());
    expect(out.entities.find((e) => e.id === p3)).toBeUndefined();
    expect(projectRepo.findByIds).toHaveBeenCalledWith([p1, p2]);
  });

  it('bị loại khỏi project không xem được dữ liệu mới; list trả empty', async () => {
    scope.resolveAccessibleProjectIds.mockResolvedValue([]);
    const out = await useCase.execute({ userId, actorRoles: ['WORKER'] });
    expect(out.entities).toHaveLength(0);
    expect(projectRepo.findByIds).not.toHaveBeenCalled();
    expect(projectRepo.findAll).not.toHaveBeenCalled();
  });

  it('membership removal có hiệu lực ở request tiếp theo', async () => {
    scope.resolveAccessibleProjectIds.mockResolvedValueOnce([p1]).mockResolvedValueOnce([]);
    projectRepo.findByIds.mockResolvedValue([makeProject(p1)]);

    const first = await useCase.execute({ userId, actorRoles: ['WORKER'] });
    expect(first.entities).toHaveLength(1);

    const second = await useCase.execute({ userId, actorRoles: ['WORKER'] });
    expect(second.entities).toHaveLength(0);
  });

  it('validation limit/offset', async () => {
    scope.resolveAccessibleProjectIds.mockResolvedValue([p1]);
    await expect(useCase.execute({ userId, actorRoles: ['WORKER'], limit: 0 })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ userId, actorRoles: ['WORKER'], limit: 101 })).rejects.toThrow(BadRequestException);
    await expect(useCase.execute({ userId, actorRoles: ['WORKER'], offset: -1 })).rejects.toThrow(BadRequestException);
  });

  it('pagination được áp dụng tại repository layer (slice cho member)', async () => {
    scope.resolveAccessibleProjectIds.mockResolvedValue([p1, p2, p3]);
    projectRepo.findByIds.mockResolvedValue([p1, p2, p3].map(makeProject));
    const out = await useCase.execute({ userId, actorRoles: ['WORKER'], limit: 1, offset: 1 });
    expect(out.entities).toHaveLength(1);
  });

  it('dashboard không làm lộ bản ghi ngoài scope (query filtered, not post-filter)', async () => {
    // Ensure findByIds is called with scope IDs, not findAll + in-memory filter that could leak via logs
    scope.resolveAccessibleProjectIds.mockResolvedValue([p1]);
    projectRepo.findByIds.mockResolvedValue([makeProject(p1)]);
    await useCase.execute({ userId, actorRoles: ['WORKER'] });
    expect(projectRepo.findByIds).toHaveBeenCalledWith([p1]);
    expect(projectRepo.findAll).not.toHaveBeenCalled();
  });
});
