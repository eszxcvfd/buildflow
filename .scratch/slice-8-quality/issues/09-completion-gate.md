# 09 — [QUA-SRS-011] Điều kiện hoàn tất theo chất lượng

**What to build:** Hệ thống chỉ cho Work Order Hoàn thành khi checklist bắt buộc, kết luận kiểm tra và mọi hạng mục khắc phục đều đạt. Xử lý lại hoặc gửi lặp không tạo hai lần hoàn tất; trường hợp ngoại lệ cần quyền và lý do được audit.

**Blocked by:** slice-8/05, slice-8/08.

**Status:** ready-for-agent

- [ ] Gate hoàn tất kiểm tra: checklist bắt buộc + kết luận Đạt + không còn hạng mục mở.
- [ ] Gửi lặp/retry không tạo hai lần hoàn tất (idempotent).
- [ ] Ngoại lệ mở lại WO hoàn thành: quyền + lý do + audit (state model §5.1).
- [ ] E2e + unit (Seam B).

## Truy vết

SRS QUA-SRS-011 (§7.6, Must); BR-09.
