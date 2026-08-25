# 02 — [JOB-SRS-019] Cập nhật tiến độ và nhật ký

**What to build:** Worker cập nhật phần trăm hoặc mốc tiến độ, ghi chú hiện trường, vấn đề phát sinh và ảnh bằng chứng. Tiến độ nằm trong phạm vi hợp lệ; mỗi lần cập nhật có người/thời điểm; upload thất bại hiển thị trạng thái và cho phép thử lại.

**Blocked by:** slice-7/01.

**Status:** ready-for-agent

- [ ] Cập nhật tiến độ (validate 0–100/mốc hợp lệ) + nhật ký + ảnh.
- [ ] Mỗi bản ghi có actor + thời điểm (BR-10).
- [ ] Upload ảnh thất bại → trạng thái lỗi + retry được.
- [ ] E2e + contract cập nhật.

## Truy vết

SRS JOB-SRS-019 (§7.4, Must); BR-10; upload theo SRS §10.3.
