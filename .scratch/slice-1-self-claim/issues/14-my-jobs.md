# 14 — [JOB-SRS-016] Xem My Jobs và việc hôm nay

**What to build:** Worker xem My Jobs: danh sách việc đã được giao hoặc tự nhận, phân nhóm Hôm nay, Sắp tới, Đang thực hiện và Đã hoàn tất; chỉ hiển thị công việc thuộc assignment hợp lệ của worker; danh sách phản ánh thay đổi hiện trạng.

**Blocked by:** 13 (JOB-SRS-011).

**Status:** ready-for-agent

- [ ] Phân nhóm đủ 4 nhóm theo trạng thái và khung thời gian.
- [ ] Chỉ hiện Work Order thuộc assignment hợp lệ của worker đăng nhập.
- [ ] Work Order vừa tự nhận xuất hiện đúng nhóm; hủy/thu hồi/tái phân công sau này tự phản ánh vì truy vấn theo assignment hiện hành.
- [ ] Trang My Jobs web; OpenAPI + typed client cập nhật; e2e.

## Truy vết

SRS JOB-SRS-016 (§7.4, Must); UC-04; CONTEXT.md (My Jobs).
