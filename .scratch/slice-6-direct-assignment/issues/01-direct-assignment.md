# 01 — [JOB-SRS-012] Phân công trực tiếp

**What to build:** Điều phối viên gán Work Order cho worker, đội hoặc nhà thầu phù hợp. Trước khi gán kiểm tra trạng thái hoạt động, năng lực và lịch như luồng tự nhận; assignment ghi nguồn Phân công trực tiếp, hiệu lực ngay (Q-02). Xung đột lịch: cảnh báo, được ghi đè kèm lý do (Q-05, hai chế độ).

**Blocked by:** slice-5/04, slice-3/05.

**Status:** ready-for-agent

- [ ] Gán WO cho worker/đội/nhà thầu; kiểm tra eligibility như self-claim.
- [ ] Assignment nguồn direct, hiệu lực ngay — không bước xác nhận.
- [ ] Trùng lịch: trả cảnh báo; ghi đệ có flag + lý do bắt buộc; self-claim vẫn chặn cứng.
- [ ] Gán khi WO đã có assignee bị từ chối (một assignment chính — BR-03).
- [ ] E2e + unit (Seam B).

## Truy vết

SRS JOB-SRS-012 (§7.4, Must); BR-01, BR-03, BR-04; Q-02/Q-05 đã chốt (SRS §14.1.1); ADR-0004.
