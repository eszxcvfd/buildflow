---
status: accepted
---

# Single-winner claim thực hiện bằng conditional UPDATE trong PostgreSQL

BR-05 (SRS §4) yêu cầu nhiều yêu cầu nhận cùng một Work Order chỉ tạo đúng một assignment chính. Chọn enforce bằng conditional UPDATE trong một transaction PostgreSQL trên system of record: compare-and-set trạng thái Mở/Khả dụng → Đã phân công; rowcount 1 nghĩa là winner, yêu cầu thua nhận lỗi nghiệp vụ rõ ràng ("công việc vừa được người khác nhận"). Bác Redis distributed lock: Redis là cache/coordination không authoritative (ADR-0002, `docs/architecture/DATA.md` §4), và lock thêm TTL/failure semantics mà không phải nguồn sự thật của assignment. Hệ quả: Redis không nằm trong domain logic — giữ đúng vai trò cache/coordination; hành vi concurrent được chứng minh bằng integration test hai transaction song song.
