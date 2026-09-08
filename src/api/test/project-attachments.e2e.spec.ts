import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ForbiddenException, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { USER_REPOSITORY } from '../src/modules/iam/domain/repository/user-repository.port';
import { HASHER_PORT } from '../src/modules/iam/application/port/hasher.port';
import { AUDIT_PORT } from '../src/modules/iam/application/port/audit.port';
import { TRANSACTION_PORT } from '../src/modules/iam/application/port/transaction.port';
import { ProjectScopeService } from '../src/modules/iam/application/service/project-scope.service';
import { PRJ_ATTACHMENT_REPOSITORY } from '../src/modules/prj/domain/repository/attachment-repository.port';
import { PRJ_ATTACHMENT_STORAGE } from '../src/modules/prj/domain/service/attachment-storage.port';
import { LocalAttachmentStorageService } from '../src/modules/prj/infrastructure/storage/local-attachment-storage.service';
import { AttachmentEntity } from '../src/modules/prj/domain/entity/attachment.entity';
import { UserEntity } from '../src/modules/iam/domain/entity/user.entity';

// PRJ-SRS-009 (issue #40) — attachments HTTP contract (supertest, in-process,
// mocks qua overrideProvider như work-orders.e2e; storage THẬT trên tmp dir):
// anon 401 / outsider 403 (upload/list/download) / PM upload JPEG 201 →
// replay 200 idempotentReplay (không file mới) / fake-exe + >10MB 400 / list
// metadata + no-store / download stream + Content-Disposition / retire +
// alreadyInactive + history / WO extension upload+list.

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PM_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OUTSIDER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const P1 = '22222222-2222-4222-8222-222222222222';
const MISSING_PROJECT = '00000000-0000-4000-8000-000000000000';
const WO1 = '33333333-3333-4333-8333-333333333333';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x00, 0x01]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

describe('PRJ-SRS-009 project attachments (e2e HTTP contract)', () => {
  let app: INestApplication;
  let tmpDir: string;
  const store = new Map<string, AttachmentEntity>();
  const memberships = new Map<string, string>([
    [`${P1}:${PM_ID}`, 'MANAGER'],
    [`${P1}:${WORKER_ID}`, 'WORKER'],
  ]);
  const projects = new Set([P1]);
  const workOrders = new Map<string, string>([[WO1, P1]]);
  let auditLogWithClient: jest.Mock;

  function countFiles(): number {
    let n = 0;
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(dir, e.name));
        else n += 1;
      }
    };
    walk(tmpDir);
    return n;
  }

  function makeUser(id: string, email: string, passwordHash: string): UserEntity {
    return new UserEntity({
      id,
      email,
      passwordHash,
      fullName: 'E2E User',
      status: 'ACTIVE',
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: null,
      userType: 'STAFF',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-e2e-attachments-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    tmpDir = mkdtempSync(join(tmpdir(), 'att-e2e-'));

    const hash = await bcrypt.hash('Password123!', 10);
    const users = new Map<string, UserEntity>([
      ['admin-e2e-att@example.com', makeUser(ADMIN_ID, 'admin-e2e-att@example.com', hash)],
      ['pm-e2e-att@example.com', makeUser(PM_ID, 'pm-e2e-att@example.com', hash)],
      ['worker-e2e-att@example.com', makeUser(WORKER_ID, 'worker-e2e-att@example.com', hash)],
      ['outsider-e2e-att@example.com', makeUser(OUTSIDER_ID, 'outsider-e2e-att@example.com', hash)],
    ]);
    const rolesByUser = new Map<string, Array<{ id: string; code: string; name: string }>>([
      [ADMIN_ID, [{ id: 'r1', code: 'ADMIN', name: 'Admin' }]],
      [PM_ID, [{ id: 'r2', code: 'PROJECT_MANAGER', name: 'PM' }]],
      [WORKER_ID, [{ id: 'r3', code: 'WORKER', name: 'Worker' }]],
      [OUTSIDER_ID, [{ id: 'r4', code: 'WORKER', name: 'Worker' }]],
    ]);

    const mockUserRepo = {
      findByEmail: jest.fn(async (email: string) => users.get(email.toLowerCase()) ?? null),
      findById: jest.fn(async (id: string) => [...users.values()].find((u) => u.id === id) ?? null),
      save: jest.fn(async () => {}),
      findActiveRolesByUserId: jest.fn(async (id: string) => rolesByUser.get(id) ?? []),
      findActiveProjectIdsByUserId: jest.fn(async () => [] as string[]),
    };

    const mockHasher = {
      hash: async (p: string) => bcrypt.hash(p, 10),
      compare: async (plain: string, hashStr: string) => bcrypt.compare(plain, hashStr),
    };

    auditLogWithClient = jest.fn(async () => {});
    const mockAudit = {
      log: jest.fn(async () => {}),
      logWithClient: auditLogWithClient,
    };
    const fakeTx = {
      withTransaction: async (fn: (c: unknown) => Promise<unknown>) => fn({} as never),
    };

    const mockScope = {
      assertProjectWriteScope: jest.fn(
        async ({ userId, actorRoles, projectId }: { userId: string; actorRoles: string[]; projectId: string }) => {
          if (actorRoles.includes('ADMIN')) {
            if (!projects.has(projectId)) throw new NotFoundException('Không tìm thấy dự án');
            return { isAdminBypass: true };
          }
          const role = memberships.get(`${projectId}:${userId}`);
          if (role === 'MANAGER' || role === 'COORDINATOR') return { isAdminBypass: false };
          throw new ForbiddenException('Không có quyền truy cập dự án này');
        },
      ),
      assertProjectMemberScope: jest.fn(
        async ({ userId, actorRoles, projectId }: { userId: string; actorRoles: string[]; projectId: string }) => {
          if (actorRoles.includes('ADMIN')) {
            if (!projects.has(projectId)) throw new NotFoundException('Không tìm thấy dự án');
            return { isAdminBypass: true };
          }
          if (memberships.has(`${projectId}:${userId}`)) return { isAdminBypass: false };
          throw new ForbiddenException('Không có quyền truy cập dự án này');
        },
      ),
    };

    const mockAttachmentRepo = {
      findById: jest.fn(async (id: string) => store.get(id) ?? null),
      findByRequestKey: jest.fn(async (key: string) => {
        return [...store.values()].find((e) => e.requestKey === key) ?? null;
      }),
      listByProjectId: jest.fn(async (projectId: string) => {
        return [...store.values()].filter((e) => e.projectId === projectId);
      }),
      listByWorkOrderId: jest.fn(async (woId: string) => {
        return [...store.values()].filter((e) => e.workOrderId === woId);
      }),
      findWorkOrderProjectById: jest.fn(async (woId: string) => {
        const projectId = workOrders.get(woId);
        return projectId ? { id: woId, projectId } : null;
      }),
      create: jest.fn(async (e: AttachmentEntity) => { store.set(e.id, e); }),
      createWithClient: jest.fn(async (_c: unknown, e: AttachmentEntity) => { store.set(e.id, e); }),
      retireWithClient: jest.fn(
        async (_c: unknown, id: string, input: { deactivatedBy: string; deactivatedAt: Date; reason: string | null }) => {
          const cur = store.get(id);
          if (!cur) throw new Error('ATTACHMENT_NOT_FOUND');
          if (!cur.isActive) return { entity: cur, alreadyInactive: true };
          const retired = new AttachmentEntity({
            id: cur.id,
            projectId: cur.projectId,
            workOrderId: cur.workOrderId,
            ownerType: cur.ownerType,
            ownerId: cur.ownerId,
            attachmentType: cur.attachmentType,
            uploadedBy: cur.uploadedBy,
            fileName: cur.fileName,
            storageKey: cur.storageKey,
            mimeType: cur.mimeType,
            sizeBytes: cur.sizeBytes,
            caption: cur.caption,
            isActive: false,
            deactivatedAt: input.deactivatedAt,
            deactivatedBy: input.deactivatedBy,
            deactivateReason: input.reason,
            requestKey: cur.requestKey,
            createdAt: cur.createdAt,
          });
          store.set(id, retired);
          return { entity: retired, alreadyInactive: false };
        },
      ),
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(USER_REPOSITORY).useValue(mockUserRepo)
      .overrideProvider(HASHER_PORT).useValue(mockHasher)
      .overrideProvider(AUDIT_PORT).useValue(mockAudit)
      .overrideProvider(TRANSACTION_PORT).useValue(fakeTx)
      .overrideProvider(ProjectScopeService).useValue(mockScope)
      .overrideProvider(PRJ_ATTACHMENT_REPOSITORY).useValue(mockAttachmentRepo)
      .overrideProvider(PRJ_ATTACHMENT_STORAGE).useValue(new LocalAttachmentStorageService(tmpDir))
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' })
      .expect(200);
    return res.body.accessToken as string;
  }

  const VALID_CORR = '6c1f4f0e-2b7a-4d3e-9c8b-1a2f3e4d5c6b';
  const REPLAY_KEY = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  let attId = '';

  it('anon 401; outsider 403 (upload/list/download đều không leak)', async () => {
    await request(app.getHttpServer()).get(`/api/v1/projects/${P1}/attachments`).expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${P1}/attachments`)
      .attach('file', JPEG, 'a.jpg')
      .expect(401);

    const outsiderToken = await login('outsider-e2e-att@example.com');
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${P1}/attachments`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .attach('file', JPEG, 'a.jpg')
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${P1}/attachments`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
    // Non-member vẫn 403 kể cả project missing (không phân biệt 404/403).
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${MISSING_PROJECT}/attachments`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .attach('file', JPEG, 'a.jpg')
      .expect(403);
    expect(countFiles()).toBe(0);
  });

  it('PM upload JPEG 201 (audit PRJ_ATTACHMENT_UPLOADED); WORKER đọc + tải được', async () => {
    const pmToken = await login('pm-e2e-att@example.com');
    const created = await request(app.getHttpServer())
      .post(`/api/v1/projects/${P1}/attachments`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .field('caption', 'Ảnh hiện trường')
      .field('requestKey', REPLAY_KEY)
      .attach('file', JPEG, 'hien-truong.jpg')
      .expect(201);
    expect(created.body.fileName).toBe('hien-truong.jpg');
    expect(created.body.mimeType).toBe('image/jpeg');
    expect(created.body.caption).toBe('Ảnh hiện trường');
    expect(created.body.isActive).toBe(true);
    expect(created.body.storageKey).toBeUndefined();
    attId = created.body.id as string;
    expect(auditLogWithClient).toHaveBeenCalledTimes(1);
    expect((auditLogWithClient as jest.Mock).mock.calls[0][1]).toMatchObject({
      action: 'PRJ_ATTACHMENT_UPLOADED',
      entityType: 'ATTACHMENT',
    });
    expect(countFiles()).toBe(1);

    const workerToken = await login('worker-e2e-att@example.com');
    const list = await request(app.getHttpServer())
      .get(`/api/v1/projects/${P1}/attachments`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(list.headers['cache-control']).toBe('no-store');
    expect(list.body.total).toBe(1);

    const dl = await request(app.getHttpServer())
      .get(`/api/v1/projects/${P1}/attachments/${attId}/content`)
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(200);
    expect(dl.headers['content-type']).toBe('image/jpeg');
    expect(dl.headers['content-disposition']).toContain('attachment;');
    expect(Buffer.compare(Buffer.from(dl.body as Uint8Array), JPEG)).toBe(0);
  });

  it('replay cùng requestKey → 200 idempotentReplay, KHÔNG file mới, KHÔNG audit', async () => {
    const pmToken = await login('pm-e2e-att@example.com');
    const filesBefore = countFiles();
    const auditsBefore = auditLogWithClient.mock.calls.length;
    const replayed = await request(app.getHttpServer())
      .post(`/api/v1/projects/${P1}/attachments`)
      .set('Authorization', `Bearer ${pmToken}`)
      .field('requestKey', REPLAY_KEY)
      .attach('file', PNG, 'khac.png')
      .expect(200);
    expect(replayed.body.id).toBe(attId);
    expect(replayed.body.idempotentReplay).toBe(true);
    expect(countFiles()).toBe(filesBefore);
    expect(auditLogWithClient.mock.calls.length).toBe(auditsBefore);
  });

  it('fake-exe + quá 10MB + thiếu file → 400, không chạm disk', async () => {
    const pmToken = await login('pm-e2e-att@example.com');
    const filesBefore = countFiles();
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${P1}/attachments`)
      .set('Authorization', `Bearer ${pmToken}`)
      .attach('file', EXE, { filename: 'evil.pdf', contentType: 'application/pdf' } as never)
      .expect(400);
    const big = Buffer.alloc(10 * 1024 * 1024 + 1);
    big[0] = 0x89;
    big[1] = 0x50;
    big[2] = 0x4e;
    big[3] = 0x47;
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${P1}/attachments`)
      .set('Authorization', `Bearer ${pmToken}`)
      .attach('file', big, 'big.png')
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${P1}/attachments`)
      .set('Authorization', `Bearer ${pmToken}`)
      .field('caption', 'không có file')
      .expect(400);
    expect(countFiles()).toBe(filesBefore);
  });

  it('retire: WORKER 403; PM 200 + alreadyInactive lần 2; history giữ + vẫn tải được', async () => {
    const workerToken = await login('worker-e2e-att@example.com');
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${P1}/attachments/${attId}/retire`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ reason: 'worker retire' })
      .expect(403);

    const pmToken = await login('pm-e2e-att@example.com');
    const auditsBefore = auditLogWithClient.mock.calls.length;
    const retired = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${P1}/attachments/${attId}/retire`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', VALID_CORR)
      .send({ reason: 'Hết hiệu lực' })
      .expect(200);
    expect(retired.body.isActive).toBe(false);
    expect(retired.body.deactivateReason).toBe('Hết hiệu lực');
    expect((auditLogWithClient as jest.Mock).mock.calls[auditsBefore][1]).toMatchObject({
      action: 'PRJ_ATTACHMENT_RETIRED',
      entityType: 'ATTACHMENT',
    });

    const again = await request(app.getHttpServer())
      .patch(`/api/v1/projects/${P1}/attachments/${attId}/retire`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({})
      .expect(200);
    expect(again.body.alreadyInactive).toBe(true);
    expect(auditLogWithClient.mock.calls.length).toBe(auditsBefore + 1);

    // History: list vẫn thấy cờ inactive; download inactive vẫn được.
    const list = await request(app.getHttpServer())
      .get(`/api/v1/projects/${P1}/attachments`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(list.body.data[0].isActive).toBe(false);
    await request(app.getHttpServer())
      .get(`/api/v1/projects/${P1}/attachments/${attId}/content`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);

    // Bad correlation trên retire → 400.
    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${P1}/attachments/${attId}/retire`)
      .set('Authorization', `Bearer ${pmToken}`)
      .set('X-Correlation-Id', 'not-a-uuid')
      .send({})
      .expect(400);
  });

  it('WO extension: PM upload PDF vào WO 201; list WO; outsider 403', async () => {
    const pmToken = await login('pm-e2e-att@example.com');
    const created = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${WO1}/attachments`)
      .set('Authorization', `Bearer ${pmToken}`)
      .attach('file', PDF, 'bien-ban.pdf')
      .expect(201);
    expect(created.body.workOrderId).toBe(WO1);
    expect(created.body.projectId).toBe(P1);
    expect(created.body.mimeType).toBe('application/pdf');

    const list = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${WO1}/attachments`)
      .set('Authorization', `Bearer ${pmToken}`)
      .expect(200);
    expect(list.body.total).toBe(1);
    expect(list.headers['cache-control']).toBe('no-store');

    // Outsider: list + download qua WO path đều 403 (không leak).
    const outsiderToken = await login('outsider-e2e-att@example.com');
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${WO1}/attachments`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${WO1}/attachments/${created.body.id as string}/content`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    // Retire qua WO path (idempotent lần 2).
    const woAttId = created.body.id as string;
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${WO1}/attachments/${woAttId}/retire`)
      .set('Authorization', `Bearer ${pmToken}`)
      .send({ reason: 'WO retire' })
      .expect(200)
      .expect((res: { body: { isActive: boolean } }) => {
        if (res.body.isActive !== false) throw new Error('expected inactive');
      });
  });
});
