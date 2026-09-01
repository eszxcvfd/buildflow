# BuildFlow

BuildFlow is the shared domain language for VINACON construction Work Order coordination and on-site quality control.

## Work coordination

**Work Order**:
The central unit of construction work managed from planning through assignment, readiness, execution, quality control and closure.
_Avoid_: Task, job ticket

**Job Board**:
The set of eligible, unassigned Work Orders made available for a Worker to self-accept.
_Avoid_: Marketplace, open task list

**Assignment**:
The time-bounded responsibility link between one Work Order and either one Worker or one Crew.
_Avoid_: Allocation, ownership

**Eligibility**:
The combined active-status, project-scope, skill, schedule and configured-limit conditions required before assignment or self-accept.
_Avoid_: Availability

**Work Done**:
The confirmation that field execution is complete and ready for remaining quality gates.
_Avoid_: Completed, Closed

**Closed**:
The terminal accepted state reached only after all mandatory quality gates are satisfied.
_Avoid_: Work Done

## Workforce

**Worker**:
An individual who performs construction work in the field.
_Avoid_: User, employee

**Crew**:
A managed group of Workers that can receive a Work Order assignment as one resource.
_Avoid_: Team

**Crew Lead**:
The active Crew member authorized to perform Crew-level confirmations for a Work Order under the approved policy.
_Avoid_: Supervisor

**Trade**:
A construction discipline or skill used to classify resource capability and Work Order requirements.
_Avoid_: Role

## Make ready and constraints

**Dependency**:
A predecessor relationship that influences whether a Work Order can start.
_Avoid_: Blocker

**Readiness**:
A pre-start assessment with the result Ready, Ready With Constraint or Not Ready.
_Avoid_: Work Order status

**Blocker**:
A separately tracked constraint that impedes starting or continuing a Work Order and retains cause, responsibility and duration.
_Avoid_: Paused status, issue

**Material Supplement Request**:
A request to supply missing material for one Work Order without introducing inventory or procurement approval.
_Avoid_: Purchase request, material requisition

## Quality control

**Checklist**:
A versioned set of criteria instantiated for a Work Order or inspection purpose.
_Avoid_: Inspection

**Inspection Checkpoint**:
A configured quality-control point applied before, during or after construction execution.
_Avoid_: Checklist

**Hold Point**:
A blocking Inspection Checkpoint whose controlled work step cannot continue until authorized release.
_Avoid_: Witness Point

**Inspection**:
One immutable evaluation round for an Inspection Checkpoint.
_Avoid_: Checkpoint

**Rectification**:
A separately tracked corrective item created from a failed inspection and verified through re-inspection.
_Avoid_: NCR, CAPA

**Quality Gate**:
The complete set of mandatory checkpoint, final-inspection and rectification conditions required before Closed.
_Avoid_: Work Done

## Traceability

**Audit Trail**:
Append-oriented records that explain who changed a sensitive business object, when, what changed and why when required.
_Avoid_: Application log
