# 06 — [QUA-SRS-008] Tạo yêu cầu khắc phục

**What to build:** Với mỗi hạng mục không đạt, QC ghi mô tả lỗi, mức độ, người chịu trách nhiệm, hạn khắc phục và bằng chứng khi cần. Hạng mục có trạng thái riêng; Work Order chuyển Cần làm lại và không được hoàn tất.

**Blocked by:** slice-8/03; **chốt Q-08 trước khi làm** (phân mức lỗi).

**Status:** ready-for-agent

- [ ] Tạo hạng mục khắc phục: mô tả, mức độ (theo Q-08), người chịu trách nhiệm, hạn.
- [ ] Hạng mục có vòng đời riêng (mở → chờ tái kiểm tra → đạt).
- [ ] WO có hạng mục mở → Cần làm lại, không hoàn tất được (BR-09).
- [ ] E2e + contract cập nhật.

## Truy vết

SRS QUA-SRS-008 (§7.6, Must); Q-08 (SRS §14.1) — chưa chốt.
