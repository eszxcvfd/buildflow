# 11 — [JOB-SRS-008] Tự nhận công việc

**What to build:** Worker chọn "Nhận việc" và được xác nhận ngay khi việc còn trống và mọi điều kiện đạt (BR-02 — không bước phê duyệt lại). Claim chạy trong một transaction PostgreSQL với conditional UPDATE (compare-and-set Mở/Khả dụng → Đã phân công) theo ADR-0004; assignment ghi nguồn self-claim, hiệu lực ngay; công việc xuất hiện trong dữ liệu My Jobs của worker.

**Blocked by:** 07 (JOB-SRS-007 — nút nhận việc nằm trên trang chi tiết), 10 (JOB-SRS-009).

**Status:** ready-for-agent

- [ ] Không có bước quản lý phê duyệt lại; assignment ghi nhận Đã nhận (nguồn self-claim) và công việc xuất hiện trong My Jobs ở mức dữ liệu.
- [ ] Eligibility (ticket 10) được kiểm tra trong luồng claim; vi phạm trả lý do cụ thể.
- [ ] Nút "Nhận việc" trên trang chi tiết web; OpenAPI + typed client cập nhật.
- [ ] E2E happy path và ít nhất một nhánh eligibility fail.

## Truy vết

SRS JOB-SRS-008 (§7.4, Must); UC-04; BR-02; ADR-0004.
