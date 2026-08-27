---
name: setup-matt-pocock-skills
description: Configure this repo for the engineering skills — set up its issue tracker, triage label vocabulary, and domain doc layout. Run once before first use of the other engineering skills.
disable-model-invocation: true
---

Before repository-facing work, read the target repository's `WORK-ROUTING.md`
when it exists. In this skill source tree, also read the bundled
[`../../WORK-ROUTING.md`](../../WORK-ROUTING.md), which defines the shared
pointer and rules used while setup creates the target-local copy.

# Setup Matt Pocock's Skills

Scaffold the per-repo configuration that the engineering skills assume:

- **Issue tracker** — where issues live (GitHub by default; local markdown is also supported out of the box)
- **Triage labels** — the strings used for the five canonical triage roles
- **Domain docs** — where `CONTEXT.md` and ADRs live, and the consumer rules for reading them
- **Work Routing docs** — the canonical project-document set that owns orientation, lanes, plans, runtime/protocol boundaries, and content/package boundaries

This is a prompt-driven skill, not a deterministic script. Explore, present what you found, confirm with the user, then write.

## Process

### 1. Explore

Look at the current repo to understand its starting state. Read whatever exists; don't assume:

- `git remote -v` and `.git/config` — is this a GitHub repo? Which one?
- `AGENTS.md` and `CLAUDE.md` at the repo root — does either exist? Is there already an `## Agent skills` section in either?
- `CONTEXT.md` and `CONTEXT-MAP.md` at the repo root
- `docs/adr/` and any `src/*/docs/adr/` directories
- `docs/agents/` — does this skill's prior output already exist?
- `WORK-ROUTING.md` — is the target-local routing pointer already present?
- The Work Routing paths, when present: `ARCHITECTURE.md`, `docs/README.md`,
  `docs/process/DEVELOPMENT.md`, `docs/issues/ROADMAP.md`, `PLANS.md`,
  `docs/architecture/RUNTIME.md`, `docs/architecture/NETCODE.md`, and
  `docs/architecture/CONTENT.md`
- `.scratch/` — sign that a local-markdown issue tracker convention is already in use
- Is the `triage` skill installed? (a `triage` skill folder alongside this one, or `triage` in your available skills.) This decides whether Section B runs at all.
- Monorepo signals — a `pnpm-workspace.yaml`, a `workspaces` field in `package.json`, or a populated `packages/*` with its own `src/`. Present only in a genuinely large multi-package repo; their absence means single-context, which is almost every repo.

### 2. Present findings and ask

Summarise what's present and what's missing. Then take the sections in order — one section, one answer, then the next.

Lead each section with the recommended answer so the user can accept it in a word. Give a one-line explainer only when the choice genuinely branches; skip the section entirely when exploration already settled it (Section B when `triage` isn't installed, Section C when there's no monorepo).

**Section A — Issue tracker.**

> Explainer: The "issue tracker" is where issues live for this repo. Skills like `to-tickets`, `triage`, and `to-spec` read from and write to it — they need to know whether to call `gh issue create`, write a markdown file under `.scratch/`, or follow some other workflow you describe. Pick the place you actually track work for this repo.

Default posture: these skills were designed for GitHub. If a `git remote` points at GitHub, propose that. If a `git remote` points at GitLab (`gitlab.com` or a self-hosted host), propose GitLab. Otherwise (or if the user prefers), offer:

- **GitHub** — issues live in the repo's GitHub Issues (uses the `gh` CLI)
- **GitLab** — issues live in the repo's GitLab Issues (uses the [`glab`](https://gitlab.com/gitlab-org/cli) CLI)
- **Local markdown** — issues live as files under `.scratch/<feature>/` in this repo (good for solo projects or repos without a remote)
- **Other** (Jira, Linear, etc.) — ask the user to describe the workflow in one paragraph; the skill will record it as freeform prose

Record the choice in `docs/agents/issue-tracker.md`. The GitHub and GitLab templates carry a "PRs as a request surface" flag, defaulted **off** — leave it off and don't raise it; a user who wants external PRs in the triage queue can flip the flag in the file later.

**Section B — Triage label vocabulary.** Skip this section entirely if the `triage` skill isn't installed (exploration told you) — an uninstalled skill needs no labels.

If it is installed, ask exactly one question:

> Do you want to keep the default triage labels? (recommended: **yes**)

The defaults are the five canonical roles, each label string equal to its name: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. On **yes**, write them as-is. Only if the user says no — usually because their tracker already uses other names (e.g. `bug:triage` for `needs-triage`) — collect the overrides so `triage` applies existing labels instead of creating duplicates.

**Section C — Domain docs.** Default to **single-context** — one `CONTEXT.md` + `docs/adr/` at the repo root. This fits almost every repo; write it without asking.

Offer **multi-context** — a root `CONTEXT-MAP.md` pointing to per-context `CONTEXT.md` files — only when exploration found monorepo signals. Then confirm which layout they want.

**Section D — Work Routing documents.** This section is required; it is not a
new lane choice. Add the target-local `WORK-ROUTING.md` pointer and the
following canonical owner documents to the target repo:

| Document | Owns |
| --- | --- |
| `WORK-ROUTING.md` | shared pointer to the Work Routing set; it owns no project subject |
| `ARCHITECTURE.md` | orientation and change routing |
| `docs/README.md` | documentation ownership and routing |
| `docs/process/DEVELOPMENT.md` | lane selection and proof |
| `docs/issues/ROADMAP.md` | the current work queue |
| `PLANS.md` | non-trivial plans and durable coordination |
| `docs/architecture/RUNTIME.md` | runtime ownership and lifecycle boundaries |
| `docs/architecture/NETCODE.md` | protocol and compatibility-admission boundaries |
| `docs/architecture/CONTENT.md` | server-relevant resources and cook/package boundaries |

Read only the entries that already exist. For a missing entry, use the seed in
`work-routing/` and mark it as an initial setup seed rather than inventing
project facts. If an entry already exists, treat it as repository doctrine:
preserve it, show any proposed additions, and do not replace it with the seed.
When an existing owner document is silent or stale, record the bounded
inference or update that canonical owner before relying on a new rule.

The set must preserve these ownership rules: `docs/process/DEVELOPMENT.md`
owns lane selection, and `PLANS.md` owns the conditions and contents for design
notes and checked-in plans. Do not invent another routing rule. Do not trigger
closeout for doc-only edits, small owner-neutral fixes, or partial progress
unless the governing plan requires it.

### 3. Confirm and edit

Show the user a draft of:

- The `## Agent skills` block to add to whichever of `CLAUDE.md` / `AGENTS.md` is being edited (see step 4 for selection rules)
- The contents of `docs/agents/issue-tracker.md`, `docs/agents/domain.md`, and `docs/agents/triage-labels.md` (the last only when `triage` is installed)
- The missing `WORK-ROUTING.md` pointer and Work Routing owner documents from
  `work-routing/`, plus any narrowly
  scoped additions proposed for existing Work Routing documents

Let them edit before writing.

### 4. Write

**Pick the file to edit:**

- If `CLAUDE.md` exists, edit it.
- Else if `AGENTS.md` exists, edit it.
- If neither exists, ask the user which one to create — don't pick for them.

Never create `AGENTS.md` when `CLAUDE.md` already exists (or vice versa) — always edit the one that's already there.

If an `## Agent skills` block already exists in the chosen file, update its contents in-place rather than appending a duplicate. Don't overwrite user edits to the surrounding sections.

The block:

```markdown
## Agent skills

### Issue tracker

[one-line summary of where issues are tracked]. See `docs/agents/issue-tracker.md`.

### Triage labels

[one-line summary of the label vocabulary]. See `docs/agents/triage-labels.md`.

### Domain docs

[one-line summary of layout — "single-context" or "multi-context"]. See `docs/agents/domain.md`.
```

Include the `### Triage labels` sub-block, and write `docs/agents/triage-labels.md`, only when `triage` is installed and Section B ran. When it isn't, both are omitted.

Then write the docs files using the seed templates in this skill folder as a starting point:

- [issue-tracker-github.md](./issue-tracker-github.md) — GitHub issue tracker
- [issue-tracker-gitlab.md](./issue-tracker-gitlab.md) — GitLab issue tracker
- [issue-tracker-local.md](./issue-tracker-local.md) — local-markdown issue tracker
- [triage-labels.md](./triage-labels.md) — label mapping (only if `triage` is installed)
- [domain.md](./domain.md) — domain doc consumer rules + layout

Also write `WORK-ROUTING.md` and the Work Routing owner documents from the
matching files under [`work-routing/`](./work-routing/). Create their parent
directories as needed. Copy a seed only when its target path is missing. For
an existing target, make only the confirmed, owner-preserving addition; never
overwrite the document or erase project-specific doctrine. Keep the generated
files free of unverified product, runtime, protocol, or packaging claims.

For "other" issue trackers, write `docs/agents/issue-tracker.md` from scratch using the user's description.

### 5. Done

Tell the user the setup is complete and which engineering skills will now read
from these files. Name the target-local `WORK-ROUTING.md` pointer and the Work
Routing owner documents that were created or left unchanged because they
already existed. Mention they can edit
`docs/agents/*.md` and the Work Routing documents directly later — re-running
this skill is only necessary if they want to switch issue trackers, change the
domain layout, or regenerate missing setup seeds.
