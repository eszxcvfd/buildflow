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
}

export const CREW_REPOSITORY = Symbol('CREW_REPOSITORY');
