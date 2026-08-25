# 03 — [JOB-SRS-020] Gửi yêu cầu hoàn thành

**What to build:** Worker gửi Work Order sang Chờ kiểm tra sau khi hoàn tất phần việc và dữ liệu bắt buộc. Hệ thống hiển thị tóm tắt mục còn thiếu; checklist chặn hoặc dữ liệu bắt buộc chưa đạt không cho gửi; thao tác gửi chống bấm lặp.

**Blocked by:** slice-7/02, slice-7/07 (checklist trước bắt đầu).

**Status:** ready-for-agent

- [ ] Gửi hoàn thành: WO Đang thực hiện → Chờ kiểm tra (state model §5.1).
- [ ] Tóm tắt mục còn thiếu khi chưa đạt điều kiện.
- [ ] Checklist chặn/dữ liệu bắt buộc chưa đạt → không gửi được.
- [ ] Chống bấm lặp: gửi lại không tạo hai lần chuyển trạng thái.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS JOB-SRS-020 (§7.4, Must); BR-07, BR-09.
