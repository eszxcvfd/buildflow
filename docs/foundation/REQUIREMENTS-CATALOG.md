# Functional Requirements Catalog

Canonical normalized index of SRS-CWM-QC-002 V2.1, formally reconciled with approved change record [CR-001](changes/CR-001-business-policy-decisions.md). Full historical wording remains available in [sources/SRS-v2.1.md](sources/SRS-v2.1.md).

## Coverage

| Group | Total | Must | Should |
| --- | ---: | ---: | ---: |
| IAM | 8 | 7 | 1 |
| ORG | 9 | 9 | 0 |
| PRJ | 10 | 8 | 2 |
| JOB | 25 | 22 | 3 |
| SCH | 7 | 4 | 3 |
| QUA | 15 | 13 | 2 |
| RPT | 8 | 7 | 1 |
| **Total** | **82** | **70** | **12** |

## IAM

### IAM-SRS-001 — Đăng nhập (Must)

- Actor: Tất cả người dùng
- Channel: Web/Mobile
- Requirement: Hệ thống phải cho phép người dùng đăng nhập bằng thông tin xác thực hợp lệ và khởi tạo phiên theo vai trò được cấp.
- Truy vết BRD: IAM-01 | Quy tắc: BR-19 | Use Case: UC-01
- Tài khoản khóa/ngừng hoạt động bị từ chối; lỗi không tiết lộ tài khoản có tồn tại; sau đăng nhập chỉ thấy chức năng và dữ liệu thuộc quyền.

### IAM-SRS-002 — Đăng xuất và hết phiên (Must)

- Actor: Tất cả người dùng
- Channel: Web/Mobile
- Requirement: Người dùng phải có thể đăng xuất; hệ thống phải kết thúc hoặc yêu cầu xác thực lại khi phiên hết hạn hoặc bị thu hồi.
- Truy vết BRD: IAM-01 | Use Case: UC-01
- Đăng xuất làm mất hiệu lực phiên hiện tại; dữ liệu đã lưu hợp lệ không mất; yêu cầu bằng phiên hết hạn bị từ chối.

### IAM-SRS-003 — Quản lý hồ sơ cá nhân (Must)

- Actor: Người dùng
- Channel: Web/Mobile
- Requirement: Người dùng phải xem và cập nhật các trường hồ sơ được phép như họ tên, điện thoại, ảnh đại diện và thông tin liên hệ.
- Truy vết BRD: IAM-03 | Use Case: UC-01
- Trường ảnh hưởng định danh/quyền không được tự thay đổi; dữ liệu hợp lệ hiển thị nhất quán giữa các kênh.

### IAM-SRS-004 — Quản lý tài khoản (Must)

- Actor: Quản trị viên
- Channel: Web
- Requirement: Quản trị viên phải tạo, cập nhật, khóa, mở khóa và ngừng hoạt động tài khoản trong phạm vi doanh nghiệp.
- Truy vết BRD: IAM-04 | Quy tắc: BR-18, BR-19 | Use Case: UC-01
- Email/tên đăng nhập duy nhất; tài khoản có lịch sử không xóa cứng; thay đổi trạng thái lưu actor và thời điểm.

### IAM-SRS-005 — Gán vai trò và quyền (Must)

- Actor: Quản trị viên
- Channel: Web
- Requirement: Quản trị viên phải gán vai trò đã được phê duyệt (bao gồm `Project Manager` và `Coordinator` là hai vai trò độc lập; một người dùng có thể giữ cả hai vai trò); hệ thống phải kiểm tra quyền xem và thao tác ở phía Backend.
- Truy vết BRD: IAM-05 | Quy tắc: BR-19 | Use Case: UC-01
- Ẩn nút trên UI không thay thế kiểm tra quyền; thay đổi quyền có hiệu lực theo chính sách phiên và được audit (Q-01 / CR-001).

### IAM-SRS-006 — Giới hạn dữ liệu theo dự án (Must)

- Actor: Hệ thống
- Channel: System
- Requirement: Hệ thống phải giới hạn dữ liệu nghiệp vụ theo vai trò (Project Manager quản trị/thiết lập dự án, Coordinator lập kế hoạch/điều phối công việc) và danh sách dự án mà người dùng tham gia.
- Truy vết BRD: IAM-05 | Quy tắc: BR-19 | Use Case: UC-01
- Sửa ID/URL không cho phép truy cập dự án ngoài phạm vi; ngoại lệ quản trị phải được xác định và audit (Q-01 / CR-001).

### IAM-SRS-007 — Đổi và đặt lại mật khẩu (Should)

- Actor: Tất cả người dùng
- Channel: Web/Mobile
- Requirement: Người dùng nên có thể đổi mật khẩu khi đang đăng nhập và yêu cầu đặt lại mật khẩu khi quên.
- Truy vết BRD: IAM-02 | Use Case: UC-01
- Mã/liên kết đặt lại có thời hạn và dùng một lần; mật khẩu mới tuân chính sách; không tiết lộ email có tồn tại.

### IAM-SRS-008 — Nhật ký xác thực và tài khoản (Must)

- Actor: Hệ thống/Quản trị viên
- Channel: System/Web
- Requirement: Hệ thống phải ghi đăng nhập thành công/thất bại, đăng xuất, khóa/mở khóa, ngừng hoạt động và thay đổi vai trò.
- Truy vết BRD: IAM-04, RPT-04 | Quy tắc: BR-18 | Use Case: UC-01, UC-09
- Nhật ký có actor, thời điểm, hành động và kết quả; không ghi mật khẩu, mã đặt lại hoặc token bí mật.

## ORG

### ORG-SRS-001 — Quản lý Worker (Must)

- Actor: Quản trị viên
- Channel: Web
- Requirement: Quản trị viên phải tạo, xem, cập nhật và tìm kiếm hồ sơ Worker gồm liên hệ, trạng thái, ngành nghề và kỹ năng.
- Truy vết BRD: ORG-01 | Quy tắc: BR-04 | Use Case: UC-02
- Worker ngừng hoạt động không được nhận/phân công việc mới; lịch sử assignment cũ vẫn giữ.

### ORG-SRS-002 — Quản lý nhà thầu (Must)

- Actor: Quản trị viên
- Channel: Web
- Requirement: Hệ thống phải lưu hồ sơ nhà thầu/đối tác thi công và liên kết Worker/Crew thuộc nhà thầu khi áp dụng.
- Truy vết BRD: ORG-01 | Use Case: UC-02
- Nhà thầu ngừng hoạt động không dùng cho quan hệ mới; Work Order vẫn được giao cho Worker hoặc Crew, không giao trực tiếp cho hồ sơ tổ chức.

### ORG-SRS-003 — Quản lý ngành nghề và kỹ năng (Must)

- Actor: Quản trị viên
- Channel: Web
- Requirement: Quản trị viên phải quản lý danh mục Trade/Skill và gán năng lực phù hợp cho Worker/Crew.
- Truy vết BRD: ORG-02 | Quy tắc: BR-04 | Use Case: UC-02
- Danh mục đã dùng chỉ ngừng hoạt động; skill hết hiệu lực không dùng cho kiểm tra assignment mới.

### ORG-SRS-004 — Quản lý trạng thái nguồn lực (Must)

- Actor: Quản trị viên
- Channel: Web
- Requirement: Quản trị viên phải kích hoạt, tạm ngừng hoặc ngừng hoạt động Worker, Crew và nhà thầu.
- Truy vết BRD: ORG-04 | Quy tắc: BR-04, BR-18 | Use Case: UC-02
- Trước khi ngừng hoạt động phải cảnh báo assignment/lịch đang mở; không làm mất lịch sử.

### ORG-SRS-005 — Tra cứu nguồn lực (Must)

- Actor: Quản lý/Điều phối viên
- Channel: Web
- Requirement: Người có quyền phải tìm kiếm/lọc nguồn lực theo trạng thái, trade/skill, crew và dự án để phục vụ điều phối.
- Truy vết BRD: ORG-05 | Quy tắc: BR-04, BR-19 | Use Case: UC-02, UC-03
- Kết quả chỉ chứa nguồn lực trong phạm vi được phép và phản ánh dữ liệu hiện hành.

### ORG-SRS-006 — Quản lý Crew (Must)

- Actor: Điều phối viên/Quản trị viên
- Channel: Web
- Requirement: Người có quyền phải tạo Crew/Tổ đội, đặt tên, liên kết nhà thầu khi cần và quản lý trạng thái Crew.
- Truy vết BRD: ORG-03 | Quy tắc: BR-03 | Use Case: UC-02
- Crew ngừng hoạt động không nhận assignment mới; lịch sử công việc cũ không đổi.

### ORG-SRS-007 — Quản lý thành viên Crew (Must)

- Actor: Điều phối viên/Quản trị viên
- Channel: Web
- Requirement: Người có quyền phải thêm/loại thành viên Crew và ghi thời gian hiệu lực của quan hệ thành viên.
- Truy vết BRD: ORG-03 | Quy tắc: BR-06, BR-18 | Use Case: UC-02
- Lịch sử thành viên tại thời điểm thực hiện được bảo toàn; hệ thống cảnh báo dữ liệu trùng/không hợp lệ.

### ORG-SRS-008 — Chỉ định Crew Lead (Must)

- Actor: Điều phối viên/Quản trị viên
- Channel: Web
- Requirement: Mỗi Crew đang hoạt động dùng cho assignment phải có đúng một Crew Lead hiệu lực tại một thời điểm. Thao tác xác nhận Work Done tại thời điểm thực hiện lệnh tuân theo Crew Lead hiện hành; Crew Lead tại thời điểm phân công được lưu lại thành snapshot lịch sử phục vụ audit (Q-06 / CR-001).
- Truy vết BRD: ORG-03 | Quy tắc: BR-06, BR-07 | Use Case: UC-02, UC-03
- Crew Lead phải là thành viên Crew và đang hoạt động; thay đổi Lead giữ lịch sử và không tự sửa actor của thao tác đã phát sinh.

### ORG-SRS-009 — Cung cấp dữ liệu eligibility (Must)

- Actor: Hệ thống
- Channel: System
- Requirement: Hệ thống phải cung cấp trạng thái hoạt động, skill, crew membership, Crew Lead và khoảng thời gian lịch trình để kiểm tra không chồng lấn thời gian cho bước phân công/tự nhận.
- Truy vết BRD: ORG-05 | Quy tắc: BR-04, BR-06 | Use Case: UC-03, UC-04
- Các kiểm tra mới dùng dữ liệu hiện hành; assignment đã phát sinh vẫn giữ snapshot/lịch sử cần thiết (Q-03, Q-04 / CR-001).

## PRJ

### PRJ-SRS-001 — Tạo và cập nhật dự án (Must)

- Actor: Quản lý dự án
- Channel: Web
- Requirement: Quản lý dự án phải tạo/cập nhật dự án với mã, tên, địa điểm, thời gian dự kiến, người phụ trách và mô tả.
- Truy vết BRD: PRJ-01 | Use Case: UC-02
- Mã dự án duy nhất; trường bắt buộc được kiểm tra; thay đổi quan trọng được audit.

### PRJ-SRS-002 — Quản lý trạng thái dự án (Must)

- Actor: Quản lý dự án
- Channel: Web
- Requirement: Người có quyền phải chuyển dự án giữa Nháp, Đang hoạt động, Tạm dừng, Hoàn thành và Đóng theo điều kiện.
- Truy vết BRD: PRJ-01 | Quy tắc: BR-19 | Use Case: UC-02
- Dự án Đóng không tạo Work Order mới; mở lại cần quyền và lý do.

### PRJ-SRS-003 — Quản lý khu vực/hạng mục (Must)

- Actor: Quản lý dự án
- Channel: Web
- Requirement: Dự án phải hỗ trợ khu vực/hạng mục để liên kết Work Order và tổng hợp tiến độ.
- Truy vết BRD: PRJ-02 | Use Case: UC-02
- Baseline hỗ trợ cấu trúc phân nhóm đủ cho phạm vi đồ án; hạng mục đã dùng không bị xóa làm mất lịch sử.

### PRJ-SRS-004 — Quản lý loại công việc (Must)

- Actor: Quản trị viên/Điều phối viên
- Channel: Web
- Requirement: Hệ thống phải quản lý loại công việc, nhóm công việc, skill yêu cầu, checklist/checkpoint mặc định và dữ liệu bắt buộc.
- Truy vết BRD: PRJ-03 | Quy tắc: BR-04, BR-13, BR-14 | Use Case: UC-02
- Loại công việc ngừng hoạt động không dùng cho WO mới; dữ liệu cũ hiển thị đúng.

### PRJ-SRS-005 — Quản lý thành viên dự án (Must)

- Actor: Quản lý dự án
- Channel: Web
- Requirement: Quản lý dự án phải thêm/loại quản lý dự án, điều phối viên, QC và người dùng liên quan vào dự án (hỗ trợ phân biệt độc lập vai trò Project Manager và Coordinator - Q-01 / CR-001).
- Truy vết BRD: PRJ-04 | Quy tắc: BR-19 | Use Case: UC-02
- Người bị loại không truy cập dữ liệu mới nhưng hành động lịch sử vẫn giữ.

### PRJ-SRS-006 — Kiểm soát truy cập dự án (Must)

- Actor: Hệ thống
- Channel: System
- Requirement: Hệ thống phải dùng vai trò và quan hệ thành viên dự án để giới hạn danh sách, chi tiết và thao tác theo đúng phân quyền của Project Manager và Coordinator.
- Truy vết BRD: PRJ-04, IAM-05 | Quy tắc: BR-19 | Use Case: UC-01, UC-02
- Không thể vượt quyền bằng sửa tham số; ngoại lệ quản trị được audit (Q-01 / CR-001).

### PRJ-SRS-007 — Quản lý vòng đời dữ liệu nền (Must)

- Actor: Quản trị viên
- Channel: Web
- Requirement: Danh mục đã phát sinh giao dịch phải hỗ trợ trạng thái hoạt động/ngừng hoạt động thay cho xóa cứng.
- Truy vết BRD: PRJ-01 | Quy tắc: BR-18 | Use Case: UC-02
- Danh sách chọn giao dịch mới chỉ hiển thị bản ghi đang hoạt động; lịch sử cũ không mất.

### PRJ-SRS-008 — Quản lý mẫu Work Order (Should)

- Actor: Điều phối viên
- Channel: Web
- Requirement: Điều phối viên nên tạo mẫu gồm mô tả, thời lượng, skill, checklist/checkpoint và vật tư dự kiến để dùng khi tạo Work Order.
- Truy vết BRD: PRJ-06 | Use Case: UC-02, UC-03
- Sửa mẫu không thay đổi Work Order đã tạo; có thể chỉnh dữ liệu sau khi áp dụng mẫu.

### PRJ-SRS-009 — Quản lý tệp tham chiếu cơ bản (Should)

- Actor: Quản lý dự án
- Channel: Web
- Requirement: Người có quyền nên tải lên/xem/ngừng sử dụng tệp gắn với dự án hoặc Work Order.
- Truy vết BRD: PRJ-06 | Use Case: UC-02, UC-05
- Kiểm tra loại/kích thước; không bao gồm cây thư mục, public sharing hoặc versioning tài liệu phức tạp.

### PRJ-SRS-010 — Quản lý dependency giữa Work Order (Must)

- Actor: Điều phối viên
- Channel: Web
- Requirement: Điều phối viên phải có thể xác định một hoặc nhiều Work Order tiền nhiệm bắt buộc (mandatory/hard dependency). V1 chỉ hỗ trợ hard dependency; nếu dependency chưa thỏa thì Work Order phụ thuộc không được Start (Q-07 / CR-001).
- Truy vết BRD: PRJ-05 | Quy tắc: BR-08 | Use Case: UC-03, UC-05
- Không tạo vòng lặp dependency trực tiếp; dependency bắt buộc được dùng trong readiness; thay đổi giữ audit.

## JOB

### JOB-SRS-001 — Tạo Work Order nháp (Must)

- Actor: Điều phối viên
- Channel: Web
- Requirement: Điều phối viên phải tạo Work Order gắn với dự án, khu vực/hạng mục, loại công việc, mô tả, ưu tiên, thời hạn và skill yêu cầu.
- Truy vết BRD: JOB-01 | Use Case: UC-03
- Thiếu dữ liệu bắt buộc chỉ cho lưu Nháp; WO nháp chưa được phân công hoặc hiển thị Job Board.

### JOB-SRS-002 — Kiểm tra điều kiện phát hành (Must)

- Actor: Hệ thống
- Channel: System
- Requirement: Trước khi phân công hoặc mở Job Board, hệ thống phải kiểm tra dự án, dữ liệu bắt buộc, loại công việc, lịch cơ bản và các điều kiện phát hành đã cấu hình.
- Truy vết BRD: JOB-02 | Quy tắc: BR-01 | Use Case: UC-03, UC-04
- Mọi điều kiện chưa đạt được liệt kê cụ thể; không tạo assignment một phần khi thất bại.

### JOB-SRS-003 — Cập nhật Work Order (Must)

- Actor: Điều phối viên
- Channel: Web
- Requirement: Điều phối viên phải cập nhật mô tả, ưu tiên, thời hạn, hướng dẫn, dependency và dữ liệu được phép khi trạng thái cho phép.
- Truy vết BRD: JOB-01 | Quy tắc: BR-17, BR-18 | Use Case: UC-03
- Thay đổi ảnh hưởng assignee/lịch gửi thông báo; dữ liệu sau Closed chỉ sửa qua ngoại lệ có audit.

### JOB-SRS-004 — Mở/đóng Job Board (Must)

- Actor: Điều phối viên
- Channel: Web
- Requirement: Điều phối viên phải mở WO đủ điều kiện lên Job Board và đóng khỏi danh sách khi cần.
- Truy vết BRD: JOB-03 | Quy tắc: BR-01 | Use Case: UC-04
- Chỉ WO READY/OPEN, chưa có assignment và chưa hủy được hiển thị; đóng Job Board không hủy assignment đã tồn tại.

### JOB-SRS-005 — Xem và lọc Job Board (Must)

- Actor: Worker
- Channel: Mobile
- Requirement: Worker phải xem và lọc các Work Order còn trống theo ngày, dự án, khu vực, loại công việc và skill.
- Truy vết BRD: JOB-04 | Quy tắc: BR-04, BR-19 | Use Case: UC-04
- Danh sách loại trừ WO đã có người nhận, hết thời gian khả dụng, sai trạng thái hoặc ngoài quyền dự án.

### JOB-SRS-006 — Xem chi tiết công việc còn trống (Must)

- Actor: Worker
- Channel: Mobile
- Requirement: Trước khi nhận, Worker phải xem thời gian, địa điểm, mô tả, skill, checklist/checkpoint, vật tư dự kiến và hướng dẫn cần thiết.
- Truy vết BRD: JOB-04 | Use Case: UC-04
- Thông tin là phiên bản hiện hành; không lộ dữ liệu ngoài quyền hoặc thông tin cá nhân không cần thiết.

### JOB-SRS-007 — Tự nhận Work Order (Must)

- Actor: Worker
- Channel: Mobile
- Requirement: Worker phải có thể chọn Nhận việc và được xác nhận ngay khi WO còn trống và mọi điều kiện eligibility đều đạt.
- Truy vết BRD: JOB-04 | Quy tắc: BR-01, BR-02 | Use Case: UC-04
- Không có bước quản lý phê duyệt lại; assignment ghi nguồn SELF_ACCEPT, chuyển ACTIVE ngay và WO xuất hiện trong My Jobs/lịch (Q-02 / CR-001).

### JOB-SRS-008 — Kiểm tra eligibility (Must)

- Actor: Hệ thống
- Channel: System
- Requirement: Hệ thống phải kiểm tra Worker đang hoạt động, đúng skill, thuộc phạm vi dự án, không bị trùng/chồng lấn khoảng thời gian thực hiện (scheduled time interval overlap) với các assignment đang active. Trùng lịch là hard block trong V1, không có override (Q-03, Q-04 / CR-001).
- Truy vết BRD: JOB-05 | Quy tắc: BR-04 | Use Case: UC-03, UC-04
- Mỗi điều kiện không đạt trả lý do cụ thể; không để lại assignment/bản ghi chờ không hợp lệ.

### JOB-SRS-009 — Bảo đảm một winner khi tự nhận (Must)

- Actor: Hệ thống
- Channel: System
- Requirement: Khi nhiều Worker nhận cùng Work Order, hệ thống phải bảo đảm chỉ một assignment ACTIVE được tạo.
- Truy vết BRD: JOB-05 | Quy tắc: BR-05 | Use Case: UC-04
- Một yêu cầu thành công; yêu cầu còn lại nhận kết quả WO đã được nhận; gửi lặp không tạo assignment trùng.

### JOB-SRS-010 — Phân công trực tiếp (Must)

- Actor: Điều phối viên
- Channel: Web
- Requirement: Điều phối viên phải phân công Work Order cho một Worker hoặc Crew phù hợp. Sau khi kiểm tra eligibility thành công, phân công trực tiếp tạo assignment ACTIVE ngay trong V1 mà không qua bước tiếp nhận trung gian (Q-02 / CR-001).
- Truy vết BRD: JOB-06 | Quy tắc: BR-01, BR-03, BR-04, BR-06 | Use Case: UC-03
- Phân công dùng cùng nguyên tắc trạng thái/skill/lịch; assignment ghi nguồn DIRECT; Crew phải active và có Crew Lead active.

### JOB-SRS-011 — Xác định trách nhiệm Assignment (Must)

- Actor: Hệ thống
- Channel: System
- Requirement: Hệ thống phải xác định người có quyền xác nhận ở cấp Work Order theo loại assignment.
- Truy vết BRD: JOB-07 | Quy tắc: BR-06, BR-07 | Use Case: UC-03, UC-05
- Assignment cá nhân: assigned Worker chịu trách nhiệm. Assignment Crew: Crew Lead hiệu lực tại thời điểm thực hiện lệnh chịu trách nhiệm; thành viên khác (non-Lead) chỉ cập nhật progress, ghi chú, ảnh, blocker và rectification được giao, không được Submit Work Done (Q-05, Q-06 / CR-001).

### JOB-SRS-012 — Tái phân công và thu hồi (Must)

- Actor: Điều phối viên
- Channel: Web
- Requirement: Điều phối viên phải thay hoặc thu hồi assignment khi trạng thái cho phép.
- Truy vết BRD: JOB-08 | Quy tắc: BR-17, BR-18 | Use Case: UC-03
- Bắt buộc lý do; giữ assignee trước, Crew Lead liên quan, thời điểm và actor; cập nhật lịch/thông báo tương ứng.

### JOB-SRS-013 — Tiếp nhận/từ chối phân công trực tiếp (Should)

- Actor: Worker
- Channel: Mobile
- Requirement: Nếu chính sách dự án mở rộng yêu cầu xác nhận, Worker/Crew Lead nên có thể tiếp nhận hoặc từ chối assignment trực tiếp kèm lý do (Tính năng thuộc Should backlog, không bật trong V1 baseline - Q-02 / CR-001).
- Truy vết BRD: JOB-09 | Use Case: UC-03
- Từ chối đưa WO về cần điều phối; không áp dụng cho self-accept đã có hiệu lực ngay.

### JOB-SRS-014 — Hủy hoặc bỏ việc có kiểm soát (Should)

- Actor: Worker/Crew Lead/Điều phối viên
- Channel: Mobile/Web
- Requirement: Người có quyền nên có thể yêu cầu hủy/bỏ assignment theo điều kiện và cung cấp lý do.
- Truy vết BRD: JOB-10 | Quy tắc: BR-17 | Use Case: UC-03, UC-05
- Không hủy âm thầm sau khi công việc bị khóa; có thể đưa WO về trạng thái phù hợp để tái điều phối; giữ audit.

### JOB-SRS-015 — Xem My Jobs/Today Jobs (Must)

- Actor: Worker/Crew Lead
- Channel: Mobile
- Requirement: Người thực hiện phải xem các WO mình chịu trách nhiệm, phân nhóm Hôm nay, Sắp tới, Đang thực hiện và Work Done.
- Truy vết BRD: JOB-11 | Use Case: UC-05
- Danh sách phản ánh đổi lịch, thu hồi, reassign và assignment hiện hành; Crew Lead thấy WO của Crew.

### JOB-SRS-016 — Xem chi tiết và hành động khả dụng (Must)

- Actor: Worker/Crew Lead
- Channel: Mobile
- Requirement: Người thực hiện phải xem WO, lịch, dependency, checklist/checkpoint, vật tư, readiness, blocker, tiến độ và hành động hợp lệ.
- Truy vết BRD: JOB-11 | Quy tắc: BR-07, BR-08, BR-09 | Use Case: UC-05
- Hành động không hợp lệ không được thực hiện; trạng thái thay đổi trong lúc xem phải được kiểm tra lại.

### JOB-SRS-017 — Thực hiện Pre-start Readiness (Must)

- Actor: Worker/Crew Lead
- Channel: Mobile
- Requirement: Trước khi Start, người chịu trách nhiệm phải xem/ghi nhận điều kiện sẵn sàng gồm dependency bắt buộc, mặt bằng/access, nguồn lực, vật tư, thông tin thi công, checklist và checkpoint bắt buộc (Q-08 / CR-001).
- Truy vết BRD: JOB-12 | Quy tắc: BR-08, BR-09 | Use Case: UC-05
- Hệ thống tự kiểm tra điều kiện có dữ liệu; mục do hiện trường xác nhận lưu actor, thời điểm và bằng chứng khi cần.

### JOB-SRS-018 — Ghi nhận kết quả Readiness và Start gate (Must)

- Actor: Hệ thống/Worker/Crew Lead
- Channel: System/Mobile
- Requirement: Hệ thống phải ghi nhận READY, READY_WITH_CONSTRAINT hoặc NOT_READY và quyết định khả năng Start theo các điều kiện blocking.
- Truy vết BRD: JOB-12 | Quy tắc: BR-09, BR-10 | Use Case: UC-05
- Nếu có bất kỳ blocking readiness item nào không đạt thì kết quả là `NOT_READY` và Start bị cấm; không có cơ chế override blocking readiness trong V1. `READY_WITH_CONSTRAINT` chỉ cho phép Start khi tất cả constraint còn lại đều non-blocking (Q-08 / CR-001).

### JOB-SRS-019 — Ghi nhận Blocker/Constraint (Must)

- Actor: Worker/Crew Lead/Crew Member
- Channel: Mobile
- Requirement: Người thực hiện phải có thể tạo blocker trước hoặc trong khi thi công, chọn loại nguyên nhân, mô tả, người/bên chịu trách nhiệm bắt buộc (Responsible Party), mức ảnh hưởng và đính kèm bằng chứng (Q-09 / CR-001).
- Truy vết BRD: JOB-13 | Quy tắc: BR-10, BR-11 | Use Case: UC-06
- Blocker gắn đúng WO, actor, thời điểm; trường Responsible Party là bắt buộc; vòng đời blocker độc lập với execution state của Work Order; không tạo state tên `Blocked`.

### JOB-SRS-020 — Theo dõi và giải quyết Blocker (Must)

- Actor: Điều phối viên/Quản lý dự án/Worker/Crew Lead
- Channel: Web/Mobile
- Requirement: Người có quyền phải xem blocker đang mở, tiếp nhận, cập nhật xử lý và xác nhận resolved kèm thông tin kiểm toán.
- Truy vết BRD: JOB-13 | Quy tắc: BR-10, BR-11 | Use Case: UC-06
- Quyền xử lý: assigned Worker/Crew Lead resolve blocker thuộc phạm vi công việc của mình; Coordinator resolve blocker trong phạm vi điều phối dự án; Project Manager có quyền quản trị/resolve blocker của dự án. Mọi thao tác resolve lưu actor, thời điểm, note và duration; resolve không tự đổi execution state ngoài rule và không bypass quality gate (Q-09 / CR-001).

### JOB-SRS-021 — Tạm dừng và tiếp tục có lý do (Should)

- Actor: Worker/Crew Lead
- Channel: Mobile
- Requirement: Người chịu trách nhiệm nên có thể tạm dừng/tiếp tục phần thi công khi trạng thái cho phép.
- Truy vết BRD: JOB-15 | Use Case: UC-05, UC-06
- Pause bắt buộc chọn lý do hoặc liên kết blocker; mỗi mốc lưu thời điểm/actor; không thay thế blocker nếu có cản trở thực sự.

### JOB-SRS-022 — Cập nhật tiến độ, nhật ký và bằng chứng (Must)

- Actor: Worker/Crew Lead/Crew Member được quyền
- Channel: Mobile
- Requirement: Người được phép phải cập nhật tiến độ, ghi chú hiện trường và ảnh/tệp bằng chứng cho Work Order. Thành viên tổ đội (non-Lead Crew Member) được quyền cập nhật tiến độ, ghi chú, bằng chứng ảnh, báo blocker và cập nhật rectification được giao, nhưng KHÔNG được quyền gửi Work Done (Q-05 / CR-001).
- Truy vết BRD: JOB-14 | Quy tắc: BR-07 | Use Case: UC-05
- Tiến độ trong phạm vi hợp lệ; mỗi lần cập nhật có actor/thời điểm; Crew member không được Submit Work Done nếu không phải Crew Lead.

### JOB-SRS-023 — Khai báo vật tư dự kiến (Must)

- Actor: Điều phối viên/Quản lý
- Channel: Web
- Requirement: Người có quyền phải khai báo vật tư và số lượng dự kiến phục vụ trực tiếp Work Order.
- Truy vết BRD: JOB-16 | Quy tắc: BR-12 | Use Case: UC-03, UC-08
- Vật tư là thông tin planning, không phải tồn kho; Worker/Crew Lead xem được trước khi thực hiện; thay đổi quan trọng được audit.

### JOB-SRS-024 — Kiểm tra vật tư và yêu cầu bổ sung (Must)

- Actor: Worker/Crew Lead/Quản lý
- Channel: Mobile/Web
- Requirement: Worker/Crew Lead phải ghi nhận mức sẵn sàng vật tư; khi thiếu có thể tạo yêu cầu bổ sung với vật tư, số lượng, ghi chú/bằng chứng; quản lý cập nhật tình trạng xử lý.
- Truy vết BRD: JOB-16, JOB-17 | Quy tắc: BR-12 | Use Case: UC-08
- Thiếu vật tư không tự động block WO; phải ghi riêng mức ảnh hưởng. Request dùng REQUESTED → ACKNOWLEDGED → IN_PROGRESS → FULFILLED/CANCELLED; không có approval/procurement.

### JOB-SRS-025 — Gửi Work Done (Must)

- Actor: Assigned Worker/Current Effective Crew Lead
- Channel: Mobile
- Requirement: Sau khi hoàn tất phần thi công và dữ liệu bắt buộc, assigned Worker hoặc Crew Lead hiện hành (tại thời điểm gửi lệnh) phải có thể gửi Work Order sang WORK_DONE để chờ quality gate/final inspection (Q-06 / CR-001).
- Truy vết BRD: JOB-18 | Quy tắc: BR-07, BR-15, BR-16 | Use Case: UC-05, UC-07
- Chỉ đúng người chịu trách nhiệm được gửi; hệ thống chỉ rõ dữ liệu còn thiếu; Work Done không đồng nghĩa Closed; gửi lặp không tạo tác động trùng.

## SCH

### SCH-SRS-001 — Lập và cập nhật lịch Work Order (Must)

- Actor: Điều phối viên
- Channel: Web
- Requirement: Điều phối viên phải thiết lập ngày/giờ bắt đầu, thời lượng dự kiến và hạn hoàn thành.
- Truy vết BRD: SCH-01 | Use Case: UC-03
- Start < end; thay đổi sau assignment giữ lịch cũ, actor và gửi thông báo.

### SCH-SRS-002 — Xem lịch ngày/tuần/tháng (Must)

- Actor: Các vai trò liên quan
- Channel: Web
- Requirement: Web phải hiển thị lịch theo ngày/tuần/tháng theo phạm vi quyền và mở được chi tiết Work Order.
- Truy vết BRD: SCH-02 | Use Case: UC-03, UC-09
- Lịch phản ánh trạng thái hiện hành; WO hủy/closed được phân biệt; múi giờ nhất quán.

### SCH-SRS-003 — Xem lịch Hôm nay và Sắp tới (Must)

- Actor: Worker/Crew Lead
- Channel: Mobile
- Requirement: Mobile phải hiển thị công việc theo thời gian, trạng thái và hành động tiếp theo của Worker/Crew Lead.
- Truy vết BRD: SCH-02 | Use Case: UC-05
- Đổi lịch/thu hồi/reassign cập nhật sau refresh; không còn assignment thì không hiển thị như đang thực hiện.

### SCH-SRS-004 — Đối chiếu xung đột lịch (Must)

- Actor: Hệ thống
- Channel: System
- Requirement: Trước self-accept/direct assign, hệ thống phải so sánh khoảng thời gian thực hiện (scheduled time interval) của WO với các assignment đang active của nguồn lực. Nếu phát hiện chồng lấn thời gian (overlap), hệ thống từ chối phân công/nhận việc (hard block trong V1) kèm lý do rõ ràng (Q-03, Q-04 / CR-001).
- Truy vết BRD: SCH-03 | Quy tắc: BR-04 | Use Case: UC-03, UC-04
- So sánh theo khoảng thời gian, không chỉ theo ngày; kết quả được dùng trong eligibility.

### SCH-SRS-005 — Cảnh báo quá tải và ghi đè có kiểm soát (Should)

- Actor: Điều phối viên
- Channel: Web
- Requirement: Hệ thống nên cảnh báo hoặc cho phép ghi đè quá tải/trùng lịch theo chính sách cấu hình có kiểm soát (Ghi đè trùng lịch thuộc Should backlog, không hỗ trợ trong V1 baseline - Q-04 / CR-001).
- Truy vết BRD: SCH-04 | Use Case: UC-03
- Ghi đè nếu được phép trong tương lai phải có quyền/lý do; baseline không tự tối ưu lịch.

### SCH-SRS-006 — So sánh kế hoạch và thực tế (Should)

- Actor: Quản lý dự án
- Channel: Web
- Requirement: Hệ thống nên hiển thị planned vs actual start/end để nhận biết bắt đầu muộn, kéo dài hoặc hoàn thành trễ.
- Truy vết BRD: SCH-05 | Use Case: UC-09
- Sai lệch truy về WO và lịch sử; không tự sửa kế hoạch từ dữ liệu thực tế.

### SCH-SRS-007 — Reschedule / Return Visit (Should)

- Actor: Điều phối viên
- Channel: Web
- Requirement: Khi WO chưa hoàn thành và cần tiếp tục ở thời điểm khác, điều phối viên nên cập nhật lịch tiếp theo và lý do mà không mất tiến độ đã ghi.
- Truy vết BRD: SCH-05 | Use Case: UC-05, UC-06
- Lưu lịch trước/sau, lý do và thông báo; không tạo Work Order mới chỉ để biểu diễn lần quay lại.

## QUA

### QUA-SRS-001 — Tạo mẫu checklist (Must)

- Actor: Quản trị viên/QC
- Channel: Web
- Requirement: Người có quyền phải tạo mẫu checklist gồm nhóm tiêu chí, loại câu trả lời, hướng dẫn và cờ bắt buộc/blocking.
- Truy vết BRD: QUA-01 | Quy tắc: BR-13 | Use Case: UC-02, UC-07
- Mẫu có Nháp/Hoạt động/Ngừng hoạt động; mẫu đã dùng không bị sửa làm thay đổi lịch sử.

### QUA-SRS-002 — Gán checklist và lưu phiên bản áp dụng (Must)

- Actor: QC/Điều phối viên
- Channel: Web
- Requirement: Hệ thống phải gán checklist theo work type/dự án/giai đoạn và lưu phiên bản áp dụng cho Work Order.
- Truy vết BRD: QUA-02 | Quy tắc: BR-13 | Use Case: UC-03, UC-07
- WO biết checklist pre-start và final khi áp dụng; thay đổi mẫu chỉ tác động theo version rule.

### QUA-SRS-003 — Thực hiện checklist trước bắt đầu (Must)

- Actor: Worker/Crew Lead
- Channel: Mobile
- Requirement: Người chịu trách nhiệm phải hoàn thành checklist chuẩn bị/an toàn được yêu cầu trước khi Start. Mục blocking chưa đạt sẽ chặn Start mà không có cơ chế override trong V1 (Q-08 / CR-001).
- Truy vết BRD: QUA-03 | Quy tắc: BR-13 | Use Case: UC-05
- Lưu câu trả lời, actor, thời điểm và ảnh khi cấu hình.

### QUA-SRS-004 — Khai báo Inspection Checkpoint (Must)

- Actor: QC/Điều phối viên
- Channel: Web
- Requirement: Người có quyền phải khai báo checkpoint theo Work Order/work type với loại PRE_ACTIVITY, HOLD_POINT hoặc FINAL và vị trí/giai đoạn áp dụng.
- Truy vết BRD: QUA-04 | Quy tắc: BR-14 | Use Case: UC-03, UC-07
- Checkpoint xác định người/role kiểm tra, blocking rule, tiêu chí và trạng thái; thay đổi sau khi đã phát sinh phải audit.

### QUA-SRS-005 — Xem Inspection Queue (Must)

- Actor: QC
- Channel: Web/Mobile
- Requirement: QC phải xem hàng đợi inspection trong phạm vi quyền gồm pre-activity, hold point, final inspection và re-inspection.
- Truy vết BRD: QUA-04 | Use Case: UC-07
- Danh sách có dự án, khu vực, WO, loại checkpoint, người thực hiện, thời điểm yêu cầu và trạng thái.

### QUA-SRS-006 — Thực hiện Pre-activity Inspection (Must)

- Actor: QC
- Channel: Web/Mobile
- Requirement: Khi Work Order yêu cầu pre-activity inspection, QC phải ghi kết quả trước khi công việc được Start theo rule.
- Truy vết BRD: QUA-04 | Quy tắc: BR-09, BR-14 | Use Case: UC-05, UC-07
- Nếu checkpoint blocking chưa pass/release thì readiness không thể thành READY; mọi kết quả lưu actor/thời điểm/bằng chứng.

### QUA-SRS-007 — Xử lý Hold Point (Must)

- Actor: QC
- Channel: Web/Mobile
- Requirement: Khi Work Order đạt Hold Point, hệ thống phải ngăn bước thi công bị kiểm soát cho đến khi duy nhất QC có thẩm quyền kiểm tra và release. Project Manager, Coordinator, Worker, hoặc Crew Lead không được quyền release Hold Point (Q-10 / CR-001).
- Truy vết BRD: QUA-05 | Quy tắc: BR-14 | Use Case: UC-07
- Release chỉ khi tiêu chí bắt buộc đạt; fail giữ checkpoint chưa release và có thể tạo rectification; mọi lần release/fail được audit.

### QUA-SRS-008 — Thực hiện Final Inspection (Must)

- Actor: QC
- Channel: Web/Mobile
- Requirement: Sau khi Work Order ở WORK_DONE và yêu cầu final inspection, QC phải đánh giá các tiêu chí trước khi quality gate cho phép Closed.
- Truy vết BRD: QUA-06 | Quy tắc: BR-15, BR-16 | Use Case: UC-07
- Không final-pass khi còn tiêu chí blocking hoặc rectification chưa verified.

### QUA-SRS-009 — Ghi kết quả và bằng chứng Inspection (Must)

- Actor: QC
- Channel: Web/Mobile
- Requirement: QC phải ghi kết quả Pass/Fail, nhận xét và ảnh/tệp cho từng lần inspection/checkpoint.
- Truy vết BRD: QUA-06 | Use Case: UC-07
- Mọi mục bắt buộc có kết quả trước submit; bằng chứng gắn WO, checkpoint/lần kiểm tra, actor và thời điểm; vòng trước không bị ghi đè.

### QUA-SRS-010 — Tạo Rectification Item (Must)

- Actor: QC
- Channel: Web/Mobile
- Requirement: Khi inspection không đạt, QC phải tạo hạng mục khắc phục với mô tả lỗi, mức độ, người/Crew chịu trách nhiệm, hạn và bằng chứng khi cần.
- Truy vết BRD: QUA-07 | Quy tắc: BR-16 | Use Case: UC-07
- Ít nhất một rectification khi kết luận Fail; item có lifecycle riêng; Work Order chưa được Closed.

### QUA-SRS-011 — Nộp kết quả khắc phục (Must)

- Actor: Worker/Crew Lead/Crew Member được quyền
- Channel: Mobile
- Requirement: Người được giao phải xem lỗi, cập nhật nội dung đã sửa và nộp bằng chứng khắc phục (non-Lead Crew Member được quyền cập nhật/nộp bằng chứng rectification được giao - Q-05 / CR-001).
- Truy vết BRD: QUA-07 | Use Case: UC-07
- Chỉ người/Crew liên quan cập nhật; nộp chuyển item sang chờ reinspection; Crew Lead chịu trách nhiệm submit ở cấp item nếu cấu hình yêu cầu.

### QUA-SRS-012 — Tái kiểm tra (Must)

- Actor: QC
- Channel: Web/Mobile
- Requirement: QC phải kiểm tra lại từng rectification đã nộp và xác nhận Verified hoặc Rejected.
- Truy vết BRD: QUA-08 | Use Case: UC-07
- Mỗi vòng có thời điểm, QC, kết quả và bằng chứng riêng; Rejected quay lại cần khắc phục, không ghi đè vòng trước.

### QUA-SRS-013 — Quality Gate để đóng Work Order (Must)

- Actor: Hệ thống
- Channel: System
- Requirement: Hệ thống chỉ cho Work Order chuyển CLOSED khi checklist/checkpoint bắt buộc, final inspection khi yêu cầu và mọi rectification liên quan đều đạt/verified.
- Truy vết BRD: QUA-08 | Quy tắc: BR-15, BR-16 | Use Case: UC-07
- Work Done không tự đóng; thao tác đóng gửi lặp không tạo hai lần transition; ngoại lệ phải có quyền, lý do và audit.

### QUA-SRS-014 — Witness Point (Should)

- Actor: QC/Điều phối viên
- Channel: Web/Mobile
- Requirement: Hệ thống nên hỗ trợ checkpoint Witness Point để ghi việc đã thông báo bên cần chứng kiến, attendance và kết quả theo rule dự án mà không mặc định chặn công việc (Witness Point thuộc Should backlog, không nằm trong baseline cam kết bảo vệ - Q-11 / CR-001).
- Truy vết BRD: QUA-09 | Use Case: UC-07
- Nếu bên chứng kiến không tham dự, khả năng tiếp tục theo chính sách được cấu hình/ghi nhận; baseline không xây portal riêng cho external party.

### QUA-SRS-015 — Conditional Pass (Should)

- Actor: QC
- Channel: Web/Mobile
- Requirement: QC nên có thể kết luận Conditional Pass khi phần thi công cơ bản chấp nhận nhưng còn rectification nhỏ cần đóng (Conditional Pass thuộc Should backlog, không nằm trong baseline cam kết bảo vệ - Q-11 / CR-001).
- Truy vết BRD: QUA-10 | Quy tắc: BR-16 | Use Case: UC-07
- Conditional Pass phải có ít nhất một rectification item; Work Order vẫn chưa CLOSED cho đến khi item được verified.

## RPT

### RPT-SRS-001 — Tạo thông báo nghiệp vụ (Must)

- Actor: Hệ thống
- Channel: System
- Requirement: Hệ thống phải tạo in-app notification cho các sự kiện chính: assignment/self-accept, đổi lịch/thu hồi, blocker, material supplement, inspection/hold point, rectification, reinspection và overdue.
- Truy vết BRD: RPT-01 | Quy tắc: BR-20 | Use Case: UC-09
- Thông báo đúng người, không tạo trùng khi retry và chứa đối tượng nguồn.

### RPT-SRS-002 — Hộp thông báo (Must)

- Actor: Người dùng
- Channel: Web/Mobile
- Requirement: Người dùng phải xem thông báo, số chưa đọc và đánh dấu đã đọc/đã đọc tất cả.
- Truy vết BRD: RPT-01 | Quy tắc: BR-20 | Use Case: UC-09
- Trạng thái đọc đồng bộ; thao tác inbox không thay đổi đối tượng nghiệp vụ nguồn.

### RPT-SRS-003 — Mở đúng ngữ cảnh từ thông báo (Must)

- Actor: Người dùng
- Channel: Web/Mobile
- Requirement: Khi chọn thông báo, hệ thống phải mở đúng Work Order, blocker, inspection, rectification hoặc material supplement liên quan.
- Truy vết BRD: RPT-01 | Quy tắc: BR-19, BR-20 | Use Case: UC-09
- Kiểm tra lại quyền/trạng thái; không còn quyền thì không lộ dữ liệu.

### RPT-SRS-004 — Dashboard điều hành (Must)

- Actor: Quản lý/Điều phối viên
- Channel: Web
- Requirement: Web phải hiển thị chỉ số về unassigned, in-progress, overdue, blocked, work-done-waiting-QC, rectification-open, workload cơ bản và tiến độ dự án. Chỉ số tiến độ dự án chính thức (Official Project Progress) bắt buộc tính theo tỷ lệ Work Order đã CLOSED: `Progress % = Closed Work Orders / Total applicable Work Orders × 100`. Work Done không được tính là hoàn thành chính thức (Q-12 / CR-001).
- Truy vết BRD: RPT-02 | Use Case: UC-09
- Mỗi chỉ số có định nghĩa, thời điểm cập nhật và tôn trọng phạm vi dự án/quyền.

### RPT-SRS-005 — KPI nguyên nhân chậm và chất lượng (Must)

- Actor: Quản lý/QC
- Channel: Web
- Requirement: Hệ thống phải tổng hợp blocker theo reason/duration và chỉ số chất lượng cơ bản như pass/fail, rectification đang mở hoặc quá hạn.
- Truy vết BRD: RPT-03 | Quy tắc: BR-11 | Use Case: UC-09
- Chỉ số drill-down được tới dữ liệu nguồn; blocker không tự quy trách nhiệm cho Worker nếu responsible party khác.

### RPT-SRS-006 — Drill-down chỉ số (Must)

- Actor: Người dùng Dashboard
- Channel: Web
- Requirement: Người dùng phải mở danh sách bản ghi tạo nên chỉ số dashboard với cùng bộ lọc và quyền.
- Truy vết BRD: RPT-03 | Use Case: UC-09
- Tổng chi tiết đối chiếu được với KPI; bản ghi ngoài quyền không xuất hiện.

### RPT-SRS-007 — Xuất dữ liệu cơ bản (Should)

- Actor: Người có quyền
- Channel: Web
- Requirement: Người dùng nên xuất danh sách/report được phê duyệt sang định dạng CSV (V1 chỉ hỗ trợ CSV; XLSX không thuộc committed scope V1 - Q-13 / CR-001).
- Truy vết BRD: RPT-05 | Use Case: UC-09
- Dữ liệu xuất dùng cùng bộ lọc/quyền và giới hạn số dòng; không có report designer tùy biến.

### RPT-SRS-008 — Ghi và tra cứu Audit Trail (Must)

- Actor: Hệ thống/Quản trị viên/Quản lý
- Channel: System/Web
- Requirement: Hệ thống phải ghi và cho người có quyền tra cứu thay đổi về tài khoản/quyền, assignment, lịch, readiness, blocker, material, trạng thái và quality decision. Hồ sơ audit nghiệp vụ và tệp bằng chứng đính kèm được lưu giữ tối thiểu 5 năm sau khi dự án Đóng (5 years after Project Closed) theo chính sách cấu hình được (Q-15 / CR-001).
- Truy vết BRD: RPT-04 | Quy tắc: BR-18 | Use Case: UC-09
- Bản ghi gồm actor, thời điểm, hành động, đối tượng, before/after khi cần và lý do; chỉ đọc, lọc được, không chứa bí mật xác thực.
