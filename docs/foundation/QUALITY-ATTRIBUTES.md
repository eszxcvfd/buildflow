# Quality Attributes

These measurable requirements come from SRS V2.1, formally reconciled with approved change record [CR-001](changes/CR-001-business-policy-decisions.md). They are delivery constraints, not optional implementation advice.

| ID | Priority | Attribute | Requirement |
| --- | --- | --- | --- |
| NFR-PERF-001 | Must | Hiệu năng đọc | 95% thao tác mở danh sách/chi tiết/lịch phổ biến phản hồi trong 2 giây ở môi trường nghiệm thu và bộ dữ liệu baseline, không tính tải tệp. |
| NFR-PERF-002 | Must | Hiệu năng ghi | 95% thao tác tạo/cập nhật thông thường phản hồi trong 3 giây; UI hiển thị processing và ngăn gửi lặp ngoài ý muốn. |
| NFR-PERF-003 | Must | Self-accept đồng thời | Với 20 yêu cầu đồng thời cho cùng Work Order trong test, chỉ một assignment thành công và không có bản ghi trùng. |
| NFR-PERF-004 | Should | Dashboard | Dashboard chính nên tải trong 5 giây với tối thiểu 10.000 Work Order và 50.000 audit/state records trên môi trường benchmark được ghi lại. |
| NFR-SEC-001 | Must | Mã hóa truyền tải | Trao đổi có thông tin xác thực hoặc dữ liệu nghiệp vụ phải dùng kênh mã hóa trong môi trường triển khai. |
| NFR-SEC-002 | Must | Lưu mật khẩu | Mật khẩu không lưu/log ở dạng đọc được; cơ chế lưu dùng password hashing phù hợp và salt. |
| NFR-SEC-003 | Must | Phân quyền Backend | Mỗi thao tác đọc/ghi phải kiểm tra quyền và project scope ở Backend; không tin cậy quyền từ UI (độc lập quyền giữa Project Manager và Coordinator - Q-01 / CR-001). |
| NFR-SEC-004 | Must | Kiểm soát đầu vào | Input được kiểm tra kiểu, độ dài, phạm vi và định dạng; tệp được kiểm tra loại, kích thước và tên an toàn. |
| NFR-SEC-005 | Must | Chống dò đăng nhập | Hệ thống phải giới hạn thử đăng nhập thất bại hoặc áp dụng throttling/lockout theo cấu hình. |
| NFR-SEC-006 | Must | Bảo vệ log/audit | Log không ghi mật khẩu, reset code, access token hoặc bí mật; quyền xem audit giới hạn theo role. |
| NFR-REL-001 | Must | Tính nguyên tử | Self-accept, direct assignment, state transition và quality close phải hoàn tất toàn bộ hoặc không để lại dữ liệu một phần. |
| NFR-REL-002 | Must | Chống gửi lặp | Các thao tác ghi nhạy cảm phải an toàn khi bấm nhiều lần/retry; cùng yêu cầu không tạo nhiều bản ghi nghiệp vụ. |
| NFR-REL-003 | Must | Phục hồi lỗi UI | Khi thao tác thất bại, UI hiển thị kết quả rõ; dữ liệu hợp lệ chưa gửi được giữ ở mức có thể để retry. |
| NFR-REL-004 | Must | Upload retry | Upload ảnh/tệp thất bại phải hiển thị trạng thái, cho phép retry và không tạo attachment trùng ngoài ý muốn. |
| NFR-REL-005 | Should | Sao lưu/khôi phục | Môi trường demo/triển khai nên có backup định kỳ và một kịch bản restore đã được thử trước nghiệm thu. |
| NFR-USA-001 | Must | Luồng Mobile | Sau đăng nhập, Worker phải vào My Jobs/Job Board trong không quá hai hành động điều hướng chính; next action của WO hiển thị rõ. |
| NFR-USA-002 | Must | Lỗi có thể hành động | Lỗi nghiệp vụ phải nêu nguyên nhân và cách xử lý khi xác định được; tránh thông báo chung không hướng dẫn. |
| NFR-USA-003 | Must | Responsive | Web dùng được từ 1366x768; Mobile dùng được từ chiều rộng 360px mà không mất hành động chính. |
| NFR-USA-004 | Must | Khả năng truy cập cơ bản | Chức năng chính có nhãn rõ; trạng thái không chỉ thể hiện bằng màu; Web hỗ trợ keyboard cho form/action chính. |
| NFR-CMP-001 | Must | Trình duyệt Web | Web hỗ trợ hai phiên bản ổn định gần nhất của Chrome và Edge; các luồng chính được smoke-test trên Firefox. |
| NFR-CMP-002 | Must | Nền tảng Mobile | Phạm vi phát hành và nghiệm thu Mobile cam kết hỗ trợ Android 10+. iOS nằm ngoài phạm vi nghiệm thu cam kết của V1 (Q-14 / CR-001). |
| NFR-MNT-001 | Must | Khả năng kiểm thử | Business rule eligibility, dependency/readiness gate, one-winner, blocker duration và quality gate phải có unit/integration test phù hợp. |
| NFR-MNT-002 | Must | Logging/correlation | Lỗi hệ thống và thao tác quan trọng phải có mã correlation/request để đối chiếu giữa phản hồi, server log và audit. |
| NFR-MNT-003 | Must | Cấu hình môi trường | Secret và cấu hình môi trường tách khỏi source/public docs; có hướng dẫn cấu hình cho môi trường demo. |

## Verification policy

- Record the benchmark environment, dataset size and measurement method with every performance result.
- Treat authorization, one-winner assignment, Start gate, Hold Point and quality close failures as release-blocking.
- Test retry/idempotency and concurrent execution at the application boundary, not only with isolated units.
- Web and Mobile must demonstrate shared business state; a channel-specific copy of a rule is not acceptable.
- NFR-CMP-002 is approved for Android 10+ (CR-001/Q-14). iOS is excluded from committed V1 release/acceptance verification.
