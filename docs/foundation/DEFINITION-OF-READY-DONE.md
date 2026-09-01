# Definition of Ready and Done

## Module Definition of Ready

- Included requirement IDs and priorities are listed.
- Relevant business rules, states and invariants are linked.
- Blocking open decisions are approved.
- Module owner, public operations and forbidden responsibilities are clear.
- Upstream/downstream contracts and data ownership are clear.
- Permission matrix and project-scope behaviour are defined.
- Failure, retry, concurrency and audit behaviour are defined.
- Acceptance examples and test data exist.
- Out-of-scope items are explicit.

## Feature Definition of Ready

- One observable outcome and actor are named.
- Preconditions, main flow, alternative flow and errors are specified.
- UI/API/schema details do not contradict the approved module design.
- Migration and compatibility needs are known.
- Test and demo proof is planned.

## Definition of Done

- All scoped Must acceptance criteria pass.
- Relevant lint/typecheck/tests/build or document checks pass.
- Producer and every current consumer are updated together.
- Authorization, retry/concurrency and audit cases are verified where applicable.
- Migration/seed/rollback or recovery notes are verified where applicable.
- Traceability and canonical documents are current.
- No new unresolved requirement is hidden in code or comments.
- Pull request is reviewed and merged through the approved Git workflow.
