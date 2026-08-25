# Slice 3 — Tổ chức và nguồn lực

- **FR:** ORG-SRS-001, 002, 003, 004, 005, 008 (6 Must; ORG-006/007 Should thuộc backlog).
- **SRS:** §7.2; use case UC-02, UC-03, UC-04.
- **Điều kiện vào:** slice 1 auth (tickets 03, 04) — mọi endpoint cần guard + role.
- **Song song:** slice 2 (khác module, khác bảng).
- **Lưu ý:** eligibility của slice 1 (ticket 10) đọc trạng thái worker/kỹ năng hiện hành — ORG-008 chốt cổng dữ liệu đó.

## Tickets

- `issues/01-worker-management.md` — ORG-SRS-001
- `issues/02-contractor-management.md` — ORG-SRS-002
- `issues/03-trades-skills.md` — ORG-SRS-003
- `issues/04-resource-status.md` — ORG-SRS-004
- `issues/05-resource-search.md` — ORG-SRS-005
- `issues/06-eligibility-data.md` — ORG-SRS-008
