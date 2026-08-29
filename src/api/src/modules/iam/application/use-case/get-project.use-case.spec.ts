import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { GetProjectUseCase } from './get-project.use-case';
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

describe('GetProjectUseCase IAM-SRS-006', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const projectId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';

  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let scope: jest.Mocked<ProjectScopeService>;
  let useCase: GetProjectUseCase;

  beforeEach(() => {
    projectRepo = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;

    scope = {
      assertAccess: jest.fn(),
      resolveAccessibleProjectIds: jest.fn(),
      isMember: jest.fn(),
    } as unknown as jest.Mocked<ProjectScopeService>;

    useCase = new GetProjectUseCase(projectRepo, scope);
  });

  it('user đúng scope xem thành công', async () => {
    scope.assertAccess.mockResolvedValue({ isAdminBypass: false });
    projectRepo.findById.mockResolvedValue(makeProject(projectId));
    const out = await useCase.execute({ projectId, userId, actorRoles: ['WORKER'] });
    expect(out.entity.id).toBe(projectId);
    expect(scope.assertAccess).toHaveBeenCalledWith(expect.objectContaining({ projectId, userId, actorRoles: ['WORKER'] }));
  });

  it('ID tampering: ngoài scope bị chặn 403', async () => {
    scope.assertAccess.mockRejectedValue(new ForbiddenException('Không có quyền truy cập dự án này'));
    await expect(useCase.execute({ projectId: otherId, userId, actorRoles: ['WORKER'] })).rejects.toThrow(ForbiddenException);
    expect(projectRepo.findById).not.toHaveBeenCalled();
  });

  it('ADMIN bypass vẫn lấy được project ngoài scope', async () => {
    scope.assertAccess.mockResolvedValue({ isAdminBypass: true });
    projectRepo.findById.mockResolvedValue(makeProject(otherId));
    const out = await useCase.execute({ projectId: otherId, userId, actorRoles: ['ADMIN'] });
    expect(out.isAdminBypass).toBe(true);
    expect(out.entity.id).toBe(otherId);
  });

  it('invalid UUID trả 400 trước khi check scope', async () => {
    await expect(useCase.execute({ projectId: 'invalid', userId, actorRoles: ['WORKER'] })).rejects.toThrow(BadRequestException);
    expect(scope.assertAccess).not.toHaveBeenCalled();
  });

  it('project tồn tại nhưng scope pass rồi lại không tìm thấy trả 404', async () => {
    scope.assertAccess.mockResolvedValue({ isAdminBypass: true });
    projectRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ projectId, userId, actorRoles: ['ADMIN'] })).rejects.toThrow(NotFoundException);
  });

  it('thay đổi path sang ID khác không bypass được hệ thống', async () => {
    // Giả lập attacker đổi URL từ projectId sang otherId
    scope.assertAccess.mockImplementation(async (input) => {
      if (input.projectId === projectId) return { isAdminBypass: false };
      throw new ForbiddenException('Không có quyền truy cập dự án này');
    });
    projectRepo.findById.mockResolvedValue(makeProject(projectId));
    await expect(useCase.execute({ projectId: otherId, userId, actorRoles: ['WORKER'] })).rejects.toThrow(ForbiddenException);
    // Nếu đổi lại đúng ID thì vẫn pass
    const ok = await useCase.execute({ projectId, userId, actorRoles: ['WORKER'] });
    expect(ok.entity.id).toBe(projectId);
  });
});
