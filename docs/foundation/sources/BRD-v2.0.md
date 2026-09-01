---
document: "BRD-CWM-QC-002 V2.0"
source_file: "BRD_V2_0_Quan_ly_cong_viec_thi_cong_VINACON.docx"
source_id: "1rjkfOb9HttaVb3AmrVY-YyUuFCZpfaAO"
source_modified_at: "2026-08-24T02:42:36.000Z"
source_url: "https://docs.google.com/document/d/1rjkfOb9HttaVb3AmrVY-YyUuFCZpfaAO/edit?usp=drive_link&ouid=105640796210463149381&rtpof=true&sd=true"
extraction: "Google Drive readable-text extraction; content preserved, visual table formatting may be flattened"
---

> Bản nguồn chỉ đọc. Khi cần kiểm tra bố cục bảng hoặc chữ ký tài liệu, mở bản gốc trên Google Drive. Không sửa file này để thay đổi yêu cầu.

TÀI LIỆU YÊU CẦU KINH DOANH
BUSINESS REQUIREMENTS DOCUMENT (BRD)
HỆ THỐNG QUẢN LÝ CÔNG VIỆC THI CÔNG
VÀ KIỂM SOÁT CHẤT LƯỢNG TẠI CÔNG TRƯỜNG
CHO CÔNG TY VINACON
Trên nền tảng Web và Mobile
Tài liệu mô tả bài toán, mục tiêu, phạm vi và yêu cầu kinh doanh trước khi thiết kế chi tiết.
0. Kiểm soát tài liệu
0.1. Trạng thái phê duyệt
0.2. Lịch sử phiên bản
0.3. Quy ước ưu tiên
0.4. Mục lục nội dung
1. Tóm tắt điều hành
2. Bối cảnh và bài toán kinh doanh
3. Tầm nhìn, mục tiêu và chỉ số thành công
4. Bên liên quan và nhóm người dùng
5. Phạm vi sản phẩm
6. Bản đồ năng lực kinh doanh
7. Quy trình nghiệp vụ tổng thể
8. Quy tắc nghiệp vụ trọng yếu
9. Yêu cầu kinh doanh chi tiết
10. Vòng đời trạng thái nghiệp vụ
11. Nhu cầu dữ liệu và báo cáo
12. Kỳ vọng chất lượng sản phẩm
13. Giả định, ràng buộc và phụ thuộc
14. Rủi ro và phương án kiểm soát
15. Phân kỳ phạm vi và ưu tiên triển khai
16. Tiêu chí nghiệm thu kinh doanh
17. Các quyết định cần xác nhận
Phụ lục A. Thuật ngữ
Phụ lục B. Ma trận truy vết mục tiêu - năng lực
1. Tóm tắt điều hành
Hệ thống được định hướng là nền tảng tập trung để VINACON quản lý Work Order thi công từ planning, điều phối nguồn lực, kiểm tra điều kiện sẵn sàng, tác nghiệp hiện trường, xử lý vướng mắc đến kiểm soát chất lượng và đóng công việc. Kênh Web phục vụ quản lý/điều phối/QC; kênh Mobile phục vụ Worker, Crew Lead và QC tại hiện trường.
Sản phẩm ưu tiên luồng nghiệp vụ xuyên suốt thay vì mở rộng thành hệ thống quản trị xây dựng tổng thể. Vật tư chỉ được quản lý ở mức trực tiếp phục vụ Work Order; blocker và readiness được theo dõi để giải thích vì sao công việc chưa thể bắt đầu hoặc tiếp tục; chất lượng được kiểm soát bằng checklist, inspection checkpoint, Hold Point, rectification và re-inspection.
1.1. Giá trị kỳ vọng
Rút ngắn thời gian từ khi Work Order sẵn sàng đến khi có Worker/Crew chịu trách nhiệm.
Làm rõ trách nhiệm giữa Worker, Crew, Crew Lead, Điều phối viên và QC trong toàn bộ lifecycle.
Phát hiện sớm công việc chưa sẵn sàng do dependency, mặt bằng, vật tư, thông tin, nguồn lực hoặc điều kiện khác.
Ghi nhận và theo dõi blocker theo nguyên nhân, thời gian ảnh hưởng và tình trạng xử lý để hỗ trợ điều hành và KPI công bằng hơn.
Chuẩn hóa bằng chứng hiện trường, inspection, khắc phục và tái kiểm tra trước khi đóng Work Order.
Tạo dữ liệu điều hành có thể drill-down và audit thay vì tổng hợp thủ công từ nhiều nguồn.
1.2. Luồng giá trị phiên bản đầu
2. Bối cảnh và bài toán kinh doanh
2.1. Bối cảnh vận hành
Hoạt động thi công có nhiều hạng mục, đội thi công, kỹ năng, lịch, điều kiện chuẩn bị và điểm kiểm tra chất lượng. Một Work Order có thể đã được phân công nhưng vẫn chưa thể bắt đầu vì công việc tiền nhiệm chưa xong, mặt bằng chưa sẵn sàng, vật tư chưa đủ hoặc đang chờ một điểm kiểm tra bắt buộc. Khi các thông tin này nằm ở nhiều kênh, quản lý khó xác định trạng thái thật và nguyên nhân chậm.
Đề tài vì vậy tập trung không chỉ vào “giao việc” mà còn vào make-ready, constraint handling và quality close. Hệ thống phải giúp người dùng biết việc nào đang sẵn sàng, việc nào bị vướng, ai đang chịu trách nhiệm xử lý và điều kiện nào còn thiếu trước khi Work Order được đóng.
2.2. Các vấn đề cần giải quyết
3. Tầm nhìn, mục tiêu và chỉ số thành công
3.1. Tầm nhìn sản phẩm
Xây dựng một nền tảng điều hành công việc thi công thống nhất, giúp VINACON đưa đúng công việc đến đúng Worker/Crew, xác định rõ mức độ sẵn sàng và vướng mắc, đồng thời bảo đảm công việc chỉ được đóng sau khi các yêu cầu chất lượng bắt buộc được đáp ứng.
3.2. Mục tiêu kinh doanh
Giá trị mục tiêu định lượng được chốt sau khi đại diện khách hàng cung cấp số liệu nền hoặc thống nhất bộ dữ liệu demo dùng cho nghiệm thu.
4. Bên liên quan và nhóm người dùng
4.1. Persona cấp cao
5. Phạm vi sản phẩm
5.1. Trong phạm vi
Tài khoản, hồ sơ cơ bản, trạng thái người dùng và phân quyền theo vai trò/phạm vi dự án.
Worker, nhà thầu ở mức hồ sơ, Crew, Crew Lead, thành viên Crew, trade/skill và trạng thái nguồn lực.
Project, khu vực/hạng mục, Work Type, thành viên dự án, dependency và tệp tham chiếu cơ bản.
Work Order lifecycle; Direct Assignment cho Worker/Crew; Job Board và self-accept với one-winner concurrency.
Lịch, Today Jobs/My Jobs, xung đột lịch cơ bản và theo dõi tiến độ.
Pre-start readiness với ba kết quả: Ready, Ready With Constraint, Not Ready; Start gate theo rule.
Blocker/constraint trước hoặc trong thi công, reason/responsible party, thời gian ảnh hưởng và trạng thái xử lý.
Vật tư trực tiếp phục vụ Work Order: planned material, material readiness, shortage và supplement request đơn giản.
Checklist; Pre-activity Inspection; Hold Point; Final Inspection; rectification; re-inspection; quality gate để Closed.
Thông báo trong ứng dụng, dashboard/drill-down, KPI blocker/chất lượng và audit trail.
Web cho quản trị/điều phối/giám sát/QC và Mobile cho Worker/Crew Lead/QC tại hiện trường.
5.2. Ngoài phạm vi
Multi-tenant hoặc quản trị nhiều doanh nghiệp độc lập trong cùng phiên bản.
Kho/tồn kho, nhập-xuất, barcode, định mức kho, giá, nhà cung cấp, purchase order, VPO, purchasing, invoice, payment, payroll và kế toán.
Formal NCR/CAPA/root-cause management ở mức hệ thống chất lượng doanh nghiệp.
RFI/Submittal đầy đủ, quản lý hồ sơ thiết kế phức tạp, BIM/CAD và versioning bản vẽ chuyên sâu.
Full HSE/incident management, GPS tracking liên tục, geofence, route optimization và chấm công tính lương.
Chat thời gian thực, email/SMS automation, client portal, chữ ký số hoặc cổng truyền thông đa kênh.
Offline synchronization đầy đủ và tự động tối ưu nguồn lực/lịch bằng thuật toán nâng cao.
5.3. Ranh giới sản phẩm
Sản phẩm tổ chức quy trình, cung cấp dữ liệu và quality gate cho người có thẩm quyền; không thay thế quyết định chuyên môn của Project Manager hoặc QC. Các ngoại lệ như override dependency/readiness, ghi đè conflict hoặc release checkpoint phải được giới hạn quyền, lưu lý do và audit khi được cho phép.
6. Bản đồ năng lực kinh doanh
7. Quy trình nghiệp vụ tổng thể
WF-01 - Thiết lập dự án và nguồn lực
Quản trị viên quản lý tài khoản, Worker, nhà thầu, trade/skill, Crew, Crew Lead và thành viên Crew.
Quản lý dự án tạo Project, Area/Category và thành viên dự án.
Điều phối viên/QC cấu hình Work Type, checklist, inspection checkpoint và dữ liệu nền cần thiết.
WF-02 - Lập kế hoạch và phát hành Work Order
Điều phối viên tạo Work Order với dự án/khu vực, Work Type, ưu tiên, lịch dự kiến và kỹ năng yêu cầu.
Khai báo dependency, checklist/checkpoint và planned material khi áp dụng.
Hệ thống chỉ cho Work Order chuyển sang trạng thái sẵn sàng phát hành khi dữ liệu bắt buộc hợp lệ.
WF-03 - Direct Assignment hoặc Self-Accept
Điều phối viên có thể assign trực tiếp cho Worker hoặc Crew; Crew phải có Crew Lead active.
Hoặc điều phối viên mở Work Order còn trống lên Job Board để Worker phù hợp tự nhận.
Hệ thống kiểm tra eligibility và bảo đảm chỉ một self-accept thành công khi nhiều Worker thao tác đồng thời.
Sau assignment, Work Order xuất hiện trong My Jobs/Today Jobs và lịch liên quan.
WF-04 - Pre-start Readiness và Blocker
Assigned Worker hoặc Crew Lead xem dependency, checklist/checkpoint, planned material và hướng dẫn trước Start.
Người thực hiện ghi nhận Ready, Ready With Constraint hoặc Not Ready.
Not Ready không được Start; Ready With Constraint chỉ được Start khi constraint không blocking.
Blocker được ghi nhận với reason, responsible party, thời điểm mở, tình trạng xử lý và thời điểm resolved.
WF-05 - Thi công và vật tư phục vụ Work Order
Worker/Crew thực hiện công việc, cập nhật tiến độ, nhật ký và bằng chứng theo quyền.
Blocker có thể phát sinh trong quá trình thi công mà không làm mất execution state hiện tại.
Nếu thiếu vật tư, người thực hiện ghi shortage/supplement request; thiếu vật tư không tự động đồng nghĩa Work Order bị block.
Khi phần thi công hoàn tất, assigned Worker hoặc Crew Lead gửi Work Done.
WF-06 - Inspection, khắc phục và đóng Work Order
QC thực hiện Pre-activity, Hold Point, Final Inspection hoặc re-inspection theo checkpoint áp dụng.
Tại Hold Point, bước thi công bị kiểm soát không được tiếp tục trước khi được QC có quyền release.
Khi inspection không đạt, QC tạo rectification item; người thực hiện sửa và nộp bằng chứng.
QC re-inspect; Work Order chỉ Closed khi mọi quality gate bắt buộc đạt/verified.
WF-07 - Điều hành, thông báo và truy vết
Hệ thống phát thông báo theo các sự kiện quan trọng như assignment, blocker, lịch, inspection, rectification và supplement request.
Quản lý theo dõi dashboard/KPI và drill-down về Work Order/blocker/inspection nguồn.
Các thay đổi quan trọng được lưu audit trail để giải thích trạng thái, trách nhiệm và số liệu.
8. Quy tắc nghiệp vụ trọng yếu
9. Yêu cầu kinh doanh chi tiết
Các yêu cầu dưới đây mô tả kết quả kinh doanh và ranh giới nghiệp vụ. Chi tiết màn hình, API, schema và cách cài đặt được xác định trong SRS/thiết kế sau khi BRD được xác nhận.
9.1. C1 - Tài khoản và phân quyền
9.2. C2 - Tổ chức và nguồn lực
9.3. C3 - Dự án và dữ liệu nền
9.4. C4 - Work Order, điều phối và thực hiện
9.5. C5 - Lịch và tiến độ
9.6. C6 - Checklist và kiểm soát chất lượng
9.7. C7 - Thông báo, báo cáo và truy vết
10. Vòng đời trạng thái nghiệp vụ
Các state model dưới đây là ngôn ngữ nghiệp vụ để thống nhất cách hiểu. Execution state, readiness, blocker và quality được tách riêng để không mất ngữ cảnh thực tế.
11. Nhu cầu dữ liệu và báo cáo
11.1. Nhóm dữ liệu kinh doanh chính
11.2. Báo cáo và chỉ số bắt buộc
11.3. Nguyên tắc chất lượng dữ liệu
Mỗi bản ghi nghiệp vụ quan trọng có định danh, actor/time và trạng thái hiện hành khi áp dụng.
Assignment, Crew Lead/membership, readiness, blocker và quality result phải bảo toàn lịch sử đủ để giải thích trách nhiệm tại thời điểm phát sinh.
Blocker duration tính từ opened tới resolved theo cùng quy ước thời gian; dashboard và drill-down dùng cùng định nghĩa.
Ảnh/tệp phải gắn đúng Project/Work Order/checkpoint/rectification và đúng người tải.
Dữ liệu đã phát sinh giao dịch ưu tiên inactive/soft delete thay vì hard delete.
12. Kỳ vọng chất lượng sản phẩm
13. Giả định, ràng buộc và phụ thuộc
13.1. Ràng buộc phạm vi đồ án
Ưu tiên workflow xuyên suốt và business rule hơn số lượng màn hình/tích hợp.
44 yêu cầu Must phải có dữ liệu demo, kiểm thử và khả năng trình diễn độc lập.
10 yêu cầu Should chỉ được triển khai sau khi Plan → Dispatch → Make Ready → Execute → Inspect → Rectify → Close chạy ổn định.
Mọi đề xuất thêm inventory/procurement, full NCR, RFI/Submittal, HSE, GPS, chat hoặc tích hợp doanh nghiệp được xem là change request.
14. Rủi ro và phương án kiểm soát
15. Phân kỳ phạm vi và ưu tiên triển khai
15.1. Phạm vi bắt buộc - Must
44 yêu cầu Must tạo thành phiên bản có thể nghiệm thu. Thứ tự ưu tiên theo giá trị nghiệp vụ:
15.2. Phạm vi mở rộng - Should
Đổi/đặt lại mật khẩu.
Mẫu Work Order và tệp tham chiếu cơ bản.
Worker/Crew Lead Accept/Reject direct assignment nếu chính sách yêu cầu.
Hủy/bỏ assignment có kiểm soát bởi người thực hiện.
Pause/Resume thủ công có lý do.
Cảnh báo quá tải và override conflict có kiểm soát.
So sánh kế hoạch - thực tế, reschedule/return visit.
Witness Point.
Conditional Pass.
Xuất dữ liệu cơ bản.
16. Tiêu chí nghiệm thu kinh doanh
16.1. Kịch bản demo nghiệp vụ tối thiểu
1. Admin chuẩn bị user, Worker, Crew/Crew Lead, trade/skill, Work Type và checklist/checkpoint.
2. Project Manager tạo Project; Coordinator tạo Work Order A và B, trong đó B có dependency.
3. Work Order A được direct assign cho một Crew; Crew Lead thấy việc trong Today Jobs.
4. Work Order B được mở Job Board; Worker đủ điều kiện self-accept; worker khác thử nhận và thất bại vì việc không còn trống.
5. Crew Lead thực hiện readiness cho Work Order A; phát hiện thiếu vật tư nhưng xác định vẫn có thể thi công một phần và tạo supplement request.
6. Trong thi công phát sinh blocker; Coordinator xử lý và resolve; thời gian ảnh hưởng được giữ.
7. Tại Hold Point, hệ thống không cho tiếp tục trước khi QC kiểm tra/release.
8. Crew cập nhật tiến độ/bằng chứng; Crew Lead Submit Work Done.
9. QC Final Inspection không đạt, tạo rectification; Crew sửa và nộp bằng chứng; QC re-inspect đạt.
10. Work Order Closed; quản lý xem dashboard, blocker duration, quality KPI và audit timeline.
17. Các quyết định cần xác nhận
Phụ lục A. Thuật ngữ
Phụ lục B. Ma trận truy vết mục tiêu - năng lực
— HẾT TÀI LIỆU —
Định hướng nghiệp vụ cốt lõi
Work Order là trung tâm. Hệ thống hỗ trợ điều phối kết hợp: điều phối viên có thể phân công trực tiếp cho Worker/Crew, đồng thời Worker đủ điều kiện có thể tự nhận việc còn trống trên Job Board. Trước khi thi công, người thực hiện đánh giá mức độ sẵn sàng; trong quá trình thực hiện, blocker, vật tư và quality checkpoint được theo dõi độc lập để bảo đảm Work Order chỉ được đóng khi đáp ứng quality gate.
Thuộc tính
Nội dung
Mã tài liệu
BRD-CWM-QC-002
Phiên bản
2.0 - Dự thảo yêu cầu kinh doanh đã re-baseline
Trạng thái
Chờ đại diện khách hàng và nhóm thực hiện xác nhận
Ngày cập nhật
24/08/2026
Phạm vi phát hành
Phiên bản sản phẩm trong phạm vi đồ án
Góc nhìn
Nhà tài trợ / Khách hàng / Quản lý vận hành
Tài liệu liên quan
Đề cương cập nhật; SRS-CWM-QC-002 V2.0
Thuộc tính
Nội dung
Tên tài liệu
Tài liệu yêu cầu kinh doanh - Hệ thống Quản lý Công việc Thi công và Kiểm soát Chất lượng tại công trường cho VINACON
Mục đích
Thống nhất bài toán kinh doanh, mục tiêu, phạm vi, năng lực, workflow, business rule, mức ưu tiên và tiêu chí thành công của phiên bản đồ án.
Đối tượng đọc
Nhà tài trợ/đại diện khách hàng, quản lý dự án, điều phối viên, QC, đại diện hiện trường, Business Analyst, nhóm phát triển và kiểm thử.
Phạm vi tài liệu
Yêu cầu kinh doanh và kết quả mong đợi; không quy định kiến trúc, API, schema cơ sở dữ liệu, framework hoặc bố cục giao diện chi tiết.
Baseline
54 yêu cầu kinh doanh: 44 Must và 10 Should. Must là phạm vi cam kết; Should chỉ triển khai khi workflow cốt lõi đã ổn định.
Vai trò
Người xác nhận
Trạng thái
Ngày
Nhà tài trợ/Đại diện khách hàng
[Chưa chỉ định]
Chờ xác nhận
Đại diện quản lý vận hành
[Chưa chỉ định]
Chờ xác nhận
Đại diện kiểm soát chất lượng
[Chưa chỉ định]
Chờ xác nhận
Đại diện người sử dụng hiện trường
[Chưa chỉ định]
Chờ xác nhận
Business Analyst/Đại diện nhóm
[Chưa chỉ định]
Dự thảo
24/08/2026
Phiên bản
Ngày
Mô tả thay đổi
Trạng thái
1.0
01/08/2026
Baseline cũ: MAT độc lập theo yêu cầu-phê duyệt-cung ứng; Crew là Should; chưa có dependency, readiness, blocker và inspection checkpoint đầy đủ.
Đã thay thế
2.0
24/08/2026
Re-baseline theo đề cương và SRS V2: Crew/Crew Lead là core; thêm dependency, pre-start readiness, blocker, vật tư trong Work Order, Hold Point và tách Work Done với Closed.
Dự thảo xác nhận
Mức
Ý nghĩa
Must
Bắt buộc để workflow cốt lõi hoạt động, bảo đảm kiểm soát nghiệp vụ hoặc nghiệm thu phiên bản đầu.
Should
Có giá trị rõ ràng nhưng không chặn nghiệm thu nếu chưa triển khai; chỉ thực hiện sau khi Must ổn định.
Out of scope
Không thuộc phạm vi cam kết của đồ án; chỉ xem xét qua quy trình thay đổi phạm vi.
Nguyên tắc sử dụng
BRD mô tả Why/What ở góc nhìn kinh doanh. Các rule được nêu đủ để thống nhất trách nhiệm và ranh giới nghiệp vụ; chi tiết hành vi phần mềm, kênh Web/Mobile và tiêu chí kỹ thuật được đặc tả trong SRS V2.0.
Điểm nghiệp vụ cốt lõi
Plan → Dispatch → Make Ready → Execute → Manage Constraints → Inspect → Rectify → Close. Direct Assignment và Job Board Self-Accept cùng tồn tại; Work Done chỉ xác nhận phần thi công đã xong, còn Work Order chỉ Closed sau khi quality gate đạt.
Luồng giá trị chính
Thiết lập dự án/nguồn lực → tạo Work Order & dependency → direct assign hoặc Job Board → pre-start readiness → thi công & blocker/material → Work Done → inspection/Hold/rectification → quality gate → Closed → dashboard/audit.
Mã
Vấn đề
Tác động kinh doanh
PB-01
Thông tin công việc phân tán
Dự án, lịch, assignment, tiến độ, checklist, blocker và bằng chứng không nằm trong một chuỗi dữ liệu thống nhất.
PB-02
Điều phối chậm và thiếu linh hoạt
Công việc có thể bị bỏ trống hoặc phụ thuộc hoàn toàn vào điều phối viên dù có Worker phù hợp đang sẵn sàng.
PB-03
Trách nhiệm Crew chưa rõ
Khi công việc được thực hiện theo tổ/đội, khó xác định ai đại diện nhận trách nhiệm và xác nhận phần thi công đã hoàn thành.
PB-04
Công việc được giao nhưng chưa sẵn sàng
Dependency, mặt bằng, vật tư, thông tin hoặc checklist chưa đạt có thể làm Work Order không thể bắt đầu dù đã có người và lịch.
PB-05
Vướng mắc và thời gian chờ khó truy vết
Quản lý không có cấu trúc để biết công việc bị cản trở bởi nguyên nhân nào, từ khi nào, bên nào cần xử lý và đã giải quyết chưa.
PB-06
Kiểm soát chất lượng chưa theo mốc thi công
QC dễ bị tập trung vào cuối công việc; các điểm kiểm tra bắt buộc trong quá trình thi công chưa được quản lý thành quality gate.
PB-07
Vật tư chưa gắn chặt với khả năng thực hiện Work Order
Thiếu vật tư thường được xử lý rời khỏi Work Order, gây khó xác định thiếu gì, có cản trở thi công hay không và nhu cầu bổ sung đã được xử lý tới đâu.
PB-08
Thiếu dữ liệu điều hành và audit đáng tin cậy
Báo cáo trễ hạn, blocker, chất lượng và thay đổi trách nhiệm phụ thuộc tổng hợp thủ công hoặc thiếu lịch sử.
Mã
Mục tiêu
Chỉ số theo dõi đề xuất
OBJ-01
Tăng tốc độ lấp đầy công việc
Thời gian Work Order ở trạng thái khả dụng/chưa có assignee; tỷ lệ công việc còn trống quá hạn.
OBJ-02
Nâng hiệu quả điều phối và trách nhiệm nguồn lực
Tỷ lệ reassign; xung đột lịch; tỷ lệ Crew assignment có Crew Lead hợp lệ; thời gian xử lý assignment bị từ chối/thu hồi.
OBJ-03
Tăng tỷ lệ công việc sẵn sàng trước khi bắt đầu
Tỷ lệ READY/READY_WITH_CONSTRAINT/NOT_READY; số dependency chưa đạt; số lần Start bị chặn bởi readiness gate.
OBJ-04
Giảm thời gian chờ do blocker/constraint
Số blocker đang mở; blocked duration; thời gian từ lúc ghi nhận đến lúc resolved; phân bố theo reason/responsible party.
OBJ-05
Nâng chất lượng ngay lần đầu
First-pass quality; số rectification item; số vòng re-inspection; thời gian đóng lỗi; số Hold Point chờ release.
OBJ-06
Tăng tính minh bạch của vật tư phục vụ Work Order
Tỷ lệ Work Order có planned material khi áp dụng; số shortage/supplement request; thời gian xử lý nhu cầu bổ sung.
OBJ-07
Tăng mức độ sử dụng Mobile tại hiện trường
Tỷ lệ Worker/Crew Lead xem Today Jobs, thực hiện readiness, cập nhật tiến độ, bằng chứng và Work Done trên Mobile.
OBJ-08
Cung cấp thông tin điều hành và truy vết đáng tin cậy
Độ đầy đủ dashboard; khả năng drill-down; tỷ lệ hành động quan trọng có actor/time/source; số báo cáo thủ công được thay thế.
Bên liên quan/Người dùng
Trách nhiệm và giá trị nhận được
Nhà tài trợ/Đại diện khách hàng
Xác định mục tiêu, phạm vi, mức ưu tiên, tiêu chí thành công và phê duyệt thay đổi.
Quản trị viên
Quản lý tài khoản, vai trò, Worker, Crew, trade/skill và dữ liệu nền dùng chung.
Quản lý dự án
Theo dõi dự án, blocker, tiến độ, quality oversight, ngoại lệ và dashboard.
Điều phối viên
Tạo Work Order, dependency, lịch, Job Board, direct assignment, reassign/withdraw và phối hợp xử lý blocker.
Worker
Xem Job Board/My Jobs, self-accept khi đủ điều kiện, thực hiện checklist/readiness, tác nghiệp, bằng chứng và khắc phục.
Crew Lead/Tổ trưởng
Đại diện Crew trong readiness, blocker, execution và Submit Work Done; phối hợp cập nhật của thành viên Crew.
Crew Member
Thực hiện công việc và có thể cập nhật progress/log/evidence theo quyền; không được Submit Work Done thay Crew Lead.
Quality Inspector (QC)
Quản lý/ thực hiện inspection checkpoint, Hold Point, Final Inspection, rectification và re-inspection.
Persona
Nhu cầu trọng tâm
P-01 - Điều phối viên
Cần biết Work Order nào đủ điều kiện phát hành, ai phù hợp, lịch có xung đột không, blocker nào cần xử lý và việc nào cần reassign.
P-02 - Worker
Cần biết việc có thể nhận, việc hôm nay, điều kiện cần đạt trước Start, cách báo vướng mắc và cách chứng minh phần việc đã thực hiện.
P-03 - Crew Lead
Cần nhìn rõ Work Order của Crew, thành viên liên quan, readiness/blocker và quyền xác nhận Work Done thay mặt đội.
P-04 - Quản lý dự án
Cần biết dự án chậm ở đâu, nguyên nhân gì, blocker kéo dài bao lâu, chất lượng ra sao và ai đang chịu trách nhiệm.
P-05 - QC
Cần hàng đợi inspection theo mốc, checklist/tiêu chí rõ, bằng chứng, Hold Point, rectification và lịch sử re-inspection.
P-06 - Quản trị viên
Cần quản lý người dùng, quyền và dữ liệu nền đơn giản nhưng bảo toàn lịch sử và kiểm soát đúng phạm vi.
Mã
Năng lực
Số yêu cầu
Ưu tiên
Kết quả kinh doanh
C1
Tài khoản và phân quyền
5
Must 4; Should 1
Người dùng truy cập đúng chức năng và dữ liệu theo vai trò/dự án.
C2
Tổ chức và nguồn lực
5
Must 5
Worker/Crew/Crew Lead và năng lực được quản lý đủ để phục vụ điều phối.
C3
Dự án và dữ liệu nền
6
Must 5; Should 1
Thiết lập Project, Area, Work Type, member và dependency trước execution.
C4
Work Order, điều phối và thực hiện
18
Must 15; Should 3
Tạo, release, assign/self-accept, make-ready, blocker, material và Work Done.
C5
Lịch và tiến độ
5
Must 3; Should 2
Quản lý lịch, conflict và thay đổi kế hoạch/thực tế.
C6
Checklist và kiểm soát chất lượng
10
Must 8; Should 2
Inspection theo mốc, Hold Point, rectification, re-inspection và quality close.
C7
Thông báo, báo cáo và truy vết
5
Must 4; Should 1
Thông tin điều hành kịp thời, KPI có nguồn gốc và audit trail.
Tổng phạm vi
54 yêu cầu kinh doanh: 44 Must và 10 Should. Không còn capability MAT độc lập; vật tư được quản lý như một phần trực tiếp của Work Order execution.
Mã
Chủ đề
Quy tắc
BR-01
Điều phối kết hợp
Work Order có thể được phân công trực tiếp hoặc mở để Worker tự nhận; hai cơ chế dùng cùng nguyên tắc về trạng thái, năng lực và lịch.
BR-02
Self-accept có hiệu lực ngay
Worker đủ điều kiện nhận Work Order còn trống được xác nhận ngay, không chờ quản lý phê duyệt lần hai.
BR-03
Một assignment chính
Một Work Order chỉ có một assignment active tại một thời điểm; assignee là Worker hoặc Crew.
BR-04
Eligibility dùng chung
Nguồn lực phải active, đáp ứng skill, quyền dự án và lịch theo chính sách trước khi nhận/phân công.
BR-05
Một winner khi đồng thời
Nhiều self-accept cùng một Work Order chỉ tạo một assignment active; retry không tạo bản ghi nghiệp vụ trùng.
BR-06
Crew Lead có hiệu lực
Crew dùng cho assignment phải có một Crew Lead active; thay đổi Lead phải bảo toàn lịch sử hiệu lực.
BR-07
Quyền xác nhận phần thi công
Assignment cá nhân: assigned Worker Submit Work Done. Assignment Crew: Crew Lead Submit Work Done; Crew member khác không có quyền này.
BR-08
Dependency gate
Dependency bắt buộc chưa đạt làm Work Order chưa sẵn sàng bắt đầu, trừ ngoại lệ được cho phép, có quyền và audit.
BR-09
Readiness gate
Not Ready không được Start; Ready được Start; Ready With Constraint chỉ Start khi constraint không blocking.
BR-10
Blocker là đối tượng độc lập
Blocked/On Hold được biểu diễn bằng blocker/constraint độc lập, không thay thế toàn bộ execution state của Work Order.
BR-11
Truy vết thời gian ảnh hưởng
Blocker phải lưu nguyên nhân, thời gian mở/giải quyết, responsible party và duration để phân tích chậm/KPI.
BR-12
Vật tư phục vụ Work Order
Vật tư chỉ ở mức planned material, readiness và supplement request; thiếu vật tư không tự động block và không phát sinh procurement/inventory.
BR-13
Checklist blocking
Checklist item được cấu hình blocking phải đạt trước Start hoặc transition liên quan.
BR-14
Hold Point
Tại Hold Point, bước thi công bị kiểm soát không được tiếp tục trước khi QC có quyền kiểm tra và release.
BR-15
Work Done khác Closed
Submit Work Done chỉ xác nhận phần thi công đã xong; Work Order chỉ Closed sau quality gate.
BR-16
Quality gate
Work Order không Closed khi còn checkpoint bắt buộc, Final Inspection hoặc rectification bắt buộc chưa đạt/verified.
BR-17
Thu hồi/tái phân công có lịch sử
Reassign/withdraw/cancel assignment phải có lý do và bảo toàn assignee, thời điểm và actor trước đó.
BR-18
Không xóa lịch sử nghiệp vụ
Dữ liệu đã phát sinh giao dịch không được hard delete làm mất audit/bằng chứng; dùng trạng thái/ngừng hoạt động theo chính sách.
BR-19
Quyền theo vai trò và dự án
Người dùng chỉ xem/thao tác dữ liệu thuộc quyền và phạm vi dự án.
BR-20
Thông báo không đổi nghiệp vụ
Đọc/xóa thông báo không thay đổi trạng thái Work Order, blocker, inspection hoặc đối tượng nguồn.
BR-21
Thời gian nhất quán
Lịch, transition, audit và KPI phải sử dụng thời gian nhất quán và hiển thị rõ múi giờ áp dụng.
Mã / Ưu tiên
Tác nhân
Yêu cầu kinh doanh
Quy tắc, kết quả và ngoại lệ
IAM-01
Must
Tất cả người dùng
Đăng nhập và đăng xuất
Người dùng có thể đăng nhập trên kênh được cấp và đăng xuất an toàn.
Tài khoản khóa/ngừng hoạt động không truy cập; phiên và quyền phải phản ánh trạng thái tài khoản hiện hành.
IAM-02
Should
Tất cả người dùng
Đổi và đặt lại mật khẩu
Người dùng có thể đổi mật khẩu khi đăng nhập và yêu cầu đặt lại khi quên.
Cơ chế đặt lại có thời hạn, dùng một lần và không làm lộ việc tài khoản có tồn tại hay không.
IAM-03
Must
Người dùng
Quản lý hồ sơ cá nhân
Người dùng xem/cập nhật thông tin hồ sơ được phép như tên, điện thoại, ảnh đại diện và liên hệ.
Trường ảnh hưởng định danh hoặc quyền không được tự thay đổi ngoài chính sách.
IAM-04
Must
Quản trị viên
Quản lý tài khoản và trạng thái
Quản trị viên tạo, cập nhật, khóa, mở khóa và ngừng hoạt động tài khoản trong phạm vi doanh nghiệp.
Không xóa lịch sử nghiệp vụ; thay đổi trạng thái có actor/time.
IAM-05
Must
Quản trị viên/Hệ thống
Phân quyền theo vai trò và dự án
Hệ thống giới hạn chức năng và dữ liệu theo role và dự án người dùng được tham gia.
Người dùng không được truy cập dữ liệu ngoài quyền bằng cách thay đổi định danh/đường dẫn.
Mã / Ưu tiên
Tác nhân
Yêu cầu kinh doanh
Quy tắc, kết quả và ngoại lệ
ORG-01
Must
Quản trị viên
Quản lý Worker và nhà thầu
Duy trì hồ sơ Worker, liên hệ nhà thầu khi áp dụng và quan hệ nguồn lực phục vụ thi công.
Hồ sơ nhà thầu là thông tin tổ chức; Work Order baseline chỉ assign trực tiếp cho Worker hoặc Crew.
ORG-02
Must
Quản trị viên
Quản lý trade và skill
Quản lý danh mục ngành nghề/kỹ năng và gán năng lực cho Worker/Crew.
Dữ liệu đã dùng chỉ ngừng hoạt động; skill hết hiệu lực không dùng cho assignment mới.
ORG-03
Must
Quản trị viên/Điều phối viên
Quản lý Crew, Crew Lead và thành viên
Tạo Crew, chỉ định Crew Lead, quản lý danh sách thành viên và thời gian hiệu lực.
Crew dùng để assign phải có Lead active; thay đổi Lead/member không làm sai lịch sử Work Order đã thực hiện.
ORG-04
Must
Quản trị viên
Quản lý trạng thái nguồn lực
Kích hoạt/tạm ngừng/ngừng hoạt động Worker, Crew và nhà thầu.
Nguồn lực ngừng hoạt động không nhận assignment mới; cần cảnh báo công việc/lịch còn mở.
ORG-05
Must
Quản lý/Điều phối viên
Tra cứu nguồn lực và dữ liệu eligibility
Tìm/lọc nguồn lực theo trạng thái, trade/skill, Crew và phạm vi dự án để phục vụ direct assignment/self-accept.
Kết quả dùng dữ liệu hiện hành và tôn trọng quyền dự án.
Mã / Ưu tiên
Tác nhân
Yêu cầu kinh doanh
Quy tắc, kết quả và ngoại lệ
PRJ-01
Must
Quản lý dự án
Quản lý vòng đời Project
Tạo/cập nhật Project với mã, tên, địa điểm, thời gian, người phụ trách và trạng thái.
Project Closed không tạo Work Order mới; reopen cần quyền và lý do.
PRJ-02
Must
Quản lý dự án
Quản lý khu vực/hạng mục
Chia Project thành khu vực/hạng mục để liên kết Work Order và tổng hợp báo cáo.
Baseline dùng cấu trúc giới hạn, không xây cây phân cấp không giới hạn.
PRJ-03
Must
Quản trị viên/Điều phối viên
Quản lý Work Type
Quản lý loại công việc, yêu cầu kỹ năng và dữ liệu/chất lượng áp dụng theo loại.
Work Type ngừng hoạt động không dùng cho Work Order mới; dữ liệu lịch sử được giữ.
PRJ-04
Must
Quản lý dự án
Quản lý thành viên và quyền truy cập Project
Thêm/loại quản lý, điều phối, QC và người liên quan vào Project.
Người không thuộc Project chỉ truy cập nếu có role quản trị phù hợp.
PRJ-05
Must
Điều phối viên
Quản lý dependency giữa Work Order
Xác định Work Order tiền nhiệm/điều kiện công việc cần hoàn thành trước.
Dependency bắt buộc được dùng trong readiness gate; không cho quan hệ vòng lặp không hợp lệ.
PRJ-06
Should
Điều phối viên/Quản lý dự án
Mẫu Work Order và tệp tham chiếu cơ bản
Có thể dùng mẫu công việc và tệp/link tham chiếu khi lập Work Order.
Không bao gồm document management hoặc versioning phức tạp; sửa mẫu không thay Work Order đã tạo.
Mã / Ưu tiên
Tác nhân
Yêu cầu kinh doanh
Quy tắc, kết quả và ngoại lệ
JOB-01
Must
Điều phối viên
Tạo và cập nhật Work Order
Tạo Work Order gắn Project/Area/Work Type, mô tả, ưu tiên, thời hạn, skill và thông tin thực hiện.
Thiếu dữ liệu bắt buộc chỉ lưu Draft; thay đổi quan trọng lưu lịch sử.
JOB-02
Must
Điều phối viên/Hệ thống
Kiểm tra điều kiện phát hành
Work Order chỉ được direct assign hoặc mở Job Board khi Project, Work Type, lịch và dữ liệu bắt buộc hợp lệ.
Điều kiện chưa đạt phải được chỉ rõ; không tạo assignment một phần.
JOB-03
Must
Điều phối viên
Mở/đóng Job Board
Công bố Work Order còn trống cho self-accept trong khoảng thời gian cho phép và đóng khỏi danh sách khi cần.
Chỉ Work Order đủ điều kiện, chưa có assignment và chưa hủy mới được mở.
JOB-04
Must
Worker
Xem và tự nhận Work Order trên Job Board
Worker xem/lọc/đọc chi tiết công việc còn trống và chọn Nhận việc.
Self-accept có hiệu lực ngay khi eligibility đạt; không cần phê duyệt lần hai.
JOB-05
Must
Hệ thống
Eligibility và one-winner concurrency
Kiểm tra Worker active, skill, quyền Project, lịch, giới hạn việc và tình trạng Work Order trước khi self-accept.
Nhiều Worker nhận đồng thời chỉ một người thành công; retry không tạo assignment trùng.
JOB-06
Must
Điều phối viên
Direct Assignment cho Worker hoặc Crew
Giao Work Order trực tiếp cho Worker hoặc Crew phù hợp.
Direct Crew assignment yêu cầu Crew Lead active; cùng nguyên tắc eligibility/lịch với self-accept.
JOB-07
Must
Hệ thống/Người thực hiện
Xác định trách nhiệm Assignment
Assignment cá nhân xác định assigned Worker; assignment Crew xác định Crew và Crew Lead chịu trách nhiệm xác nhận ở cấp Work Order.
Chỉ assigned Worker hoặc Crew Lead được Submit Work Done; Crew member khác chỉ cập nhật theo quyền.
JOB-08
Must
Điều phối viên
Tái phân công và thu hồi
Thay/thu hồi assignee khi trạng thái cho phép.
Bắt buộc lý do; giữ assignee trước, actor/time và cập nhật thông báo/lịch.
JOB-09
Should
Worker/Crew Lead
Tiếp nhận hoặc từ chối direct assignment
Khi chính sách yêu cầu xác nhận, người nhận có thể Accept/Reject kèm lý do.
Từ chối đưa việc về điều phối; không áp dụng cho self-accept đã xác nhận ngay.
JOB-10
Should
Worker/Crew Lead/Điều phối viên
Hủy hoặc bỏ việc có kiểm soát
Có thể hủy/withdraw assignment theo điều kiện cho phép và nêu lý do.
Không cho hủy âm thầm khi đã bị khóa; lịch sử và thông báo được bảo toàn.
JOB-11
Must
Worker/Crew Lead
My Jobs và Today Jobs
Người thực hiện xem việc đã được giao/tự nhận, lịch và hành động tiếp theo.
Danh sách phản ánh reassign, hủy và thay đổi lịch; Crew Lead thấy Work Order của Crew được giao.
JOB-12
Must
Worker/Crew Lead
Pre-start Readiness
Trước Start, người thực hiện đánh giá dependency, checklist/checkpoint, vật tư và các điều kiện sẵn sàng cần thiết.
Kết quả Ready / Ready With Constraint / Not Ready; Not Ready chặn Start.
JOB-13
Must
Worker/Crew Lead/Quản lý
Ghi nhận và xử lý Blocker/Constraint
Ghi nhận vướng mắc cản trở bắt đầu/tiếp tục với reason, mô tả, bằng chứng, responsible party và trạng thái xử lý.
Blocker có timeline riêng, không thay thế execution state; lưu thời gian ảnh hưởng và resolution.
JOB-14
Must
Worker/Crew
Cập nhật quá trình thực hiện
Cập nhật progress, work log, note và ảnh/bằng chứng trong khi thi công.
Mỗi cập nhật truy được actor/time; Crew member chỉ thao tác theo quyền.
JOB-15
Should
Worker/Crew Lead
Tạm dừng và tiếp tục
Ghi nhận pause/resume khi chính sách áp dụng.
Pause phải có lý do; blocker nếu có vẫn theo dõi bằng object riêng.
JOB-16
Must
Điều phối viên/Quản lý/Worker/Crew Lead
Planned Material và Material Readiness
Khai báo vật tư dự kiến cho Work Order và cho phép hiện trường xác nhận mức độ sẵn sàng/thiếu trước hoặc trong khi làm.
Không quản lý tồn kho, giá hoặc nhà cung cấp; shortage không tự động block Work Order.
JOB-17
Must
Worker/Crew Lead/Quản lý
Yêu cầu bổ sung vật tư
Khi thiếu, ghi vật tư, số lượng cần bổ sung, ghi chú/bằng chứng và mức ảnh hưởng; quản lý theo dõi tình trạng xử lý.
Lifecycle đơn giản Requested → Acknowledged → In Progress → Fulfilled/Cancelled; không có procurement approval.
JOB-18
Must
Assigned Worker/Crew Lead
Submit Work Done
Người chịu trách nhiệm gửi xác nhận phần thi công đã hoàn thành để chuyển sang quality flow.
Work Done không đồng nghĩa Closed; hệ thống phải kiểm tra dữ liệu/checklist bắt buộc trước khi gửi.
Mã / Ưu tiên
Tác nhân
Yêu cầu kinh doanh
Quy tắc, kết quả và ngoại lệ
SCH-01
Must
Điều phối viên
Lập và cập nhật lịch Work Order
Xác định ngày/giờ, thời lượng dự kiến và hạn hoàn thành; cập nhật lịch khi cần.
Thay đổi sau assignment thông báo người liên quan và giữ lịch cũ.
SCH-02
Must
Các vai trò liên quan
Xem lịch theo phạm vi
Web hỗ trợ lịch tổng hợp ngày/tuần/tháng; Mobile ưu tiên Today/Upcoming.
Lịch phản ánh trạng thái/assignment hiện hành và quyền dự án.
SCH-03
Must
Hệ thống
Đối chiếu xung đột lịch
So sánh khoảng thời gian assignment của Worker/Crew trong direct assignment và self-accept.
Rule conflict dùng chung với eligibility; cách block/override theo quyết định phạm vi.
SCH-04
Should
Điều phối viên
Cảnh báo quá tải và ghi đè có kiểm soát
Cảnh báo lịch giao nhau hoặc vượt giới hạn; người có quyền có thể override nếu chính sách cho phép.
Override phải có quyền/lý do; không tự tối ưu nguồn lực.
SCH-05
Should
Quản lý/Điều phối viên
Kế hoạch - thực tế và reschedule/return visit
So sánh thời điểm dự kiến/thực tế và hỗ trợ cập nhật lịch tiếp theo khi Work Order chưa hoàn thành.
Không tự động sửa kế hoạch; giữ lý do thay đổi và lịch sử.
Mã / Ưu tiên
Tác nhân
Yêu cầu kinh doanh
Quy tắc, kết quả và ngoại lệ
QUA-01
Must
Quản trị viên/QC
Quản lý mẫu checklist
Tạo/cập nhật mẫu checklist, nhóm tiêu chí, loại trả lời, bắt buộc/tùy chọn và hướng dẫn.
Mẫu đã dùng phải giữ nội dung áp dụng cho Work Order cũ.
QUA-02
Must
QC/Điều phối viên
Áp dụng checklist theo Work Type/Work Order
Gán checklist theo loại công việc, Project hoặc giai đoạn và biết rõ phiên bản áp dụng.
Thay đổi template không ghi đè kết quả lịch sử.
QUA-03
Must
Worker/Crew Lead
Checklist trước Start
Hoàn thành các item chuẩn bị/an toàn/điều kiện trước khi bắt đầu.
Item blocking chưa đạt thì không Start/transition liên quan.
QUA-04
Must
QC/Điều phối viên
Quản lý Inspection Checkpoint
Khai báo mốc kiểm tra trước, trong hoặc sau thi công theo Work Type/Work Order.
Baseline hỗ trợ Pre-activity, Hold Point và Final Inspection; checkpoint giữ thứ tự/giai đoạn áp dụng.
QUA-05
Must
QC
Hold Point
Thực hiện kiểm tra và release Hold Point khi đạt.
Bước thi công bị kiểm soát không được tiếp tục trước release; mọi quyết định có actor/time/evidence khi áp dụng.
QUA-06
Must
QC
Final Inspection và kết quả kiểm tra
QC đánh giá tiêu chí, ghi nhận kết quả, nhận xét và bằng chứng cho Work Order/inspection.
Chỉ người có quyền kết luận; tiêu chí bắt buộc phải có kết quả.
QUA-07
Must
QC/Người thực hiện
Rectification
Khi inspection không đạt, QC tạo hạng mục cần khắc phục với mô tả, trách nhiệm và hạn; người thực hiện nộp kết quả sửa.
Rectification có state riêng và không bị ghi đè bởi vòng sau.
QUA-08
Must
QC/Hệ thống
Re-inspection và Quality Close Gate
QC tái kiểm tra cho đến khi hạng mục bắt buộc đạt; hệ thống chỉ Closed Work Order khi toàn bộ quality gate đạt.
Work Done vẫn chưa Closed nếu còn checkpoint/final inspection/rectification bắt buộc chưa hoàn tất.
QUA-09
Should
QC/Điều phối viên
Witness Point
Cho phép khai báo checkpoint dạng Witness và ghi nhận việc thông báo/quan sát theo chính sách dự án.
Không được hiểu như Hold Point; mức blocking được cấu hình theo rule được duyệt.
QUA-10
Should
QC
Conditional Pass
QC có thể kết luận đạt có điều kiện khi lỗi nhỏ không cản trở việc chấp nhận phần thi công nhưng vẫn cần rectification.
Conditional Pass phải tạo/giữ rectification bắt buộc; không tự Closed khi item chưa verified.
Mã / Ưu tiên
Tác nhân
Yêu cầu kinh doanh
Quy tắc, kết quả và ngoại lệ
RPT-01
Must
Hệ thống/Người dùng
Thông báo nghiệp vụ và hộp thông báo
Tạo thông báo trong ứng dụng cho assignment, lịch, blocker, material supplement, inspection, Hold Point, rectification và kết quả liên quan.
Thông báo nhắm đúng người, mở đúng đối tượng và tôn trọng quyền; đọc/xóa không đổi nghiệp vụ nguồn.
RPT-02
Must
Quản lý/Điều phối viên
Dashboard điều hành
Web tổng hợp Work Order chưa phân công, quá hạn, blocker, waiting QC, rectification, resource workload và các trạng thái chính.
Chỉ số có định nghĩa, thời điểm cập nhật và tôn trọng quyền Project.
RPT-03
Must
Quản lý/QC
KPI nguyên nhân chậm và chất lượng
Theo dõi blocker theo reason/duration, first-pass quality, re-inspection/rectification và các KPI đã thống nhất; hỗ trợ drill-down.
Dữ liệu chi tiết phải đối chiếu được với số tổng; tránh quy delay ngoài kiểm soát vào Worker nếu reason cho thấy nguyên nhân khác.
RPT-04
Must
Quản trị viên/Quản lý
Audit Trail
Ghi và tra cứu các thay đổi quan trọng về quyền, assignment, dependency/readiness, blocker, lịch, Work Done, quality và material supplement.
Audit chỉ đọc với người dùng thường, có actor/time/action/object/result và lý do khi bắt buộc.
RPT-05
Should
Người có quyền
Xuất dữ liệu cơ bản
Xuất các danh sách/báo cáo được duyệt theo bộ lọc hiện tại.
Tôn trọng quyền; không có report designer tùy biến trong baseline.
Đối tượng
Vòng đời tham chiếu
Quy tắc chuyển quan trọng
Project
Draft → Active → Paused → Completed → Closed
Project Closed không tạo Work Order mới; reopen cần quyền.
Work Order
Draft → Ready → Open/Assigned → In Progress → Work Done → Closed; hoặc Cancelled
Open dùng cho Job Board; Work Done chỉ xác nhận execution; Closed chỉ sau quality gate.
Assignment
Pending Acceptance (nếu áp dụng) → Active → Ended/Withdrawn/Rejected
Một Work Order chỉ có một Active Assignment; assignee là Worker hoặc Crew.
Readiness
Not Checked → Ready / Ready With Constraint / Not Ready
Not Ready chặn Start; Ready With Constraint chỉ Start nếu constraint không blocking.
Blocker
Open → Acknowledged → Resolving → Resolved; hoặc Cancelled
Độc lập với Work Order execution state; giữ reason, responsible party và duration.
Material Supplement
Requested → Acknowledged → In Progress → Fulfilled; hoặc Cancelled
Không có approval/procurement; shortage không tự block Work Order.
Inspection
Pending → In Progress → Pass / Fail; Conditional Pass là Should
Hold Point chỉ release khi đạt; mỗi inspection giữ lịch sử riêng.
Rectification
Open → In Progress → Submitted → Verified; hoặc Rejected → In Progress
Không ghi đè vòng trước; item bắt buộc chưa Verified thì chưa quality close.
Notification
Unread → Read
Không thay đổi trạng thái đối tượng nghiệp vụ nguồn.
Nhóm
Đối tượng tiêu biểu
Yêu cầu dữ liệu
Tài khoản & quyền
User, role, profile, project membership
Duy nhất, trạng thái rõ, lịch sử thay đổi quyền/tài khoản.
Nguồn lực
Worker, contractor, Crew, Crew Lead, membership, trade/skill
Dùng cho eligibility và trách nhiệm assignment; giữ lịch sử membership/lead khi cần.
Dự án
Project, Area, Work Type, member, dependency, reference
Quan hệ toàn vẹn; dependency không vòng lặp; không mất lịch sử khi đóng/ngừng.
Work Order & execution
Work Order, assignment, Job Board, schedule, readiness, blocker, progress, log, material
Giữ assignee/source, readiness, blocker timeline, material shortage/supplement và Work Done.
Chất lượng
Checklist, checkpoint, inspection, result, evidence, rectification, re-inspection
Mỗi vòng độc lập, có version template và bằng chứng.
Thông báo & audit
Notification, read state, audit trail
Có source object; không ghi bí mật; chỉ đọc đối với audit.
Mã
Báo cáo/Chỉ số
Nội dung
R-01
Tổng quan Work Order
Số Work Order theo state, Project, Area, Work Type và thời gian.
R-02
Công việc chưa có assignee
Work Order đang Open/Ready nhưng chưa có assignment.
R-03
Công việc quá hạn
Work Order quá hạn chưa Closed, số thời gian trễ và responsible assignment.
R-04
Readiness và Blocker
Phân bố readiness; blocker đang mở; duration và reason/responsible party.
R-05
Tiến độ dự án
Phân bố execution state và tiến độ theo Project/Area; plan-vs-actual khi Should được triển khai.
R-06
Chất lượng
First-pass quality, inspection pending, rectification open, re-inspection và Hold Point waiting release.
R-07
Vật tư phục vụ Work Order
Planned material/shortage/supplement request theo trạng thái và thời gian xử lý.
R-08
Audit thay đổi
Assignment/reassign, readiness override, blocker, Work Done, quality và quyền theo actor/time/object.
Mã
Thuộc tính
Kỳ vọng kinh doanh
NQ-01
Dễ sử dụng
Worker/Crew Lead có thể truy cập Today Jobs, readiness, blocker, progress và Work Done với hành động tiếp theo rõ ràng.
NQ-02
Bảo mật và phân quyền
Người dùng chỉ truy cập dữ liệu/hành động đúng role và Project; quyền nhạy cảm được kiểm tra ở hệ thống.
NQ-03
Hiệu năng cảm nhận
Các danh sách/thao tác phổ biến phản hồi trong thời gian chấp nhận được; danh sách lớn có lọc/phân trang.
NQ-04
Độ tin cậy
Self-accept, assignment, transition, Hold Point và quality close không tạo tác động trùng khi retry hoặc thao tác đồng thời.
NQ-05
Khả năng phục hồi
Upload/cập nhật thất bại có trạng thái rõ và retry an toàn, không mất dữ liệu hợp lệ đã nhập khi có thể.
NQ-06
Khả năng truy vết
Hành động quan trọng truy được actor, time, before/after, reason và source object.
NQ-07
Tương thích thiết bị
Web phù hợp desktop thông dụng; Mobile hoạt động ổn định trên nền tảng được chốt trước thiết kế.
NQ-08
Bảo toàn dữ liệu
Không mất lịch sử khi thay Crew Lead, reassign, resolve blocker, rectification hoặc ngừng hoạt động dữ liệu nền.
NQ-09
Khả năng kiểm thử/nghiệm thu
Mỗi Must có kịch bản quan sát được và dữ liệu demo để chứng minh kết quả end-to-end.
Mã
Giả định/Phụ thuộc
A-01
Danh sách role và quyền cấp cao được khách hàng/nhóm thống nhất trước khi khóa baseline.
A-02
Phiên bản đầu phục vụ một doanh nghiệp VINACON; không có multi-tenant.
A-03
Đại diện nghiệp vụ cung cấp/duyệt Work Type, trade/skill, checklist/checkpoint, blocker reason và vật tư mẫu để kiểm thử.
A-04
Worker/Crew Lead có thiết bị Mobile và kết nối đủ để cập nhật; full offline sync ngoài phạm vi.
A-05
QC thống nhất tiêu chí kiểm tra, Hold Point áp dụng và thông tin bắt buộc của rectification.
A-06
Các KPI và cách tính blocker duration/first-pass quality được chốt trước dashboard cuối cùng.
A-07
Các ảnh/tệp demo không chứa dữ liệu cá nhân/bí mật chưa được phép sử dụng.
Mã
Rủi ro
Mức
Kiểm soát
RISK-01
Phình to phạm vi
Cao
Khóa 44 Must; Should và module ngoài phạm vi không được tự động đưa vào baseline.
RISK-02
State model không thống nhất
Cao
Chốt rõ Work Order, readiness, blocker, inspection/rectification và material supplement trước triển khai.
RISK-03
Self-accept tạo assignment trùng
Cao
Giữ one-winner rule, retry-safe và concurrency test cho cùng Work Order.
RISK-04
Mơ hồ trách nhiệm Crew
Cao
Crew/Crew Lead là Must; rule Submit Work Done và lịch sử thay Lead phải được khóa.
RISK-05
Readiness/Blocker bị biến thành quá nhiều trạng thái
Cao
Giữ readiness và blocker như state model/object độc lập; taxonomy reason cố định ở baseline.
RISK-06
Quality checkpoint làm scope QC phình lớn
Cao
Baseline chỉ Pre-activity, Hold Point, Final, Rectification, Re-inspection; Witness/Conditional Pass là Should; formal NCR ngoài scope.
RISK-07
Vật tư mở rộng thành kho/mua hàng
Cao
Chỉ planned material, readiness, shortage/supplement; không approval, supplier, inventory, PO/VPO, price.
RISK-08
Mobile/upload ảnh không ổn định
Trung bình
Giới hạn loại/kích thước, retry an toàn và luồng Mobile tối giản theo next action.
RISK-09
KPI không có dữ liệu nền
Trung bình
Chốt công thức trước dashboard; dùng dữ liệu demo định nghĩa rõ nếu chưa có số liệu lịch sử.
Giai đoạn
Trọng tâm
Kết quả
Giai đoạn 1
Nền tảng nghiệp vụ
IAM, Worker/Crew/Crew Lead, trade/skill, Project, Area, Work Type và quyền Project.
Giai đoạn 2
Planning & Dispatch
Work Order, dependency, schedule, direct assignment, Job Board, self-accept, My Jobs.
Giai đoạn 3
Make Ready & Execution
Pre-start readiness, blocker, progress/log/evidence, planned material, shortage/supplement và Work Done.
Giai đoạn 4
Quality Close
Checklist, inspection checkpoint, Hold Point, Final Inspection, rectification, re-inspection và Closed gate.
Giai đoạn 5
Điều hành & nghiệm thu
Notification, dashboard/KPI, audit, dữ liệu demo, integration test và E2E Web/Mobile.
Điều kiện triển khai Should
Chỉ bắt đầu khi workflow Must xuyên suốt đã ổn định, có integration test và dữ liệu demo. Should không được làm chậm hoặc làm giảm chất lượng core E2E.
Mã
Tiêu chí nghiệm thu
AC-01
Người dùng đăng nhập đúng role/Project và không truy cập dữ liệu ngoài quyền.
AC-02
Quản trị viên tạo được Worker, Crew, Crew Lead, trade/skill; quản lý tạo Project/Area/Work Type và member.
AC-03
Điều phối viên direct assign Work Order cho Worker hoặc Crew; Crew assignment chỉ hợp lệ khi có Crew Lead active.
AC-04
Điều phối viên mở Job Board; Worker đủ điều kiện self-accept ngay; nhiều Worker nhận đồng thời chỉ một người thành công.
AC-05
Assignment cá nhân chỉ assigned Worker Submit Work Done; assignment Crew chỉ Crew Lead có quyền này.
AC-06
Work Order có hard dependency chưa đạt không được xác nhận Ready/Start nếu không có ngoại lệ hợp lệ.
AC-07
Pre-start readiness ghi nhận đúng Ready / Ready With Constraint / Not Ready và Start gate phản ứng theo rule.
AC-08
Worker/Crew Lead tạo blocker; quản lý theo dõi/resolve; hệ thống giữ reason, responsible party và duration.
AC-09
Thiếu vật tư có thể tạo supplement request; Work Order vẫn có thể tiếp tục nếu shortage không blocking.
AC-10
Worker/Crew cập nhật progress, log và evidence; dữ liệu truy được actor/time.
AC-11
Hold Point chưa release ngăn bước thi công bị kiểm soát; QC release sau khi kiểm tra đạt.
AC-12
Final Inspection fail tạo rectification; người thực hiện nộp bằng chứng; QC re-inspect đến khi đạt.
AC-13
Work Done không làm Work Order Closed khi quality gate còn thiếu.
AC-14
Thông báo assignment/blocker/inspection/rectification mở đúng ngữ cảnh và tôn trọng quyền.
AC-15
Dashboard phản ánh đúng Work Order, blocker, overdue và quality KPI; drill-down khớp dữ liệu nguồn.
AC-16
Audit truy được assignment/reassign, readiness/blocker, Work Done và quality decision theo actor/time.
AC-17
Một kịch bản end-to-end được trình diễn trên Web + Mobile mà không cần sửa dữ liệu thủ công trong hệ thống.
Mã
Quyết định cần xác nhận
Q-01
Giữ riêng vai trò Quản lý dự án và Điều phối viên hay gộp ở phiên bản đầu?
Q-02
Direct assignment có bắt buộc Worker/Crew Lead Accept/Reject hay có hiệu lực ngay?
Q-03
Giới hạn việc đồng thời của Worker được tính theo số lượng, thời gian hay không áp dụng trong baseline?
Q-04
Xung đột lịch là hard-block hay cho phép Coordinator override có lý do?
Q-05
Crew member ngoài Crew Lead được cập nhật những loại dữ liệu nào: progress, log, photo, rectification?
Q-06
Khi Crew Lead đổi giữa Work Order, quyền Submit Work Done dùng current Lead hay Lead snapshot theo assignment?
Q-07
Dependency có hỗ trợ loại advisory hay baseline chỉ có hard dependency?
Q-08
Những readiness item nào mặc định blocking và ai có quyền override?
Q-09
Ai có quyền resolve blocker và responsible party có cần bắt buộc hay không?
Q-10
Ai có quyền release Hold Point: QC nội bộ, Project Manager hay cấu hình theo Work Type?
Q-11
Witness Point và Conditional Pass có được cam kết ở bản bảo vệ hay chỉ Should/backlog?
Q-12
Progress dự án dùng số Work Order hay có trọng số theo thời lượng/khối lượng?
Q-13
Định dạng export: CSV, XLSX hay cả hai?
Q-14
Mobile baseline là Android hay cần cả iOS?
Q-15
Thời gian lưu audit, ảnh và attachment trong môi trường demo/triển khai là bao lâu?
Thuật ngữ
Định nghĩa
Work Order/Công việc thi công
Đơn vị công việc được quản lý xuyên suốt planning, assignment, readiness, execution, quality và Closed.
Job Board
Danh sách Work Order còn trống được phép hiển thị để Worker đủ điều kiện chủ động nhận.
Worker
Cá nhân trực tiếp thực hiện công việc tại hiện trường.
Crew
Tổ/đội gồm nhiều Worker và được dùng như một nguồn lực cho Direct Assignment.
Crew Lead
Worker đại diện Crew, chịu trách nhiệm các thao tác xác nhận ở cấp Work Order theo rule.
Assignment
Quan hệ xác định Work Order đang được giao cho Worker hoặc Crew tại một thời điểm.
Eligibility
Tập điều kiện về trạng thái, skill, quyền Project, lịch và giới hạn để nguồn lực được nhận/phân công.
Dependency
Quan hệ tiền nhiệm/điều kiện giữa Work Order dùng để xác định khả năng bắt đầu.
Readiness
Đánh giá mức sẵn sàng trước Start: Ready, Ready With Constraint hoặc Not Ready.
Blocker/Constraint
Vướng mắc làm cản trở bắt đầu/tiếp tục Work Order; có reason, responsible party, timeline và resolution.
Work Done
Xác nhận phần thi công đã hoàn thành; chưa đồng nghĩa Work Order Closed.
Inspection Checkpoint
Mốc kiểm tra chất lượng trước, trong hoặc sau thi công.
Hold Point
Inspection checkpoint mà bước thi công bị kiểm soát không được tiếp tục trước khi được release.
Rectification
Hạng mục cần khắc phục sau khi inspection phát hiện không đạt.
Material Supplement Request
Yêu cầu bổ sung vật tư phát sinh từ shortage gắn Work Order; không phải purchase requisition/procurement approval.
Audit Trail
Chuỗi bản ghi chỉ đọc để truy vết actor, time, action, object, result và reason khi áp dụng.
Mục tiêu
Nội dung
Năng lực
Yêu cầu liên quan
OBJ-01
Tăng tốc độ lấp đầy công việc
C2, C4, C5
ORG-05; JOB-02..06, JOB-08; SCH-01..04
OBJ-02
Nâng hiệu quả điều phối và trách nhiệm nguồn lực
C2, C4, C5
ORG-03..05; JOB-06..11; SCH-01..04
OBJ-03
Tăng tỷ lệ công việc sẵn sàng trước khi bắt đầu
C3, C4, C6
PRJ-05; JOB-12..13, JOB-16; QUA-03..05
OBJ-04
Giảm thời gian chờ do blocker/constraint
C4, C7
JOB-13; RPT-02..04
OBJ-05
Nâng chất lượng ngay lần đầu
C6, C7
QUA-01..10; RPT-02..04
OBJ-06
Tăng minh bạch vật tư phục vụ Work Order
C4, C7
JOB-16..17; RPT-01..03
OBJ-07
Tăng mức độ sử dụng Mobile tại hiện trường
C4, C5, C6, C7
JOB-04, JOB-11..18; SCH-02; QUA-03, QUA-05..10; RPT-01
OBJ-08
Thông tin điều hành và truy vết đáng tin cậy
C4, C5, C6, C7
JOB-08, JOB-13..18; SCH-01..05; QUA-04..10; RPT-02..05
