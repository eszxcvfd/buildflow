# 04 — [JOB-SRS-004] Mở và đóng Job Board

**What to build:** Điều phối viên công bố Work Order còn trống lên Job Board, xác định thời gian nhận việc và đóng khỏi danh sách khi cần. Chỉ WO đủ điều kiện (JOB-002), chưa có assignee và chưa hủy mới được mở; đóng Job Board không tự hủy assignment đã tồn tại.

**Blocked by:** slice-5/02.

**Status:** ready-for-agent

- [ ] Mở WO lên board sau khi pass JOB-002; đặt cửa sổ thời gian nhận việc.
- [ ] WO đã có assignee/hủy không mở được.
- [ ] Đóng board không hủy assignment hiện có.
- [ ] E2e + contract cập nhật; đối chiếu Job Board slice-1/06.

## Truy vết

SRS JOB-SRS-004 (§7.4, Must); UC-03.
