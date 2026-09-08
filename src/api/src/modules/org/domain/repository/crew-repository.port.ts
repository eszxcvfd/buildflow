import { PoolClient } from 'pg';
import { CrewEntity } from '../entity/crew.entity';

export interface CrewFilter {
  status?: string;
  search?: string; // search code, name, description
  sort?: 'name' | 'createdAt'; // ORG-SRS-006 (#29): name → name, createdAt → created_at
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * ORG-SRS-007 (issue #30) — một row crew_members (MEMBER hoặc LEAD).
 * Ngày hiệu lực là date-only `YYYY-MM-DD`; createdAt là timestamptz.
 * userName/userCode join từ users khi rẻ (full_name/employee_code).
 */
export interface CrewMemberRow {
  id: string;
  crewId: string;
  userId: string;
  memberRole: 'LEAD' | 'MEMBER';
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  addedBy: string;
  createdAt: Date;
  userName?: string | null;
  userCode?: string | null;
}

export interface CrewMemberFilter {
  crewId: string;
  /**
   * Point-in-time: members có [effective_from, effective_to] bao phủ date —
   * INCLUSIVE hai đầu (effective_to = at vẫn tính); effective_to NULL =
   * open-ended (vô hạn).
   */
  at?: string;
  /** true → toàn bộ lịch sử, sắp effective_from DESC; false → chỉ is_active. */
  includeInactive?: boolean;
}

/**
 * ORG-03/ORG-05 (Worker ↔ Crew link) — active membership (is_active) của một
 * user trên mọi đội, kèm crew status + role + ngày hiệu lực. Lịch sử cũ
 * (is_active=false) KHÔNG trả. Pool read thuần SELECT, không transaction.
 */
export interface WorkerCrewMembership {
  crewId: string;
  crewCode: string;
  crewName: string;
  crewStatus: 'ACTIVE' | 'INACTIVE';
  memberRole: 'LEAD' | 'MEMBER';
  effectiveFrom: string;
  effectiveTo: string | null;
}

/**
 * ORG-05 — slim ref cho worker list/detail enrichment
 * (`crews[]` kèm profile, active only).
 */
export interface WorkerCrewRef {
  crewId: string;
  crewCode: string;
  crewName: string;
  memberRole: 'LEAD' | 'MEMBER';
}

/**
 * ORG-05 — enrichment cho crews list: tên trưởng nhóm (join users qua LEAD
 * đang hiệu lực, null khi đội chưa có LEAD) + số thành viên active
 * (COUNT crew_members is_active, mọi role LEAD/MEMBER đều tính).
 */
export interface CrewListEnrichment {
  leaderName: string | null;
  memberCount: number;
}

export interface CrewRepositoryPort {
  findById(id: string): Promise<CrewEntity | null>;
  findByCode(code: string): Promise<CrewEntity | null>;
  findMany(filter: CrewFilter): Promise<{ entities: CrewEntity[]; total: number }>;
  create(crew: CrewEntity): Promise<void>;
  createWithClient?(client: PoolClient, crew: CrewEntity): Promise<void>;
  save(crew: CrewEntity): Promise<void>;
  saveWithClient?(client: PoolClient, crew: CrewEntity): Promise<void>;
  /**
   * ORG-SRS-006 (issue #29) — membership LEAD lifecycle (crew_members):
   * insert LEAD mới / soft-deactivate LEAD đang hiệu lực (is_active=false,
   * effective_to=CURRENT_DATE — thỏa revocation_ck). Chạy trong tx của use case.
   */
  insertLeadWithClient(client: PoolClient, input: { crewId: string; userId: string; addedBy: string }): Promise<void>;
  deactivateActiveLeadWithClient(client: PoolClient, crewId: string): Promise<void>;
  /**
   * ORG-SRS-006 (issue #29): đếm assignments đang mở của đội —
   * `assignments WHERE crew_id=$1 AND status IN ('PENDING_ACCEPTANCE','ACTIVE')`.
   * Dùng cho open-work warning; KHÔNG chặn transition (fail-closed: lỗi đếm → 500).
   */
  countOpenAssignments(crewId: string): Promise<number>;
  /**
   * ORG-SRS-007 (issue #30) — quản lý thành viên đội (role MEMBER).
   * LEAD tiếp tục qua PATCH /crews/:id leaderUserId swap; các method dưới
   * chỉ quản lý MEMBER. Mọi write chạy trong tx của use case.
   */
  listMembersWithClient(client: PoolClient, filter: CrewMemberFilter): Promise<CrewMemberRow[]>;
  /**
   * ORG-SRS-007 (issue #30, fix F7) — pool read cho tra cứu thuần SELECT
   * (không mở write transaction; pattern search-crews/findMany).
   */
  listMembers(filter: CrewMemberFilter): Promise<CrewMemberRow[]>;
  findMemberByIdWithClient(client: PoolClient, memberId: string): Promise<CrewMemberRow | null>;
  findActiveMemberWithClient(client: PoolClient, crewId: string, userId: string): Promise<CrewMemberRow | null>;
  /**
   * Active memberships (is_active) của user ở các đội KHÁC crewId cho trước —
   * overlap policy WARN (D3): vẫn 201 kèm warning MEMBER_IN_OTHER_CREW.
   */
  findActiveMembershipsOfUserWithClient(
    client: PoolClient,
    userId: string,
    excludeCrewId: string,
  ): Promise<Array<{ crewId: string; crewCode: string; crewName: string }>>;
  insertMemberWithClient(
    client: PoolClient,
    input: { crewId: string; userId: string; effectiveFrom: string; addedBy: string },
  ): Promise<CrewMemberRow>;
  deactivateMemberWithClient(
    client: PoolClient,
    memberId: string,
    effectiveTo: string,
  ): Promise<CrewMemberRow | null>;
  /**
   * ORG-SRS-008 (issue #31) — pool read thuần SELECT cho eligibility pre-check
   * (không mở write transaction; pattern search-crews/findMany).
   * Memberships hiệu lực (is_active) của user trên mọi đội, kèm code/tên đội
   * và ngày hiệu lực (phục vụ response `crews[]` + lọc point-in-time `at`).
   */
  findActiveMembershipsByUserId(
    userId: string,
  ): Promise<Array<{
    crewId: string;
    crewCode: string;
    crewName: string;
    memberRole: 'LEAD' | 'MEMBER';
    effectiveFrom: string;
    effectiveTo: string | null;
  }>>;
  /**
   * ORG-03/ORG-05 (Worker ↔ Crew link) — active memberships (is_active) của
   * user trên mọi đội, kèm crew status + role + ngày hiệu lực. Lịch sử cũ
   * (is_active=false) KHÔNG trả. Pool read thuần SELECT (pattern
   * findActiveMembershipsByUserId), không transaction, không audit.
   * Dùng cho `GET /api/v1/workers/:workerId/crews` và worker detail enrichment.
   */
  findMembershipsByUser(userId: string): Promise<WorkerCrewMembership[]>;
  /**
   * ORG-05 — batch cho worker list enrichment: MỘT query duy nhất cho mọi
   * userId (`user_id = ANY($1::uuid[])`), tránh N+1. Chỉ active memberships.
   */
  findMembershipsByUserIds(userIds: string[]): Promise<Array<WorkerCrewMembership & { userId: string }>>;
  /**
   * ORG-05 — batch cho crews list enrichment: MỘT query duy nhất cho mọi
   * crewId (LEFT JOIN LEAD active → users.full_name + COUNT crew_members
   * active), tránh N+1. Đội không có trong map → `{ leaderName: null,
   * memberCount: 0 }` ở use-case layer.
   */
  findListEnrichments(crewIds: string[]): Promise<Map<string, CrewListEnrichment>>;
  /**
   * ORG-SRS-008 (issue #31) — trades hiệu lực của đội
   * (`resource_trades` resource_type='CREW', is_active) cho
   * TRADE_CAPABILITY_DATA. Pool read, không transaction.
   */
  findActiveTradesByCrewId(crewId: string): Promise<Array<{ tradeId: string; skillLevel: number }>>;
  /**
   * Re-check crew status trong tx ngay trước insert (SELECT ... FOR UPDATE) —
   * đóng race đổi trạng thái đội (D4). Trả null khi crew không tồn tại.
   */
  findCrewForUpdateWithClient(
    client: PoolClient,
    crewId: string,
  ): Promise<{ id: string; code: string; name: string; status: string } | null>;
  /**
   * ORG-SRS-007 (issue #30, fix F5) — đọc crew cơ bản trong tx (SELECT thường,
   * không FOR UPDATE) cho audit before/after — tránh pool read ngoài tx.
   * Trả null khi crew không tồn tại.
   */
  findCrewByIdWithClient(
    client: PoolClient,
    crewId: string,
  ): Promise<{ id: string; code: string; name: string; status: string } | null>;
}

export const CREW_REPOSITORY = Symbol('CREW_REPOSITORY');
