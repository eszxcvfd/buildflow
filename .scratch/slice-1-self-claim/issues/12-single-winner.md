# 12 — [JOB-SRS-010] Bảo đảm một người nhận hợp lệ

**What to build:** Bảo đảm một người nhận hợp lệ khi nhiều worker cùng claim một Work Order: đúng một assignment chính được tạo; các yêu cầu còn lại nhận thông báo rõ "công việc vừa được người khác nhận"; gửi lặp không tạo bản ghi trùng.

**Blocked by:** 11 (JOB-SRS-008).

**Status:** ready-for-agent

- [ ] E2E: hai claim song song vào cùng Work Order → đúng 1 thành công, 1 nhận lỗi nghiệp vụ riêng biệt (khác lỗi eligibility).
- [ ] Gửi lặp (worker bấm lại / retry) không tạo assignment thứ hai.
- [ ] Bằng chứng single-winner được ghi lại làm completion evidence theo PLANS.md.

## Truy vết

SRS JOB-SRS-010 (§7.4, Must); BR-03, BR-05; ADR-0004.
