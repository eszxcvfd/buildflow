import { Pool } from "pg";

const hasPg = Boolean(process.env.DATABASE_URL);
const describeIfPg = hasPg ? describe : describe.skip;

const businessTables = [
  "assignments",
  "checklist_instance_items",
  "checklist_instances",
  "checklist_template_items",
  "checklist_templates",
  "contractors",
  "corrective_actions",
  "crew_members",
  "crews",
  "inspection_checkpoint_templates",
  "inspection_checkpoints",
  "inspections",
  "material_supplement_requests",
  "materials",
  "project_areas",
  "projects",
  "readiness_check_items",
  "resource_trades",
  "trades",
  "work_order_blockers",
  "work_order_dependencies",
  "work_order_materials",
  "work_order_readiness_checks",
  "work_order_updates",
  "work_orders",
  "work_types",
] as const;

const supportTables = [
  "attachments",
  "audit_logs",
  "notifications",
  "project_members",
  "roles",
  "user_roles",
  "users",
  "work_order_state_history",
] as const;

const baselineTables = [...businessTables, ...supportTables].sort();

describeIfPg("DBD V2.1 PostgreSQL baseline (integration)", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("runs on PostgreSQL 18 and contains exactly 26 business plus 8 support tables", async () => {
    expect(businessTables).toHaveLength(26);
    expect(supportTables).toHaveLength(8);

    const version = await pool.query<{ server_version: string }>(
      "SHOW server_version",
    );
    expect(version.rows[0]?.server_version).toMatch(/^18\./);

    const tables = await pool.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
      ORDER BY table_name
    `);

    expect(tables.rows.map(({ table_name }) => table_name)).toEqual(
      baselineTables,
    );
  });

  it("enforces one ACTIVE assignment per Work Order", async () => {
    await expect(
      pool.query(`
        WITH actor AS (
          INSERT INTO users (email, password_hash, full_name)
          VALUES ('assignment-' || gen_random_uuid() || '@example.test', 'hash', 'Worker')
          RETURNING id
        ), project AS (
          INSERT INTO projects (
            code, name, address, planned_start_date, planned_end_date,
            manager_id, created_by
          )
          SELECT 'PRJ-' || gen_random_uuid(), 'Project', 'Site', CURRENT_DATE,
                 CURRENT_DATE + 1, id, id
          FROM actor
          RETURNING id
        ), work_type AS (
          INSERT INTO work_types (code, name)
          VALUES ('WT-' || gen_random_uuid(), 'Work Type')
          RETURNING id
        ), work_order AS (
          INSERT INTO work_orders (
            code, project_id, work_type_id, title, created_by
          )
          SELECT 'WO-' || gen_random_uuid(), project.id, work_type.id,
                 'Work Order', actor.id
          FROM project, work_type, actor
          RETURNING id
        )
        INSERT INTO assignments (
          work_order_id, assignee_type, worker_id, responsible_user_id,
          source, status
        )
        SELECT work_order.id, 'USER', actor.id, actor.id, 'SELF_ACCEPT', 'ACTIVE'
        FROM work_order, actor, generate_series(1, 2)
      `),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("requires a concrete responsible party for every blocker", async () => {
    await expect(
      pool.query(`
        WITH actor AS (
          INSERT INTO users (email, password_hash, full_name)
          VALUES ('blocker-' || gen_random_uuid() || '@example.test', 'hash', 'Worker')
          RETURNING id
        ), project AS (
          INSERT INTO projects (
            code, name, address, planned_start_date, planned_end_date,
            manager_id, created_by
          )
          SELECT 'PRJ-' || gen_random_uuid(), 'Project', 'Site', CURRENT_DATE,
                 CURRENT_DATE + 1, id, id
          FROM actor
          RETURNING id
        ), work_type AS (
          INSERT INTO work_types (code, name)
          VALUES ('WT-' || gen_random_uuid(), 'Work Type')
          RETURNING id
        ), work_order AS (
          INSERT INTO work_orders (
            code, project_id, work_type_id, title, created_by
          )
          SELECT 'WO-' || gen_random_uuid(), project.id, work_type.id,
                 'Work Order', actor.id
          FROM project, work_type, actor
          RETURNING id
        )
        INSERT INTO work_order_blockers (
          work_order_id, blocker_type, description, reported_by,
          responsible_party_type
        )
        SELECT work_order.id, 'OTHER', 'Missing responsible party', actor.id, 'USER'
        FROM work_order, actor
      `),
    ).rejects.toMatchObject({ code: "23514" });
  });
});
