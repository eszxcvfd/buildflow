# 01 — [JOB-SRS-017] Xem chi tiết và hành động khả dụng

**What to build:** Worker xem chi tiết Work Order của mình, lịch, checklist, tiến độ, bằng chứng và hành động tiếp theo phù hợp trạng thái. Hệ thống không hiển thị/thực hiện hành động không hợp lệ; thông báo lý do khi trạng thái đổi trong lúc người dùng đang xem.

**Blocked by:** slice-6/01, slice-1/14 (My Jobs).

**Status:** ready-for-agent

- [ ] Chi tiết WO của worker (được giao/tự nhận) đủ: lịch, checklist, tiến độ, bằng chứng.
- [ ] Hành động hiển thị theo trạng thái + vai trò (BR-07) — không hiện nút không hợp lệ.
- [ ] Trạng thái đổi giữa chừng → lần xem sau hiển thị lý do.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS JOB-SRS-017 (§7.4, Must); UC-05.
