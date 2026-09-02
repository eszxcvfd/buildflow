# Source Register

## Registered sources

| ID | Document | Version | Status in source | Last modified in Drive | Local snapshot | Original |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SRC-BRD-001 | Business Requirements Document | 2.0 | Draft, awaiting stakeholder confirmation | 2026-08-24 02:42:36Z | [BRD-v2.0.md](sources/BRD-v2.0.md) | [Google Drive](https://docs.google.com/document/d/1rjkfOb9HttaVb3AmrVY-YyUuFCZpfaAO/edit) |
| SRC-SRS-001 | Software Requirements Specification | 2.1 | Officially synchronized with BRD V2.0, still awaiting confirmation | 2026-08-24 14:12:23Z | [SRS-v2.1.md](sources/SRS-v2.1.md) | [Google Drive](https://docs.google.com/document/d/10kYy2x_TitnjaxZeEdVm4rcVdRk5gcf9/edit) |
| SRC-DBD-001 | Database Design Document | 2.1 | Proposed physical baseline for review | 2026-08-24 10:35:38Z | [DBD-v2.1.md](sources/DBD-v2.1.md) | [Google Drive](https://docs.google.com/document/d/191TKO9-PSzOa9j3zQ-IZKZ9H_aQQvR7S/edit) |

## Source handling

- Snapshots are read-only evidence. Update them only by re-extracting the corresponding Drive document and recording a new version.
- Visual tables may be flattened in the local extraction. The original Drive file is authoritative for table layout; the extracted text is authoritative only for the text it contains.
- When a source changes, compare version, modification time, requirement counts, IDs, state domains and open decisions before updating derived documents.
- A newer timestamp does not automatically win a semantic conflict. Authority is determined by topic and explicit approval.

## Historical source gaps (Reconciled in Foundation)

The raw historical source documents originally contained open questions and draft statuses:
- 15 business/product questions were open in raw BRD/SRS/DBD; all 15 have been formally approved and resolved via [CR-001](changes/CR-001-business-policy-decisions.md) and recorded in [OPEN-DECISIONS.md](OPEN-DECISIONS.md).
- Mobile platform target (formerly TBD) is committed to Android 10+ (Q-14).
- KPI formulas are locked to Closed Work Order ratio for official progress (Q-12).
- Data retention (5 years post-closure), CSV export format, schedule conflict hard-block, and immediate direct assignment have been locked in the canonical baseline.
- DBD remains a proposed physical schema baseline to be realized through reviewed migrations.
