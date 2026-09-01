# Module Map

These are logical business modules, not permission to create microservices. The baseline remains a modular system with one business database proposal; deployment and framework details are decided later.

## Modules and ownership

| Module | Owns | Public responsibility | Must not own |
| --- | --- | --- | --- |
| Identity & Access | Account, role assignment, authentication audit, project-scope authorization policy | Authenticate an actor and decide whether an action is allowed in a project | Workforce capability, project workflow or Work Order state |
| Workforce | Worker, contractor, Trade, Crew, Crew membership and Crew Lead history | Provide current resource facts and eligibility inputs | Assignment or schedule decisions |
| Project Setup | Project, area, Work Type, project membership, default checklist/checkpoint references and dependency definition | Provide valid project context and planning catalogs | Work Order execution or inspection results |
| Work Management | Work Order, schedule, Job Board, Assignment and execution-state transitions | Plan, publish, assign, self-accept, reassign and expose the current responsible party | Readiness result, blocker lifecycle or inspection evidence |
| Field Execution | Readiness checks/items, blockers, progress/log updates, Work Order material readiness and supplement requests | Evaluate Start gate inputs, record field execution and submit Work Done through Work Management | Inventory/procurement or final closure authority |
| Quality Control | Checklist templates/instances, checkpoint templates/instances, inspections and rectifications | Enforce Hold Points, record immutable inspection rounds and decide quality-gate satisfaction | Work planning or direct mutation of assignment |
| Notification & Insight | In-app notification state, dashboard queries, KPI definitions and audit read surface | Inform users and derive authorized operational views from domain truth | Change source business state |

## Relationship graph

`Identity & Access` constrains every command and query.

`Workforce + Project Setup → Work Management → Field Execution → Quality Control → Work Management.Close`

`Notification & Insight` observes outcomes from every module but does not become the source of truth.

## Critical contracts

### Assignment eligibility

Producer: Work Management.

Inputs: active resource and Trade facts from Workforce; project membership from Identity & Access/Project Setup; Work Order state and schedule from Work Management.

Outcome: eligible with evaluated facts, or rejected with explicit reasons. The check and assignment creation must be revalidated atomically.

### Start gate

Producer: Field Execution, coordinated with Work Management.

Inputs: hard dependencies, latest readiness items, blocking checklist items and blocking pre-activity checkpoint state.

Outcome: Start allowed or rejected with all blocking reasons. On success, Work Management performs the execution transition atomically.

### Work Done

Producer: Field Execution.

Authorization: assigned Worker for personal assignment; authorized Crew Lead policy for Crew assignment.

Outcome: Work Management transitions to Work Done. Quality Control then owns the remaining acceptance work.

### Quality close gate

Producer: Quality Control.

Inputs: mandatory checkpoint status, required Final Inspection result and mandatory rectification verification.

Outcome: gate satisfied or a complete list of unmet conditions. Only Work Management applies Closed.

### Notifications, audit and reporting

The producing module owns the business outcome. Notification & Insight receives a stable event/outcome and records derived data in the same reliable application workflow required by the source. It must not reconstruct business truth from UI behaviour.

## Cross-module invariants

- Public module interfaces express business operations, not table CRUD.
- Web and Mobile consume the same application contracts; neither owns separate business rules.
- Consumers do not update another module's tables directly.
- Historical snapshots remain attributable even when Crew Lead, membership or assignment changes.
- The interface is the primary test surface; implementation details remain private.
- A new seam requires at least a production adapter and a meaningful test adapter, not abstraction for its own sake.

## Just-in-time detail policy

Before implementing a module, complete its module design with:

- exact requirement IDs and approved open decisions;
- commands, queries, actors and permissions;
- state transitions and invariants;
- owned data and cross-module contracts;
- failure, retry and concurrency behaviour;
- test and demo proof.

Do not pre-design screens, APIs and tables for every module now. Detail the next module only when its upstream rules are sufficiently approved.
