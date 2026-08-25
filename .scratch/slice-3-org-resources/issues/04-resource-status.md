# 04 — [ORG-SRS-004] Quản lý trạng thái nguồn lực

**What to build:** Quản trị viên kích hoạt, tạm ngừng hoặc chấm dứt trạng thái hoạt động của worker, nhà thầu (và đội khi ORG Should triển khai). Trước khi ngừng, hệ thống cảnh báo công việc/lịch đang mở; không làm mất lịch sử.

**Blocked by:** slice-3/01, slice-3/02.

**Status:** ready-for-agent

- [ ] Chuyển trạng thái kịch hoạt/tạm ngừng/chấm dứt theo quyền.
- [ ] Có WO/lịch đang mở → cảnh báo trước khi ngừng (không chặn cứng theo SRS).
- [ ] Lịch sử đã phát sinh không bị ảnh hưởng.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS ORG-SRS-004 (§7.2, Must); BR-11.
