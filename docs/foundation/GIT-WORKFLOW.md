# Git Workflow

This workflow is intentionally small-team friendly: one protected integration branch and short-lived work branches.

## Branches

- `main`: always reviewable and expected to pass available checks. No direct feature commits.
- `feat/<issue>-<slug>`: one feature or requirement slice.
- `fix/<issue>-<slug>`: defect correction.
- `docs/<issue>-<slug>`: documentation-only change.
- `chore/<issue>-<slug>`: tooling or maintenance.
- `release/<version>`: optional and temporary only when a stabilization window is actually needed.
- Agent-created branches use `codex/<type>-<issue>-<slug>` to make automation ownership visible.

Do not keep a permanent `develop` branch. For a small team it adds merge distance without adding safety.

## Merge process

1. Start from current `main`; keep the branch focused on one issue/slice.
2. Before opening a pull request, update from `main` and resolve conflicts on the work branch.
3. The pull request states requirement IDs, behaviour, affected modules/data, tests and unresolved limitations.
4. Require one reviewer other than the author for business rules, permissions, schema/migrations and state transitions.
5. Required checks: relevant lint/typecheck/tests/build plus migration or document-link checks when applicable.
6. Use squash merge for ordinary work so one issue becomes one mainline commit.
7. Delete the merged work branch. Never force-push shared `main` or a shared release branch.

## Safety rules

- No merge while Must acceptance evidence is missing.
- No unrelated refactor in a feature pull request.
- Schema change and all affected producer/consumer changes ship together.
- A breaking contract requires explicit compatibility/rollout notes.
- Documentation-only changes do not claim runtime verification.
- Emergency fixes still use a reviewed `fix/` branch; urgency does not remove auditability.

## Commit and pull-request naming

Use English Conventional Commit style, for example:

- `feat(work-orders): enforce one-winner self-accept`
- `fix(quality): prevent close with open rectification`
- `docs(domain): record crew lead authority decision`

Reference the issue and requirement IDs in the pull-request body, not by making the subject unreadably long.
