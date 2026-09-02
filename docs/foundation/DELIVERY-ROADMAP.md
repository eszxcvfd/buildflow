# Delivery Roadmap

Detailed design is just in time. A phase may be planned at overview level, but its module design is completed immediately before implementation and reviewed against all upstream requirements, approved change record [CR-001](changes/CR-001-business-policy-decisions.md), and accepted Architecture Decision Records ([ADR-001](../architecture/adr/ADR-001-monorepo-workspace.md) through [ADR-015](../architecture/adr/ADR-015-mobile-build.md)).

## Technical foundation prerequisite gate

Prior to implementing business modules in Phase 1, the following technical prerequisites must be satisfied:
1. **Architecture Decisions Approved**: ADR-001 through ADR-015 accepted as canonical authority.
2. **Monorepo Workspace Initialized**: `pnpm Workspaces` + `Turborepo` structure (`apps/api`, `apps/web`, `apps/mobile`, `packages/api-client`, `packages/contracts`, `packages/eslint-config`, `packages/tsconfig`) configured with Node.js 24 LTS and TypeScript strict mode (ADR-001, ADR-002).
3. **CI Pipeline Baseline**: GitHub Actions PR verification workflow configured for lint, typecheck, unit test, integration test, and build validation (ADR-013).
4. **Database & ORM Baseline**: PostgreSQL 18.x container configuration and Prisma 7.x schema/migration baseline established (ADR-007, ADR-008).
5. **API Contract Pipeline**: OpenAPI specification generation and automated TypeScript client code generation into `packages/api-client` verified (ADR-006).
6. **Authentication Architecture**: Backend-owned JWT + rotating session persistence structure implemented (ADR-009).

## Phase 1 — Business foundation

Scope: Identity & Access, Workforce and Project Setup.

Exit gate: approved separate Project Manager / Coordinator permission matrix validated (CR-001/Q-01); active Worker/Crew/Crew Lead rules; Project/area/Work Type setup; test data ready.

## Phase 2 — Planning and dispatch

Scope: Work Order, dependency, schedule, direct assignment, Job Board, self-accept and My Jobs.

Exit gate: direct assignment Active immediate behavior validated (CR-001/Q-02); scheduled time interval workload non-overlap validated (CR-001/Q-03); schedule interval conflict hard-block enforced (CR-001/Q-04); current Crew Lead execution authority with snapshot history (CR-001/Q-06); mandatory hard dependency Start gate (CR-001/Q-07); one-winner concurrency proof; reassignment history; permission tests.

## Phase 3 — Make ready and execution

Scope: readiness, Start gate, blockers, progress/log/evidence, Work Order material and Work Done.

Exit gate: non-Lead Crew Member field update permissions enforced (CR-001/Q-05); blocking readiness without override validated (CR-001/Q-08); blocker mandatory responsible party & audited resolution validated without state overwriting (CR-001/Q-09); dependency/readiness/checklist gate proof; blocker duration; retry-safe field updates; no procurement scope leakage.

## Phase 4 — Quality close

Scope: checklist, Pre-activity, Hold Point, Final Inspection, rectification, re-inspection and Closed gate.

Exit gate: QC-exclusive Hold Point release authority enforced (CR-001/Q-10); Must quality flow verified (CR-001/Q-11); immutable inspection rounds; Hold Point proof; Work Done-versus-Closed proof; quality close integration tests.

## Phase 5 — Operations and acceptance

Scope: notifications, dashboard/KPI, drill-down, CSV export, audit, performance evidence, backup/restore and end-to-end demo.

Exit gate: Closed-based official project progress KPI formula fixtures (CR-001/Q-12); CSV basic export contract (CR-001/Q-13); Android 10+ Mobile release/acceptance verification (CR-001/Q-14 / ADR-005 / ADR-015); 5-year post-closure data retention policy (CR-001/Q-15); security and performance evidence; complete Web/Mobile demo.

## Should work

Only schedule Should requirements after all Must exits above are stable. Each Should enters through change control and cannot weaken Must proof.
