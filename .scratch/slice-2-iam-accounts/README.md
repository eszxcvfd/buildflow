# Slice 2 — Tài khoản và phân quyền hoàn thiện

- **FR:** IAM-SRS-003, 004, 005, 006 (4 Must).
- **SRS:** §7.1; use case UC-01. Vai trò giữ riêng theo Q-01 đã chốt (SRS §14.1.1).
- **Điều kiện vào:** slice 1 xong auth (tickets 03, 04) — cần session guard + role trên token.
- **Song song:** slice 3 sau khi auth xong; không tranh schema với ORG.
- **Cấu trúc tác nhân:** 1 người làm 01→04 tuần tự; 1 người khác có thể song song slice 3.

## Tickets

- `issues/01-profile-management.md` — IAM-SRS-003
- `issues/02-account-management.md` — IAM-SRS-004
- `issues/03-roles-permissions.md` — IAM-SRS-005
- `issues/04-project-data-scoping.md` — IAM-SRS-006
