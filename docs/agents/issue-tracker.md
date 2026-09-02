# Issue tracker configuration

BuildFlow uses **GitHub Issues** as the canonical issue tracker.

| Field | Value |
| --- | --- |
| Tracker | GitHub Issues |
| Repository | `eszxcvfd/buildflow` |
| API tool | `gh` |
| Feature specs | Tracked as GitHub Issues |
| Implementation tickets | Tracked as GitHub Issues, refined from feature issues |
| Triage labels | Managed in-repo (see [`triage` skill](../../.agents/skills/triage/SKILL.md) when active) |

Rules:

- Issues are the only authoritative place for **feature specs** and **implementation tickets**. Do not mirror them into Markdown files inside the repo.
- Use `gh issue create`, `gh issue list`, `gh issue view` and `gh issue edit` rather than scraping the tracker manually.
- When a feature is described in a Markdown document elsewhere (e.g. a change record), link to the GitHub Issue instead of duplicating the spec.
- Local label policy is owned by the triage process; do not recreate the canonical label vocabulary in this file.
