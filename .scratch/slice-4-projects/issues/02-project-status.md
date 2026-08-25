# 02 — [PRJ-SRS-002] Quản lý trạng thái dự án

**What to build:** Người có quyền chuyển dự án giữa Nháp → Đang hoạt động → Tạm dừng → Hoàn thành → Đóng theo điều kiện. Dự án Đóng không tạo Work Order mới; mở lại hoặc hủy phải có quyền và lý do.

**Blocked by:** slice-4/01.

**Status:** ready-for-agent

- [ ] Chuyển trạng thái đúng vòng đời; sai thứ tự bị từ chối.
- [ ] Dự án Đóng: tạo WO mới bị chặn (kiểm tra từ JOB-002).
- [ ] Mở lại/hủy cần quyền + lý do; lưu actor, thời điểm.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS PRJ-SRS-002 (§7.3, Must); state model §5.3; BR-07.
