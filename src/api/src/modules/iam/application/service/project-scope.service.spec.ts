import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectScopeService } from './project-scope.service';
import { ProjectMembershipRepositoryPort } from '../../domain/repository/project-membership-repository.port';
import { ProjectRepositoryPort } from '../../domain/repository/project-repository.port';
import { AuditPort } from '../port/audit.port';

describe('ProjectScopeService IAM-SRS-006', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const projectId = '11111111-1111-4111-8111-111111111111';
  const otherProjectId = '22222222-2222-4222-8222-222222222222';

  let membership: jest.Mocked<ProjectMembershipRepositoryPort>;
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let service: ProjectScopeService;

  beforeEach(() => {
    membership = {
      isMember: jest.fn(),
      findActiveProjectIdsByUserId: jest.fn(),
      findActiveMemberUserIdsByProjectId: jest.fn(),
    } as unknown as jest.Mocked<ProjectMembershipRepositoryPort>;

    projectRepo = {
      findById: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn(),
    } as unknown as jest.Mocked<ProjectRepositoryPort>;

    audit = { log: jest.fn(async () => {}) } as unknown as jest.Mocked<AuditPort>;

    service = new ProjectScopeService(membership, projectRepo, audit);
  });

  it('ADMIN bypass: tồn tại project thì cho phép và audit', async () => {
    projectRepo.exists.mockResolvedValue(true);
    const out = await service.assertAccess({ userId, actorRoles: ['ADMIN'], projectId });
    expect(out.isAdminBypass).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PROJECT_SCOPE_ADMIN_BYPASS' }));
    expect(membership.isMember).not.toHaveBeenCalled();
  });

  it('ADMIN: project không tồn tại trả 404', async () => {
    projectRepo.exists.mockResolvedValue(false);
    await expect(service.assertAccess({ userId, actorRoles: ['ADMIN'], projectId })).rejects.toThrow(NotFoundException);
    await expect(service.assertAccess({ userId, actorRoles: ['ADMIN'], projectId })).rejects.toThrow('Không tìm thấy dự án');
  });

  it('non-ADMIN là member thì allowed', async () => {
    membership.isMember.mockResolvedValue(true);
    const out = await service.assertAccess({ userId, actorRoles: ['WORKER'], projectId });
    expect(out.isAdminBypass).toBe(false);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('non-ADMIN không là member bị chặn 403 (không leak existence)', async () => {
    membership.isMember.mockResolvedValue(false);
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId })).rejects.toThrow(ForbiddenException);
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId: otherProjectId })).rejects.toThrow('Không có quyền truy cập dự án này');
    // Dù project tồn tại hay không, non-admin đều nhận 403, không phân biệt 404 để tránh enumeration
  });

  it('ID tampering: projectId không hợp lệ trả 400', async () => {
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId: 'not-uuid' })).rejects.toThrow(BadRequestException);
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId: '' })).rejects.toThrow('Project ID không hợp lệ');
  });

  it('membership revoked giữa lúc mở màn hình: request tiếp theo bị từ chối (fresh DB check)', async () => {
    // First call: member
    membership.isMember.mockResolvedValueOnce(true);
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId })).resolves.toEqual({ isAdminBypass: false });
    // Second call after revocation: not member
    membership.isMember.mockResolvedValueOnce(false);
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId })).rejects.toThrow(ForbiddenException);
    expect(membership.isMember).toHaveBeenCalledTimes(2);
  });

  it('resolveAccessibleProjectIds: ADMIN trả null (unrestricted), non-ADMIN trả member list', async () => {
    const adminIds = await service.resolveAccessibleProjectIds({ userId, actorRoles: ['ADMIN'] });
    expect(adminIds).toBeNull();

    membership.findActiveProjectIdsByUserId.mockResolvedValue([projectId]);
    const memberIds = await service.resolveAccessibleProjectIds({ userId, actorRoles: ['WORKER'] });
    expect(memberIds).toEqual([projectId]);
  });

  it('list không leak: non-ADMIN với 0 project trả empty', async () => {
    membership.findActiveProjectIdsByUserId.mockResolvedValue([]);
    const ids = await service.resolveAccessibleProjectIds({ userId, actorRoles: ['WORKER'] });
    expect(ids).toEqual([]);
  });
});
