# 04 — [MAT-SRS-004] Phê duyệt hoặc từ chối

**What to build:** Quản lý dự án xem yêu cầu và phê duyệt hoặc từ chối kèm lý do. Chỉ xử lý yêu cầu Chờ duyệt; quyết định chống bấm lặp và lưu người/thời điểm; người tạo nhận thông báo (placeholder event chờ RPT-001).

**Blocked by:** slice-9/02, slice-2/03.

**Status:** ready-for-agent

- [ ] Phê duyệt/từ chối kèm lý do theo quyền Quản lý dự án.
- [ ] Chỉ trạng thái Chờ duyệt được xử lý; chống bấm lặp (idempotent).
- [ ] Lưu người/thời điểm quyết định (BR-10); sự kiện thông báo cho người tạo.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS MAT-SRS-004 (§7.7, Must); UC-07.
