# Source Register

## Registered sources

| ID | Document | Version | Status in source | Last modified in Drive | Local snapshot | Original |
| --- | --- | --- | --- | --- | --- | --- |
| SRC-BRD-001 | Business Requirements Document | 2.0 | Draft, awaiting stakeholder confirmation | 2026-08-24 02:42:36Z | [BRD-v2.0.md](sources/BRD-v2.0.md) | [Google Drive](https://docs.google.com/document/d/1rjkfOb9HttaVb3AmrVY-YyUuFCZpfaAO/edit) |
| SRC-SRS-001 | Software Requirements Specification | 2.1 | Officially synchronized with BRD V2.0, still awaiting confirmation | 2026-08-24 14:12:23Z | [SRS-v2.1.md](sources/SRS-v2.1.md) | [Google Drive](https://docs.google.com/document/d/10kYy2x_TitnjaxZeEdVm4rcVdRk5gcf9/edit) |
| SRC-DBD-001 | Database Design Document | 2.1 | Proposed physical baseline for review | 2026-08-24 10:35:38Z | [DBD-v2.1.md](sources/DBD-v2.1.md) | [Google Drive](https://docs.google.com/document/d/191TKO9-PSzOa9j3zQ-IZKZ9H_aQQvR7S/edit) |

## Source handling

- Snapshots are read-only evidence. Update them only by re-extracting the corresponding Drive document and recording a new version.
- Visual tables may be flattened in the local extraction. The original Drive file is authoritative for table layout; the extracted text is authoritative only for the text it contains.
- When a source changes, compare version, modification time, requirement counts, IDs, state domains and open decisions before updating derived documents.
- A newer timestamp does not automatically win a semantic conflict. Authority is determined by topic and explicit approval.

## Known source gaps

- All approval roles remain unassigned in the supplied documents.
- BRD and SRS retain 15 unresolved business/product questions.
- Mobile platform baseline is explicitly TBD.
- KPI formulas and baseline data are not yet approved.
- Retention, export format, scheduling override and direct-assignment acceptance policy remain open.
- DBD is a proposed implementation baseline, not an approved migration contract.
