# 10 — [JOB-SRS-009] Kiểm tra điều kiện nhận việc

**What to build:** Kiểm tra điều kiện nhận việc (Eligibility) cho self-claim: worker đang hoạt động, đúng ngành nghề/kỹ năng, không trùng lịch (dùng SCH-SRS-004), chưa vượt Concurrent limit (đếm Work Order Đã phân công + Đang thực hiện; mặc định 3, cấu hình được). Mỗi điều kiện không đạt trả lý do cụ thể.

**Blocked by:** 09 (SCH-SRS-004).

**Status:** ready-for-agent

- [ ] Mỗi điều kiện không đạt trả về lý do cụ thể, phân biệt được từng nguyên nhân.
- [ ] Không để lại assignment hoặc bản ghi chờ không hợp lệ khi kiểm tra thất bại.
- [ ] Unit test (Seam B) cho từng điều kiện và tổ hợp; concurrent limit cấu hình được.

## Truy vết

SRS JOB-SRS-009 (§7.4, Must); BR-04; SRS Q-03/Q-05 đã chốt (§14.1.1); CONTEXT.md (Eligibility, Concurrent limit).
