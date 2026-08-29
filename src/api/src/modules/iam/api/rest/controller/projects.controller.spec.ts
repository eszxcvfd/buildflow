import { ForbiddenException } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { GetProjectUseCase } from '../../../application/use-case/get-project.use-case';
import { ListProjectsUseCase } from '../../../application/use-case/list-projects.use-case';
import { ProjectEntity } from '../../../domain/entity/project.entity';

function makeProject(id: string): ProjectEntity {
  return new ProjectEntity({
    id,
    code: 'P-001',
    name: 'Project 001',
    status: 'ACTIVE',
    managerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    createdAt: new Date('2026-08-26T00:00:00.000Z'),
    updatedAt: new Date('2026-08-27T00:00:00.000Z'),
  });
}

describe('ProjectsController IAM-SRS-006', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  let getProject: jest.Mocked<GetProjectUseCase>;
  let listProjects: jest.Mocked<ListProjectsUseCase>;
  let controller: ProjectsController;

  beforeEach(() => {
    getProject = { execute: jest.fn() } as unknown as jest.Mocked<GetProjectUseCase>;
    listProjects = { execute: jest.fn() } as unknown as jest.Mocked<ListProjectsUseCase>;
    controller = new ProjectsController(getProject, listProjects);
  });

  function mockReq(userOverrides: Partial<{ sub: string; roles: string[] }> = {}): unknown {
    return {
      user: { sub: 'user-1', roles: ['WORKER'], ...userOverrides },
      headers: {},
      ip: '127.0.0.1',
    };
  }

  it('GET /api/v1/projects — server-side auth, chỉ trả project trong scope', async () => {
    listProjects.execute.mockResolvedValue({ entities: [makeProject(projectId)], isAdminBypass: false });
    const req = mockReq();
    const result = await controller.list(req as never, undefined, undefined);
    expect(listProjects.execute).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', actorRoles: ['WORKER'] }));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(projectId);
  });

  it('GET /api/v1/projects/:id — đúng scope thành công', async () => {
    getProject.execute.mockResolvedValue({ entity: makeProject(projectId), isAdminBypass: false });
    const req = mockReq();
    const result = await controller.getOne(projectId, req as never);
    expect(result.id).toBe(projectId);
  });

  it('GET /api/v1/projects/:id — sửa ID/URL ngoài scope bị chặn 403, không bypass', async () => {
    getProject.execute.mockRejectedValue(new ForbiddenException('Không có quyền truy cập dự án này'));
    const req = mockReq();
    await expect(controller.getOne(otherId, req as never)).rejects.toThrow(ForbiddenException);
  });

  it('list/detail không dùng projectId từ client để che scope — gọi scope service, không tự filter ở controller', async () => {
    // Controller chỉ truyền actorRoles server-derived, không lấy projectId từ query body tin cậy
    listProjects.execute.mockResolvedValue({ entities: [], isAdminBypass: false });
    const req = mockReq({ roles: ['WORKER'] });
    await controller.list(req as never, '20', '0');
    expect(listProjects.execute).toHaveBeenCalledWith(expect.objectContaining({ actorRoles: ['WORKER'] }));
    // Dù client gửi limit=20, scope vẫn được áp dụng ở use-case, controller không bypass
  });

  it('ADMIN được audit bypass nhưng vẫn phải qua scope service', async () => {
    getProject.execute.mockResolvedValue({ entity: makeProject(otherId), isAdminBypass: true });
    const req = mockReq({ roles: ['ADMIN'] });
    const result = await controller.getOne(otherId, req as never);
    expect(result.id).toBe(otherId);
    expect(getProject.execute).toHaveBeenCalledWith(expect.objectContaining({ actorRoles: ['ADMIN'] }));
  });
});
