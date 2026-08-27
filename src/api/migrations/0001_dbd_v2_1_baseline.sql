-- Buildflow database baseline
-- DBD-CWM-QC-002 v2.1 / PostgreSQL 15+
-- Migration: 0001_dbd_v2_1_baseline
--
-- This is a forward-only schema migration. It creates the 26 business tables
-- and 8 system-support tables described in DBD.md. Cross-table business rules
-- (eligibility, dependency cycles, readiness gates, Hold Point release and
-- quality close) remain service/transaction rules as required by DBD.md.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

SET TIME ZONE 'UTC';

CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(100) NOT NULL,
  description varchar(500),
  is_system boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(120) NOT NULL,
  description varchar(500),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  full_name varchar(150) NOT NULL,
  phone varchar(20),
  avatar_url varchar(500),
  employee_code varchar(50),
  user_type varchar(20) NOT NULL DEFAULT 'STAFF',
  contractor_id uuid,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  failed_login_count smallint NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_user_type_ck CHECK (user_type IN ('STAFF', 'WORKER')),
  CONSTRAINT users_status_ck CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
  CONSTRAINT users_failed_login_count_ck CHECK (failed_login_count >= 0)
);

CREATE TABLE public.contractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,
  contact_name varchar(150),
  phone varchar(20),
  email varchar(255),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  note varchar(1000),
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT contractors_status_ck CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

ALTER TABLE public.users
  ADD CONSTRAINT users_contractor_fk
  FOREIGN KEY (contractor_id) REFERENCES public.contractors(id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id),
  role_id uuid NOT NULL REFERENCES public.roles(id),
  assigned_by uuid REFERENCES public.users(id),
  assigned_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_by uuid REFERENCES public.users(id),
  revoked_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT user_roles_revocation_ck CHECK (is_active OR revoked_at IS NOT NULL)
);

CREATE TABLE public.resource_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type varchar(10) NOT NULL,
  user_id uuid REFERENCES public.users(id),
  crew_id uuid,
  trade_id uuid NOT NULL REFERENCES public.trades(id),
  skill_level smallint NOT NULL DEFAULT 1,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT resource_trades_type_ck CHECK (resource_type IN ('USER', 'CREW')),
  CONSTRAINT resource_trades_owner_ck CHECK (
    (resource_type = 'USER' AND user_id IS NOT NULL AND crew_id IS NULL)
    OR
    (resource_type = 'CREW' AND user_id IS NULL AND crew_id IS NOT NULL)
  ),
  CONSTRAINT resource_trades_skill_level_ck CHECK (skill_level BETWEEN 1 AND 5),
  CONSTRAINT resource_trades_effective_dates_ck CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE TABLE public.crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(120) NOT NULL,
  contractor_id uuid REFERENCES public.contractors(id),
  description varchar(500),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE',
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT crews_status_ck CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

ALTER TABLE public.resource_trades
  ADD CONSTRAINT resource_trades_crew_fk
  FOREIGN KEY (crew_id) REFERENCES public.crews(id);

CREATE TABLE public.crew_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.crews(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  member_role varchar(20) NOT NULL DEFAULT 'MEMBER',
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  is_active boolean NOT NULL DEFAULT true,
  added_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT crew_members_role_ck CHECK (member_role IN ('LEAD', 'MEMBER')),
  CONSTRAINT crew_members_effective_dates_ck CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  ),
  CONSTRAINT crew_members_revocation_ck CHECK (is_active OR effective_to IS NOT NULL)
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,
  description text,
  address varchar(500) NOT NULL,
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  planned_start_date date NOT NULL,
  planned_end_date date NOT NULL,
  actual_end_date date,
  manager_id uuid NOT NULL REFERENCES public.users(id),
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT projects_status_ck CHECK (
    status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CLOSED')
  ),
  CONSTRAINT projects_planned_dates_ck CHECK (planned_end_date >= planned_start_date)
);

CREATE TABLE public.project_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  code varchar(50) NOT NULL,
  name varchar(150) NOT NULL,
  description varchar(500),
  display_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_areas_display_order_ck CHECK (display_order >= 0)
);

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  user_id uuid NOT NULL REFERENCES public.users(id),
  project_role varchar(30) NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  added_by uuid NOT NULL REFERENCES public.users(id),
  CONSTRAINT project_members_role_ck CHECK (
    project_role IN ('MANAGER', 'COORDINATOR', 'QC', 'WORKER', 'VIEWER')
  ),
  CONSTRAINT project_members_membership_dates_ck CHECK (
    left_at IS NULL OR left_at >= joined_at
  ),
  CONSTRAINT project_members_revocation_ck CHECK (is_active OR left_at IS NOT NULL)
);

CREATE TABLE public.work_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(150) NOT NULL,
  description varchar(500),
  required_trade_id uuid REFERENCES public.trades(id),
  default_duration_minutes integer,
  default_priority varchar(10) NOT NULL DEFAULT 'NORMAL',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT work_types_duration_ck CHECK (
    default_duration_minutes IS NULL OR default_duration_minutes > 0
  ),
  CONSTRAINT work_types_priority_ck CHECK (
    default_priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')
  )
);

CREATE TABLE public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  area_id uuid REFERENCES public.project_areas(id),
  work_type_id uuid NOT NULL REFERENCES public.work_types(id),
  required_trade_id uuid REFERENCES public.trades(id),
  title varchar(200) NOT NULL,
  description text,
  instructions text,
  priority varchar(10) NOT NULL DEFAULT 'NORMAL',
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  due_at timestamptz,
  actual_start_at timestamptz,
  work_done_at timestamptz,
  closed_at timestamptz,
  progress_percent smallint NOT NULL DEFAULT 0,
  job_board_open boolean NOT NULL DEFAULT false,
  job_board_open_from timestamptz,
  job_board_open_until timestamptz,
  planned_headcount smallint,
  cancel_reason varchar(500),
  created_by uuid NOT NULL REFERENCES public.users(id),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT work_orders_priority_ck CHECK (
    priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')
  ),
  CONSTRAINT work_orders_status_ck CHECK (
    status IN (
      'DRAFT', 'READY', 'OPEN', 'ASSIGNED', 'IN_PROGRESS',
      'WORK_DONE', 'CLOSED', 'CANCELLED'
    )
  ),
  CONSTRAINT work_orders_planned_dates_ck CHECK (
    planned_start_at IS NULL
    OR planned_end_at IS NULL
    OR planned_end_at >= planned_start_at
  ),
  CONSTRAINT work_orders_job_board_dates_ck CHECK (
    job_board_open_from IS NULL
    OR job_board_open_until IS NULL
    OR job_board_open_until >= job_board_open_from
  ),
  CONSTRAINT work_orders_progress_ck CHECK (progress_percent BETWEEN 0 AND 100),
  CONSTRAINT work_orders_headcount_ck CHECK (
    planned_headcount IS NULL OR planned_headcount > 0
  ),
  CONSTRAINT work_orders_version_ck CHECK (version >= 1)
);

CREATE TABLE public.work_order_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  predecessor_work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  dependency_type varchar(20) NOT NULL DEFAULT 'FINISH_TO_START',
  is_blocking boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT work_order_dependencies_type_ck CHECK (
    dependency_type IN ('FINISH_TO_START')
  ),
  CONSTRAINT work_order_dependencies_self_ck CHECK (
    work_order_id <> predecessor_work_order_id
  )
);

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  assignee_type varchar(10) NOT NULL,
  worker_id uuid REFERENCES public.users(id),
  crew_id uuid REFERENCES public.crews(id),
  responsible_user_id uuid NOT NULL REFERENCES public.users(id),
  source varchar(25) NOT NULL,
  status varchar(25) NOT NULL DEFAULT 'ACTIVE',
  requires_acceptance boolean NOT NULL DEFAULT false,
  assigned_by uuid REFERENCES public.users(id),
  assigned_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_by uuid REFERENCES public.users(id),
  responded_at timestamptz,
  response_reason varchar(500),
  ended_at timestamptz,
  end_reason varchar(500),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT assignments_assignee_type_ck CHECK (assignee_type IN ('USER', 'CREW')),
  CONSTRAINT assignments_assignee_ck CHECK (
    (assignee_type = 'USER' AND worker_id IS NOT NULL AND crew_id IS NULL)
    OR
    (assignee_type = 'CREW' AND worker_id IS NULL AND crew_id IS NOT NULL)
  ),
  CONSTRAINT assignments_source_ck CHECK (
    source IN ('SELF_ACCEPT', 'DIRECT_ASSIGNMENT', 'REASSIGNMENT')
  ),
  CONSTRAINT assignments_status_ck CHECK (
    status IN ('PENDING_ACCEPTANCE', 'ACTIVE', 'ENDED', 'WITHDRAWN', 'REJECTED')
  )
);

CREATE TABLE public.work_order_state_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  from_status varchar(20),
  to_status varchar(20) NOT NULL,
  changed_by uuid REFERENCES public.users(id),
  assignment_id uuid REFERENCES public.assignments(id),
  reason varchar(500),
  changed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  correlation_id uuid,
  CONSTRAINT work_order_state_history_from_status_ck CHECK (
    from_status IS NULL OR from_status IN (
      'DRAFT', 'READY', 'OPEN', 'ASSIGNED', 'IN_PROGRESS',
      'WORK_DONE', 'CLOSED', 'CANCELLED'
    )
  ),
  CONSTRAINT work_order_state_history_to_status_ck CHECK (
    to_status IN (
      'DRAFT', 'READY', 'OPEN', 'ASSIGNED', 'IN_PROGRESS',
      'WORK_DONE', 'CLOSED', 'CANCELLED'
    )
  )
);

CREATE TABLE public.work_order_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  update_type varchar(30) NOT NULL,
  progress_percent smallint,
  content text,
  occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by uuid NOT NULL REFERENCES public.users(id),
  client_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT work_order_updates_type_ck CHECK (
    update_type IN (
      'START', 'PROGRESS', 'DAILY_LOG', 'NOTE', 'PAUSE',
      'RESUME', 'WORK_DONE_SUBMISSION'
    )
  ),
  CONSTRAINT work_order_updates_progress_ck CHECK (
    progress_percent IS NULL OR progress_percent BETWEEN 0 AND 100
  )
);

CREATE TABLE public.work_order_readiness_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  attempt_no smallint NOT NULL DEFAULT 1,
  overall_status varchar(30) NOT NULL,
  checked_by uuid NOT NULL REFERENCES public.users(id),
  checked_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note varchar(1000),
  overridden_by uuid REFERENCES public.users(id),
  override_reason varchar(1000),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT readiness_checks_attempt_ck CHECK (attempt_no > 0),
  CONSTRAINT readiness_checks_status_ck CHECK (
    overall_status IN ('READY', 'READY_WITH_CONSTRAINT', 'NOT_READY')
  )
);

CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(200) NOT NULL,
  category varchar(100),
  unit varchar(30) NOT NULL,
  description varchar(500),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE public.work_order_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  material_id uuid NOT NULL REFERENCES public.materials(id),
  planned_quantity numeric(12,3) NOT NULL,
  available_quantity numeric(12,3),
  readiness_status varchar(20) NOT NULL DEFAULT 'NOT_CHECKED',
  last_checked_by uuid REFERENCES public.users(id),
  last_checked_at timestamptz,
  note varchar(500),
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT work_order_materials_planned_quantity_ck CHECK (planned_quantity > 0),
  CONSTRAINT work_order_materials_available_quantity_ck CHECK (
    available_quantity IS NULL OR available_quantity >= 0
  ),
  CONSTRAINT work_order_materials_status_ck CHECK (
    readiness_status IN ('NOT_CHECKED', 'READY', 'SHORTAGE')
  )
);

CREATE TABLE public.checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL,
  name varchar(150) NOT NULL,
  work_type_id uuid REFERENCES public.work_types(id),
  purpose varchar(20) NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status varchar(15) NOT NULL DEFAULT 'DRAFT',
  description varchar(500),
  created_by uuid NOT NULL REFERENCES public.users(id),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT checklist_templates_purpose_ck CHECK (
    purpose IN ('PRE_START', 'INSPECTION', 'WORK_DONE')
  ),
  CONSTRAINT checklist_templates_version_ck CHECK (version > 0),
  CONSTRAINT checklist_templates_status_ck CHECK (
    status IN ('DRAFT', 'ACTIVE', 'INACTIVE')
  )
);

CREATE TABLE public.checklist_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id),
  sequence_no smallint NOT NULL,
  title varchar(250) NOT NULL,
  description varchar(500),
  answer_type varchar(20) NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  is_blocking boolean NOT NULL DEFAULT false,
  requires_photo boolean NOT NULL DEFAULT false,
  min_value numeric(12,3),
  max_value numeric(12,3),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT checklist_template_items_sequence_ck CHECK (sequence_no > 0),
  CONSTRAINT checklist_template_items_answer_type_ck CHECK (
    answer_type IN ('YES_NO', 'TEXT', 'NUMBER', 'PASS_FAIL')
  ),
  CONSTRAINT checklist_template_items_value_range_ck CHECK (
    min_value IS NULL OR max_value IS NULL OR max_value >= min_value
  )
);

CREATE TABLE public.inspection_checkpoint_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_type_id uuid NOT NULL REFERENCES public.work_types(id),
  code varchar(50) NOT NULL,
  name varchar(150) NOT NULL,
  checkpoint_type varchar(20) NOT NULL,
  sequence_no smallint NOT NULL,
  stage_label varchar(150),
  is_blocking boolean NOT NULL DEFAULT false,
  checklist_template_id uuid REFERENCES public.checklist_templates(id),
  required_role_id uuid REFERENCES public.roles(id),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT checkpoint_templates_type_ck CHECK (
    checkpoint_type IN ('PRE_ACTIVITY', 'HOLD_POINT', 'FINAL', 'WITNESS_POINT')
  ),
  CONSTRAINT checkpoint_templates_sequence_ck CHECK (sequence_no > 0)
);

CREATE TABLE public.inspection_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  source_template_id uuid REFERENCES public.inspection_checkpoint_templates(id),
  checkpoint_type varchar(20) NOT NULL,
  sequence_no smallint NOT NULL,
  stage_label varchar(150),
  is_blocking boolean NOT NULL DEFAULT false,
  checklist_template_id uuid REFERENCES public.checklist_templates(id),
  required_role_id uuid REFERENCES public.roles(id),
  status varchar(25) NOT NULL DEFAULT 'PENDING',
  requested_by uuid REFERENCES public.users(id),
  requested_at timestamptz,
  released_by uuid REFERENCES public.users(id),
  released_at timestamptz,
  witness_notified_at timestamptz,
  witness_attendance varchar(20),
  note varchar(1000),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inspection_checkpoints_type_ck CHECK (
    checkpoint_type IN ('PRE_ACTIVITY', 'HOLD_POINT', 'FINAL', 'WITNESS_POINT')
  ),
  CONSTRAINT inspection_checkpoints_sequence_ck CHECK (sequence_no > 0),
  CONSTRAINT inspection_checkpoints_status_ck CHECK (
    status IN (
      'PENDING', 'READY_FOR_INSPECTION', 'IN_PROGRESS',
      'RELEASED', 'FAILED', 'CANCELLED'
    )
  ),
  CONSTRAINT inspection_checkpoints_witness_attendance_ck CHECK (
    witness_attendance IS NULL
    OR witness_attendance IN ('ATTENDED', 'NOT_ATTENDED', 'WAIVED')
  )
);

CREATE TABLE public.checklist_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  template_id uuid NOT NULL REFERENCES public.checklist_templates(id),
  checkpoint_id uuid REFERENCES public.inspection_checkpoints(id),
  purpose varchar(20) NOT NULL,
  instance_no smallint NOT NULL DEFAULT 1,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  assigned_user_id uuid REFERENCES public.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT checklist_instances_purpose_ck CHECK (
    purpose IN ('PRE_START', 'INSPECTION', 'WORK_DONE')
  ),
  CONSTRAINT checklist_instances_instance_no_ck CHECK (instance_no > 0),
  CONSTRAINT checklist_instances_status_ck CHECK (
    status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')
  )
);

CREATE TABLE public.checklist_instance_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_instance_id uuid NOT NULL REFERENCES public.checklist_instances(id),
  source_template_item_id uuid REFERENCES public.checklist_template_items(id),
  sequence_no smallint NOT NULL,
  title_snapshot varchar(250) NOT NULL,
  answer_type_snapshot varchar(20) NOT NULL,
  is_required_snapshot boolean NOT NULL,
  is_blocking_snapshot boolean NOT NULL,
  requires_photo_snapshot boolean NOT NULL,
  answer_text text,
  answer_number numeric(12,3),
  answer_boolean boolean,
  result varchar(15),
  note varchar(1000),
  answered_by uuid REFERENCES public.users(id),
  answered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT checklist_instance_items_sequence_ck CHECK (sequence_no > 0),
  CONSTRAINT checklist_instance_items_answer_type_ck CHECK (
    answer_type_snapshot IN ('YES_NO', 'TEXT', 'NUMBER', 'PASS_FAIL')
  ),
  CONSTRAINT checklist_instance_items_result_ck CHECK (
    result IS NULL OR result IN ('PASS', 'FAIL', 'N/A')
  )
);

CREATE TABLE public.readiness_check_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  readiness_check_id uuid NOT NULL REFERENCES public.work_order_readiness_checks(id),
  category varchar(30) NOT NULL,
  result varchar(25) NOT NULL,
  is_blocking boolean NOT NULL DEFAULT false,
  dependency_id uuid REFERENCES public.work_order_dependencies(id),
  work_order_material_id uuid REFERENCES public.work_order_materials(id),
  checkpoint_id uuid REFERENCES public.inspection_checkpoints(id),
  note varchar(1000),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT readiness_check_items_category_ck CHECK (
    category IN (
      'DEPENDENCY', 'SITE_ACCESS', 'MANPOWER', 'MATERIAL',
      'INFORMATION', 'CHECKLIST', 'INSPECTION', 'OTHER'
    )
  ),
  CONSTRAINT readiness_check_items_result_ck CHECK (
    result IN ('READY', 'CONSTRAINT', 'BLOCKING', 'NOT_APPLICABLE')
  )
);

CREATE TABLE public.work_order_blockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  readiness_item_id uuid REFERENCES public.readiness_check_items(id),
  blocker_type varchar(30) NOT NULL,
  impact_level varchar(10) NOT NULL DEFAULT 'MEDIUM',
  is_blocking boolean NOT NULL DEFAULT true,
  description text NOT NULL,
  reported_by uuid NOT NULL REFERENCES public.users(id),
  responsible_party_type varchar(15) NOT NULL DEFAULT 'UNASSIGNED',
  responsible_user_id uuid REFERENCES public.users(id),
  responsible_crew_id uuid REFERENCES public.crews(id),
  responsible_note varchar(250),
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  opened_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at timestamptz,
  resolving_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT work_order_blockers_type_ck CHECK (
    blocker_type IN (
      'DEPENDENCY', 'SITE_ACCESS', 'MATERIAL', 'DRAWING_INFORMATION',
      'MANPOWER', 'EQUIPMENT', 'WEATHER', 'SAFETY',
      'CLIENT_CONSULTANT', 'OTHER'
    )
  ),
  CONSTRAINT work_order_blockers_impact_ck CHECK (
    impact_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
  ),
  CONSTRAINT work_order_blockers_party_type_ck CHECK (
    responsible_party_type IN ('USER', 'CREW', 'EXTERNAL', 'UNASSIGNED')
  ),
  CONSTRAINT work_order_blockers_status_ck CHECK (
    status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVING', 'RESOLVED', 'CANCELLED')
  ),
  CONSTRAINT work_order_blockers_dates_ck CHECK (
    resolved_at IS NULL OR resolved_at >= opened_at
  )
);

CREATE TABLE public.material_supplement_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code varchar(50) NOT NULL,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  work_order_material_id uuid REFERENCES public.work_order_materials(id),
  material_id uuid NOT NULL REFERENCES public.materials(id),
  requested_quantity numeric(12,3) NOT NULL,
  reason varchar(1000) NOT NULL,
  is_blocking boolean NOT NULL DEFAULT false,
  blocker_id uuid REFERENCES public.work_order_blockers(id),
  status varchar(20) NOT NULL DEFAULT 'REQUESTED',
  requested_by uuid NOT NULL REFERENCES public.users(id),
  requested_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by uuid REFERENCES public.users(id),
  acknowledged_at timestamptz,
  fulfilled_by uuid REFERENCES public.users(id),
  fulfilled_at timestamptz,
  cancelled_by uuid REFERENCES public.users(id),
  cancelled_at timestamptz,
  cancel_reason varchar(500),
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT material_supplement_requests_quantity_ck CHECK (requested_quantity > 0),
  CONSTRAINT material_supplement_requests_blocker_ck CHECK (
    NOT is_blocking OR blocker_id IS NOT NULL
  ),
  CONSTRAINT material_supplement_requests_status_ck CHECK (
    status IN ('REQUESTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'FULFILLED', 'CANCELLED')
  )
);

CREATE TABLE public.inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkpoint_id uuid NOT NULL REFERENCES public.inspection_checkpoints(id),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  checklist_instance_id uuid REFERENCES public.checklist_instances(id),
  inspector_id uuid NOT NULL REFERENCES public.users(id),
  round_number smallint NOT NULL DEFAULT 1,
  status varchar(25) NOT NULL DEFAULT 'PENDING',
  summary text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT inspections_round_number_ck CHECK (round_number > 0),
  CONSTRAINT inspections_status_ck CHECK (
    status IN ('PENDING', 'IN_PROGRESS', 'PASS', 'FAIL', 'CONDITIONAL_PASS', 'CANCELLED')
  )
);

CREATE TABLE public.corrective_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.inspections(id),
  checklist_instance_item_id uuid REFERENCES public.checklist_instance_items(id),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id),
  assignee_type varchar(10) NOT NULL,
  assigned_user_id uuid REFERENCES public.users(id),
  assigned_crew_id uuid REFERENCES public.crews(id),
  title varchar(250) NOT NULL,
  description text NOT NULL,
  severity varchar(10) NOT NULL DEFAULT 'MEDIUM',
  is_mandatory boolean NOT NULL DEFAULT true,
  due_at timestamptz,
  status varchar(20) NOT NULL DEFAULT 'OPEN',
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid REFERENCES public.users(id),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT corrective_actions_assignee_type_ck CHECK (assignee_type IN ('USER', 'CREW')),
  CONSTRAINT corrective_actions_assignee_xor_ck CHECK (
    (
      assignee_type = 'USER'
      AND assigned_user_id IS NOT NULL
      AND assigned_crew_id IS NULL
    )
    OR
    (
      assignee_type = 'CREW'
      AND assigned_user_id IS NULL
      AND assigned_crew_id IS NOT NULL
    )
  ),
  CONSTRAINT corrective_actions_severity_ck CHECK (
    severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
  ),
  CONSTRAINT corrective_actions_status_ck CHECK (
    status IN ('OPEN', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED', 'REJECTED')
  )
);

CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  work_order_id uuid REFERENCES public.work_orders(id),
  owner_type varchar(40) NOT NULL,
  owner_id uuid NOT NULL,
  attachment_type varchar(30) NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.users(id),
  file_name varchar(255) NOT NULL,
  storage_key varchar(500) NOT NULL,
  mime_type varchar(100) NOT NULL,
  size_bytes bigint NOT NULL,
  caption varchar(500),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT attachments_owner_type_ck CHECK (
    owner_type IN (
      'PROJECT', 'WORK_ORDER', 'UPDATE', 'READINESS_ITEM', 'BLOCKER',
      'MATERIAL_SUPPLEMENT', 'CHECKLIST_ITEM', 'INSPECTION',
      'CORRECTIVE_ACTION'
    )
  ),
  CONSTRAINT attachments_type_ck CHECK (
    attachment_type IN (
      'DOCUMENT', 'PROGRESS_EVIDENCE', 'CHECKLIST_EVIDENCE',
      'INSPECTION_EVIDENCE', 'REWORK_EVIDENCE', 'MATERIAL_EVIDENCE',
      'BLOCKER_EVIDENCE'
    )
  ),
  CONSTRAINT attachments_size_ck CHECK (size_bytes > 0)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES public.users(id),
  notification_type varchar(50) NOT NULL,
  title varchar(200) NOT NULL,
  content varchar(1000) NOT NULL,
  entity_type varchar(40),
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  dedup_key varchar(160),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notifications_read_state_ck CHECK (NOT is_read OR read_at IS NOT NULL)
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.users(id),
  action varchar(80) NOT NULL,
  entity_type varchar(50) NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason varchar(1000),
  result varchar(15) NOT NULL DEFAULT 'SUCCESS',
  ip_address inet,
  user_agent varchar(500),
  correlation_id uuid,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT audit_logs_result_ck CHECK (result IN ('SUCCESS', 'FAILED'))
);

-- Uniqueness and lookup indexes from DBD.md. Cross-table invariants remain in
-- application/service transactions and are intentionally not encoded as SQL
-- CHECK constraints.

CREATE UNIQUE INDEX ux_users_email_lower
  ON public.users (lower(email));
CREATE UNIQUE INDEX ux_users_phone
  ON public.users (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX ux_users_employee_code
  ON public.users (employee_code) WHERE employee_code IS NOT NULL;
CREATE INDEX ix_users_status_type
  ON public.users (status, user_type);
CREATE INDEX ix_users_contractor
  ON public.users (contractor_id);

CREATE UNIQUE INDEX ux_roles_code
  ON public.roles (code);
CREATE INDEX ix_roles_active
  ON public.roles (is_active);

CREATE UNIQUE INDEX ux_user_roles_active
  ON public.user_roles (user_id, role_id) WHERE is_active;
CREATE INDEX ix_user_roles_role_active
  ON public.user_roles (role_id, is_active);

CREATE UNIQUE INDEX ux_contractors_code
  ON public.contractors (code);
CREATE INDEX ix_contractors_status_name
  ON public.contractors (status, name);

CREATE UNIQUE INDEX ux_trades_code
  ON public.trades (code);
CREATE INDEX ix_trades_active_name
  ON public.trades (is_active, name);

CREATE UNIQUE INDEX ux_resource_trades_user_active
  ON public.resource_trades (user_id, trade_id)
  WHERE is_active AND user_id IS NOT NULL;
CREATE UNIQUE INDEX ux_resource_trades_crew_active
  ON public.resource_trades (crew_id, trade_id)
  WHERE is_active AND crew_id IS NOT NULL;
CREATE INDEX ix_resource_trades_trade_active
  ON public.resource_trades (trade_id, is_active);

CREATE UNIQUE INDEX ux_crews_code
  ON public.crews (code);
CREATE INDEX ix_crews_status_name
  ON public.crews (status, name);
CREATE INDEX ix_crews_contractor
  ON public.crews (contractor_id);

CREATE UNIQUE INDEX ux_crew_member_active
  ON public.crew_members (crew_id, user_id) WHERE is_active;
CREATE UNIQUE INDEX ux_crew_one_active_lead
  ON public.crew_members (crew_id)
  WHERE is_active AND member_role = 'LEAD';
CREATE INDEX ix_crew_members_user_active
  ON public.crew_members (user_id, is_active);

CREATE UNIQUE INDEX ux_projects_code
  ON public.projects (code);
CREATE INDEX ix_projects_status_dates
  ON public.projects (status, planned_start_date, planned_end_date);
CREATE INDEX ix_projects_manager
  ON public.projects (manager_id);

CREATE UNIQUE INDEX ux_project_areas_project_code
  ON public.project_areas (project_id, code);
CREATE INDEX ix_project_areas_active
  ON public.project_areas (project_id, is_active, display_order);

CREATE UNIQUE INDEX ux_project_members_active
  ON public.project_members (project_id, user_id) WHERE is_active;
CREATE INDEX ix_project_members_user_active
  ON public.project_members (user_id, is_active);

CREATE UNIQUE INDEX ux_work_types_code
  ON public.work_types (code);
CREATE INDEX ix_work_types_trade_active
  ON public.work_types (required_trade_id, is_active);

CREATE UNIQUE INDEX ux_work_orders_code
  ON public.work_orders (code);
CREATE INDEX ix_work_orders_project_status
  ON public.work_orders (project_id, status);
CREATE INDEX ix_work_orders_job_board
  ON public.work_orders (
    job_board_open, status, job_board_open_from, job_board_open_until
  );
CREATE INDEX ix_work_orders_schedule
  ON public.work_orders (planned_start_at, planned_end_at);
CREATE INDEX ix_work_orders_type_status
  ON public.work_orders (work_type_id, status);

CREATE UNIQUE INDEX ux_wo_dependencies_pair
  ON public.work_order_dependencies (work_order_id, predecessor_work_order_id);
CREATE INDEX ix_wo_dependencies_predecessor
  ON public.work_order_dependencies (predecessor_work_order_id);

CREATE UNIQUE INDEX ux_assignments_current
  ON public.assignments (work_order_id)
  WHERE status IN ('PENDING_ACCEPTANCE', 'ACTIVE');
CREATE INDEX ix_assignments_worker_status
  ON public.assignments (worker_id, status);
CREATE INDEX ix_assignments_crew_status
  ON public.assignments (crew_id, status);
CREATE INDEX ix_assignments_responsible
  ON public.assignments (responsible_user_id, status);

CREATE INDEX ix_wo_history_time
  ON public.work_order_state_history (work_order_id, changed_at);
CREATE INDEX ix_wo_history_actor
  ON public.work_order_state_history (changed_by, changed_at);

CREATE INDEX ix_wo_updates_time
  ON public.work_order_updates (work_order_id, occurred_at);
CREATE UNIQUE INDEX ux_wo_updates_client_request
  ON public.work_order_updates (client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX ux_readiness_attempt
  ON public.work_order_readiness_checks (work_order_id, attempt_no);
CREATE INDEX ix_readiness_status
  ON public.work_order_readiness_checks (work_order_id, overall_status, checked_at);

CREATE INDEX ix_readiness_items_check
  ON public.readiness_check_items (readiness_check_id, category);
CREATE INDEX ix_readiness_items_blocking
  ON public.readiness_check_items (readiness_check_id, is_blocking, result);

CREATE INDEX ix_blockers_work_status
  ON public.work_order_blockers (work_order_id, status);
CREATE INDEX ix_blockers_type_status
  ON public.work_order_blockers (blocker_type, status);
CREATE INDEX ix_blockers_responsible_user
  ON public.work_order_blockers (responsible_user_id, status);
CREATE INDEX ix_blockers_opened
  ON public.work_order_blockers (opened_at);

CREATE UNIQUE INDEX ux_materials_code
  ON public.materials (code);
CREATE INDEX ix_materials_active_name
  ON public.materials (is_active, category, name);

CREATE UNIQUE INDEX ux_wo_materials_pair
  ON public.work_order_materials (work_order_id, material_id);
CREATE INDEX ix_wo_materials_readiness
  ON public.work_order_materials (work_order_id, readiness_status);

CREATE UNIQUE INDEX ux_material_supplement_code
  ON public.material_supplement_requests (request_code);
CREATE INDEX ix_material_supplement_work_status
  ON public.material_supplement_requests (work_order_id, status);
CREATE INDEX ix_material_supplement_material
  ON public.material_supplement_requests (material_id, status);

CREATE UNIQUE INDEX ux_checklist_template_version
  ON public.checklist_templates (code, version);
CREATE INDEX ix_checklist_template_scope
  ON public.checklist_templates (work_type_id, purpose, status);

CREATE UNIQUE INDEX ux_checklist_item_sequence
  ON public.checklist_template_items (template_id, sequence_no);

CREATE INDEX ix_checklist_instances_work
  ON public.checklist_instances (work_order_id, purpose, status);
CREATE INDEX ix_checklist_instances_checkpoint
  ON public.checklist_instances (checkpoint_id);

CREATE UNIQUE INDEX ux_checklist_instance_item_seq
  ON public.checklist_instance_items (checklist_instance_id, sequence_no);
CREATE INDEX ix_checklist_instance_item_result
  ON public.checklist_instance_items (checklist_instance_id, result);

CREATE UNIQUE INDEX ux_checkpoint_tpl_code
  ON public.inspection_checkpoint_templates (work_type_id, code);
CREATE INDEX ix_checkpoint_tpl_order
  ON public.inspection_checkpoint_templates (work_type_id, is_active, sequence_no);

CREATE UNIQUE INDEX ux_inspection_checkpoints_work_sequence
  ON public.inspection_checkpoints (work_order_id, sequence_no);
CREATE INDEX ix_checkpoints_work_status
  ON public.inspection_checkpoints (work_order_id, status, sequence_no);
CREATE INDEX ix_checkpoints_type_status
  ON public.inspection_checkpoints (checkpoint_type, status);
CREATE INDEX ix_checkpoints_required_role
  ON public.inspection_checkpoints (required_role_id, status);

CREATE UNIQUE INDEX ux_inspections_checkpoint_round
  ON public.inspections (checkpoint_id, round_number);
CREATE INDEX ix_inspections_work_status
  ON public.inspections (work_order_id, status);
CREATE INDEX ix_inspections_inspector_status
  ON public.inspections (inspector_id, status);

CREATE INDEX ix_corrective_work_status
  ON public.corrective_actions (work_order_id, status);
CREATE INDEX ix_corrective_user_status
  ON public.corrective_actions (assigned_user_id, status, due_at);
CREATE INDEX ix_corrective_crew_status
  ON public.corrective_actions (assigned_crew_id, status, due_at);
CREATE INDEX ix_corrective_inspection
  ON public.corrective_actions (inspection_id);

CREATE UNIQUE INDEX ux_attachments_storage_key
  ON public.attachments (storage_key);
CREATE INDEX ix_attachments_context
  ON public.attachments (project_id, work_order_id);
CREATE INDEX ix_attachments_owner
  ON public.attachments (owner_type, owner_id);
CREATE INDEX ix_attachments_uploaded
  ON public.attachments (uploaded_by, created_at);

CREATE INDEX ix_notifications_unread
  ON public.notifications (recipient_user_id, is_read, created_at DESC);
CREATE UNIQUE INDEX ux_notifications_dedup
  ON public.notifications (dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX ix_audit_entity
  ON public.audit_logs (entity_type, entity_id, created_at);
CREATE INDEX ix_audit_actor
  ON public.audit_logs (actor_user_id, created_at);
CREATE INDEX ix_audit_action
  ON public.audit_logs (action, created_at);
CREATE INDEX ix_audit_correlation
  ON public.audit_logs (correlation_id);

-- Service/transaction rules deliberately left outside SQL CHECK/FK:
-- * same-project dependency and cycle detection;
-- * eligibility and assignment authorization;
-- * Job Board/current-assignment state transition;
-- * readiness, blocker and Hold Point gates;
-- * inspection/rectification quality close;
-- * polymorphic attachment owner validation and project scope;
-- * append-only enforcement and audit payload allow-list.
