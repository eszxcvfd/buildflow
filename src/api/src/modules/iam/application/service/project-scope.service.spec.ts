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
      findActiveProjectRole: jest.fn(),
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
    expect(membership.findActiveProjectRole).not.toHaveBeenCalled();
  });

  it('ADMIN: project không tồn tại trả 404', async () => {
    projectRepo.exists.mockResolvedValue(false);
    await expect(service.assertAccess({ userId, actorRoles: ['ADMIN'], projectId })).rejects.toThrow(NotFoundException);
    await expect(service.assertAccess({ userId, actorRoles: ['ADMIN'], projectId })).rejects.toThrow('Không tìm thấy dự án');
  });

  it('non-ADMIN là member thì allowed (không audit)', async () => {
    membership.findActiveProjectRole.mockResolvedValue('WORKER');
    const out = await service.assertAccess({ userId, actorRoles: ['WORKER'], projectId });
    expect(out.isAdminBypass).toBe(false);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('non-ADMIN không là member bị chặn 403 (không leak existence) + audit DENIED', async () => {
    membership.findActiveProjectRole.mockResolvedValue(null);
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId })).rejects.toThrow(ForbiddenException);
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId: otherProjectId })).rejects.toThrow('Không có quyền truy cập dự án này');
    // Dù project tồn tại hay không, non-admin đều nhận 403, không phân biệt 404 để tránh enumeration
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PROJECT_SCOPE_DENIED', result: 'FAILED', entityId: projectId }),
    );
  });

  it('ID tampering: projectId không hợp lệ trả 400', async () => {
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId: 'not-uuid' })).rejects.toThrow(BadRequestException);
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId: '' })).rejects.toThrow('Project ID không hợp lệ');
  });

  it('membership revoked giữa lúc mở màn hình: request tiếp theo bị từ chối (fresh DB check)', async () => {
    // First call: member
    membership.findActiveProjectRole.mockResolvedValueOnce('WORKER');
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId })).resolves.toEqual({ isAdminBypass: false });
    // Second call after revocation: not member
    membership.findActiveProjectRole.mockResolvedValueOnce(null);
    await expect(service.assertAccess({ userId, actorRoles: ['WORKER'], projectId })).rejects.toThrow(ForbiddenException);
    expect(membership.findActiveProjectRole).toHaveBeenCalledTimes(2);
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

  it('list ADMIN bypass: log-only, KHÔNG ghi audit row (decision §15 C)', async () => {
    const ids = await service.resolveAccessibleProjectIds({ userId, actorRoles: ['ADMIN'] });
    expect(ids).toBeNull();
    expect(audit.log).not.toHaveBeenCalled();
  });
});

describe('ProjectScopeService PRJ-SRS-006 (issue #37) — write scope', () => {
  const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const projectId = '11111111-1111-4111-8111-111111111111';

  let membership: jest.Mocked<ProjectMembershipRepositoryPort>;
  let projectRepo: jest.Mocked<ProjectRepositoryPort>;
  let audit: jest.Mocked<AuditPort>;
  let service: ProjectScopeService;

  beforeEach(() => {
    membership = {
      isMember: jest.fn(),
      findActiveProjectIdsByUserId: jest.fn(),
      findActiveMemberUserIdsByProjectId: jest.fn(),
      findActiveProjectRole: jest.fn(),
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

  it.each([['MANAGER'], ['COORDINATOR']])('member %s được write', async (role) => {
    membership.findActiveProjectRole.mockResolvedValue(role);
    const out = await service.assertProjectWriteScope({ userId, actorRoles: ['PROJECT_MANAGER'], projectId });
    expect(out).toEqual({ isAdminBypass: false });
    expect(audit.log).not.toHaveBeenCalled();
  });

  it.each([['WORKER'], ['QC'], ['VIEWER']])('member %s KHÔNG được write → 403 + DENIED audit', async (role) => {
    membership.findActiveProjectRole.mockResolvedValue(role);
    await expect(
      service.assertProjectWriteScope({ userId, actorRoles: ['PROJECT_MANAGER'], projectId }),
    ).rejects.toThrow('Không có quyền truy cập dự án này');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'PROJECT_SCOPE_DENIED',
        entityId: projectId,
        result: 'FAILED',
      }),
    );
  });

  it('PM global nhưng không member → 403 (membership là source of truth)', async () => {
    membership.findActiveProjectRole.mockResolvedValue(null);
    await expect(
      service.assertProjectWriteScope({ userId, actorRoles: ['PROJECT_MANAGER'], projectId }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('ADMIN bypass write: audited; project missing → 404', async () => {
    projectRepo.exists.mockResolvedValue(true);
    const out = await service.assertProjectWriteScope({ userId, actorRoles: ['ADMIN'], projectId });
    expect(out).toEqual({ isAdminBypass: true });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PROJECT_SCOPE_ADMIN_BYPASS' }));

    projectRepo.exists.mockResolvedValue(false);
    await expect(service.assertProjectWriteScope({ userId, actorRoles: ['ADMIN'], projectId })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('audit bypass fail → warn + vẫn cho qua (không nuốt âm thầm)', async () => {
    projectRepo.exists.mockResolvedValue(true);
    (audit.log as jest.Mock).mockRejectedValueOnce(new Error('audit down'));
    const out = await service.assertProjectWriteScope({ userId, actorRoles: ['ADMIN'], projectId });
    expect(out).toEqual({ isAdminBypass: true });
  });

  it('denied audit fail → denial vẫn đứng (403)', async () => {
    membership.findActiveProjectRole.mockResolvedValue(null);
    (audit.log as jest.Mock).mockRejectedValue(new Error('audit down'));
    await expect(service.assertProjectWriteScope({ userId, actorRoles: ['WORKER'], projectId })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('assertWriteScopeTxCheck: ADMIN skip; MANAGER/COORDINATOR pass; còn lại 403', () => {
    expect(() => service.assertWriteScopeTxCheck(true, null)).not.toThrow();
    expect(() => service.assertWriteScopeTxCheck(false, 'MANAGER')).not.toThrow();
    expect(() => service.assertWriteScopeTxCheck(false, 'COORDINATOR')).not.toThrow();
    expect(() => service.assertWriteScopeTxCheck(false, null)).toThrow(ForbiddenException);
    expect(() => service.assertWriteScopeTxCheck(false, 'WORKER')).toThrow(ForbiddenException);
    expect(() => service.assertWriteScopeTxCheck(false, 'VIEWER')).toThrow(ForbiddenException);
  });

  it('assertMemberScopeTxCheck: ADMIN skip; bất kỳ role nào pass; null → 403', () => {
    expect(() => service.assertMemberScopeTxCheck(true, null)).not.toThrow();
    expect(() => service.assertMemberScopeTxCheck(false, 'WORKER')).not.toThrow();
    expect(() => service.assertMemberScopeTxCheck(false, 'VIEWER')).not.toThrow();
    expect(() => service.assertMemberScopeTxCheck(false, null)).toThrow(ForbiddenException);
  });

  it('assertProjectMemberScope auditBypass=false: ADMIN cho qua nhưng không audit row', async () => {
    projectRepo.exists.mockResolvedValue(true);
    const out = await service.assertProjectMemberScope({
      userId,
      actorRoles: ['ADMIN'],
      projectId,
      auditBypass: false,
    });
    expect(out).toEqual({ isAdminBypass: true });
    expect(audit.log).not.toHaveBeenCalled();
  });
});
