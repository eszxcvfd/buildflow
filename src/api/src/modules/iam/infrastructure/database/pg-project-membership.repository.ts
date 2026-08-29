import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { ProjectMembershipRepositoryPort } from '../../domain/repository/project-membership-repository.port';
import { loadConfig } from '../../../../config/configuration';

function getPool(): Pool {
  const config = loadConfig();
  const g = globalThis as unknown as { __pgPool?: Pool };
  if (g.__pgPool) return g.__pgPool;
  g.__pgPool = new Pool({ connectionString: config.databaseUrl, max: 5 });
  return g.__pgPool;
}

@Injectable()
export class PgProjectMembershipRepository implements ProjectMembershipRepositoryPort {
  private pool(): Pool { return getPool(); }

  async isMember(userId: string, projectId: string): Promise<boolean> {
    const result = await this.pool().query(
      `SELECT 1 FROM public.project_members
       WHERE user_id = $1 AND project_id = $2 AND is_active = true LIMIT 1`,
      [userId, projectId],
    );
    return result.rows.length > 0;
  }

  async findActiveProjectIdsByUserId(userId: string): Promise<string[]> {
    const result = await this.pool().query(
      `SELECT project_id FROM public.project_members
       WHERE user_id = $1 AND is_active = true`,
      [userId],
    );
    return result.rows.map((r: Record<string, unknown>) => String(r['project_id']));
  }

  async findActiveMemberUserIdsByProjectId(projectId: string): Promise<string[]> {
    const result = await this.pool().query(
      `SELECT user_id FROM public.project_members
       WHERE project_id = $1 AND is_active = true`,
      [projectId],
    );
    return result.rows.map((r: Record<string, unknown>) => String(r['user_id']));
  }
}
