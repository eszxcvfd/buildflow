**ĐẶC TẢ YÊU CẦU PHẦN MỀM**

**SOFTWARE REQUIREMENTS SPECIFICATION (SRS)**

**HỆ THỐNG QUẢN LÝ CÔNG VIỆC THI CÔNG
VÀ KIỂM SOÁT CHẤT LƯỢNG**

**Trên nền tảng Web và Mobile**

|  | **Định hướng nghiệp vụ cốt lõi** Hệ thống hỗ trợ điều phối kết hợp: điều phối viên có thể phân công trực tiếp, đồng thời worker đủ điều kiện có thể tự nhận Work Order còn trống trên Job Board. Việc tự nhận được xác nhận ngay nếu công việc vẫn khả dụng và mọi điều kiện đều đạt. |
| --- | --- |

| Thuộc tính | Nội dung |
| --- | --- |
| **Mã tài liệu** | SRS-CWM-QC-001 |
| **Phiên bản** | 1.0 - Dự thảo đặc tả yêu cầu phần mềm |
| **Trạng thái** | Chờ đại diện khách hàng và nhóm thực hiện xác nhận |
| **Ngày lập** | 01/08/2026 |
| **Phạm vi phát hành** | Phiên bản sản phẩm trong phạm vi đồ án |
| **Tài liệu nghiệp vụ nền** | BRD-CWM-QC-001 |
| **Kênh sử dụng** | Web quản trị và Mobile hiện trường |

*Tài liệu mô tả hệ thống phải làm gì, điều kiện và kết quả quan sát được trước khi thực hiện thiết kế chi tiết.*

# **0. Kiểm soát tài liệu**

| Thuộc tính | Nội dung |
| --- | --- |
| Tên tài liệu | Đặc tả yêu cầu phần mềm - Hệ thống Quản lý Công việc Thi công và Kiểm soát Chất lượng |
| Mục đích | Thống nhất hành vi phần mềm, dữ liệu, giao diện, yêu cầu chất lượng và tiêu chí nghiệm thu trước thiết kế và triển khai. |
| Đối tượng đọc | Nhà tài trợ, đại diện khách hàng, Business Analyst, UX/UI, nhóm phát triển, kiểm thử, vận hành và hội đồng đánh giá. |
| Phạm vi tài liệu | Yêu cầu phần mềm và kết quả quan sát được; không quy định framework, ngôn ngữ, schema vật lý, endpoint chi tiết hoặc cấu trúc mã. |
| Tài liệu nghiệp vụ nền | BRD-CWM-QC-001 - Tài liệu yêu cầu kinh doanh cho phạm vi đồ án. |

## **0.1. Trạng thái phê duyệt**

| Vai trò | Người xác nhận | Trạng thái | Ngày |
| --- | --- | --- | --- |
| Nhà tài trợ/Đại diện khách hàng | [Chưa chỉ định] | Chờ xác nhận |  |
| Đại diện quản lý vận hành | [Chưa chỉ định] | Chờ xác nhận |  |
| Đại diện kiểm soát chất lượng | [Chưa chỉ định] | Chờ xác nhận |  |
| Đại diện người sử dụng hiện trường | [Chưa chỉ định] | Chờ xác nhận |  |
| Đại diện kỹ thuật/QA | [Chưa chỉ định] | Chờ xác nhận |  |
| Business Analyst | [Chưa chỉ định] | Dự thảo | 01/08/2026 |

## **0.2. Lịch sử phiên bản**

| Phiên bản | Ngày | Mô tả thay đổi | Trạng thái |
| --- | --- | --- | --- |
| 0.1 | 01/08/2026 | Khởi tạo cấu trúc SRS theo phạm vi nghiệp vụ đã thống nhất. | Dự thảo nội bộ |
| 1.0 | 01/08/2026 | Hoàn thiện yêu cầu chức năng, quy tắc, trạng thái, use case, dữ liệu, NFR, nghiệm thu và truy vết. | Dự thảo xác nhận |

## **0.3. Quy ước yêu cầu**

| Nhãn | Ý nghĩa |
| --- | --- |
| Must | Bắt buộc để workflow cốt lõi hoạt động, để bảo đảm kiểm soát nghiệp vụ hoặc để nghiệm thu phiên bản đầu. |
| Should | Quan trọng và mang lại giá trị rõ; có thể lùi sau khi các yêu cầu Must hoạt động ổn định. |
| TBD | Chưa đủ quyết định nghiệp vụ để khóa baseline; phải được xác nhận trước thiết kế hoặc trước nghiệm thu liên quan. |
|  | **Cách đọc yêu cầu** Cột “Yêu cầu phần mềm” mô tả hành vi quan sát được. Cột “Điều kiện nghiệm thu, quy tắc và ngoại lệ” là phần bắt buộc của yêu cầu, không phải ghi chú tùy chọn. Mọi yêu cầu đồng thời chịu các quy tắc nghiệp vụ và state model liên quan. |

# **Mục lục nội dung**

* 0. Kiểm soát tài liệu
* 1. Giới thiệu
* 2. Mô tả tổng thể
* 3. Quy trình nghiệp vụ tổng thể
* 4. Quy tắc nghiệp vụ trọng yếu
* 5. Vòng đời trạng thái
* 6. Tổng quan yêu cầu chức năng
* 7. Yêu cầu chức năng chi tiết
* 8. Trường hợp sử dụng chi tiết
* 9. Yêu cầu dữ liệu
* 10. Yêu cầu giao diện và tích hợp
* 11. Yêu cầu phi chức năng
* 12. Xác minh, kiểm thử và nghiệm thu
* 13. Truy vết yêu cầu
* 14. Quyết định cần xác nhận và quản lý thay đổi
* Phụ lục A. Thuật ngữ
* Phụ lục B. Tóm tắt số lượng yêu cầu

# **1. Giới thiệu**

## **1.1. Mục đích**

Tài liệu này chuyển các nhu cầu kinh doanh đã được thống nhất thành yêu cầu phần mềm có thể thiết kế, phát triển, kiểm thử và nghiệm thu. Mỗi yêu cầu xác định tác nhân, hành vi bắt buộc, điều kiện thành công, ngoại lệ và kết quả quan sát được. Tài liệu không quy định công nghệ hoặc cách cài đặt cụ thể.

## **1.2. Phạm vi sản phẩm**

* Quản lý tài khoản, hồ sơ, trạng thái tài khoản, vai trò và phạm vi truy cập dự án.
* Quản lý worker, nhà thầu, đội thi công, ngành nghề và kỹ năng phục vụ điều phối.
* Quản lý dự án, khu vực/hạng mục, loại công việc, thành viên và tệp đính kèm cơ bản.
* Tạo Work Order, phân công trực tiếp, Job Board và worker tự nhận việc ngay khi đủ điều kiện.
* Lập lịch, My Jobs/Today Jobs, cập nhật tiến độ, nhật ký và bằng chứng hiện trường.
* Checklist trước bắt đầu, kiểm tra chất lượng, yêu cầu khắc phục và tái kiểm tra.
* Yêu cầu vật tư ở mức danh mục, phê duyệt, trạng thái cung ứng và xác nhận nhận đơn giản.
* Thông báo trong ứng dụng, dashboard, drill-down và lịch sử thao tác quan trọng.

## **1.3. Ngoài phạm vi**

* Multi-tenant hoặc quản trị nhiều doanh nghiệp trong phiên bản đồ án.
* Hệ thống kế toán, PO/VPO, hóa đơn, thanh toán, payroll, thuế hoặc tích hợp QuickBooks.
* Quản lý kho đầy đủ: nhập-xuất-tồn, barcode, vị trí kho, định mức, nhà cung cấp và giá mua.
* Hợp đồng điện tử, W-9, bảo hiểm, onboarding tuân thủ nhiều bước hoặc chữ ký số.
* Chat thời gian thực, email/SMS automation, phone call hoặc Communication Portal.
* GPS tracking liên tục, geofence, tối ưu tuyến đường hoặc offline synchronization đầy đủ.
* BIM/CAD, dự toán xây dựng, quản lý thiết bị hoặc bảo trì/bảo hành chuyên sâu.
* Thiết kế UI pixel-perfect, schema cơ sở dữ liệu vật lý, endpoint chi tiết và hạ tầng triển khai cuối cùng.

## **1.4. Tổ chức tài liệu**

Các mục 2-5 mô tả bối cảnh, workflow, business rule và state model. Mục 7 là baseline chức năng. Mục 8 mô tả use case xuyên suốt. Các mục 9-11 quy định dữ liệu, giao diện và chất lượng. Mục 12-14 quy định nghiệm thu, truy vết và quyết định còn mở.

## **1.5. Thuật ngữ chính**

| Thuật ngữ | Định nghĩa |
| --- | --- |
| Work Order/Công việc thi công | Đơn vị công việc được quản lý theo dự án, trạng thái, người thực hiện, lịch và checklist. |
| Job Board | Danh sách Work Order còn trống được phép hiển thị để worker đủ điều kiện chủ động nhận. |
| Worker | Nhân viên hoặc cá nhân/nhà thầu trực tiếp thực hiện công việc tại hiện trường. |
| Điều phối viên | Người tạo, mở, phân công, tái phân công và lập lịch Work Order. |
| Assignment/Phân công | Quan hệ xác định worker, đội hoặc nhà thầu chịu trách nhiệm chính cho Work Order. |
| Eligibility/Điều kiện nhận việc | Tập điều kiện về trạng thái, năng lực, lịch và giới hạn để nguồn lực được nhận hoặc phân công. |
| My Jobs | Danh sách Work Order worker đã được giao hoặc tự nhận. |
| Checklist | Tập tiêu chí/câu hỏi cần hoàn thành ở một giai đoạn công việc. |

# **2. Mô tả tổng thể**

## **2.1. Bài toán và giá trị sản phẩm**

Hệ thống cung cấp một luồng thống nhất từ khi dự án và nguồn lực được thiết lập, công việc được tạo/mở, người thực hiện được phân công hoặc tự nhận, đến khi công việc được thực hiện, kiểm tra, khắc phục và hoàn tất. Mục tiêu là giảm dữ liệu phân tán, rút ngắn thời gian lấp đầy công việc, tăng minh bạch hiện trường và tạo bằng chứng có thể truy vết.

|  | **Nguyên tắc điều phối kết hợp** Worker đủ điều kiện có thể tự nhận Work Order còn trống và được gán ngay; điều phối viên vẫn có thể phân công trực tiếp. Hệ thống phải dùng cùng điều kiện năng lực/lịch, ghi rõ nguồn assignment và bảo đảm chỉ một kết quả hợp lệ khi nhiều người thao tác đồng thời. |
| --- | --- |

## **2.2. Ranh giới hệ thống**

![Image: image1.png](data:image/png;base64...)

*Hình 1. Ranh giới logic và nhóm người dùng của hệ thống.*

## **2.3. Nhóm người dùng**

| Nhóm | Nhu cầu chính | Kênh |
| --- | --- | --- |
| Quản trị viên | Tài khoản, vai trò, dữ liệu nền, worker/nhà thầu và cấu hình dùng chung. | Web |
| Quản lý dự án | Dự án, tiến độ, phê duyệt, xử lý ngoại lệ và báo cáo. | Web |
| Điều phối viên | Tạo/mở Work Order, phân công, lập lịch và tái phân công. | Web |
| Worker/Nhà thầu | Job Board, My Jobs, thực hiện, tiến độ, checklist, ảnh và vật tư. | Mobile |
| Quality Inspector | Hàng đợi kiểm tra, phiếu chất lượng, lỗi, khắc phục và tái kiểm tra. | Web/Mobile |
| Kho/Mua hàng đơn giản | Trạng thái cung ứng và hỗ trợ xác nhận vật tư khi phạm vi Should được triển khai. | Web |
| Hệ thống | Kiểm tra điều kiện, đồng thời, thông báo, tổng hợp và audit. | Tự động |

## **2.4. Ma trận quyền cấp cao**

| Miền | Admin | Quản lý DA | Điều phối | Worker | QC | Kho |
| --- | --- | --- | --- | --- | --- | --- |
| Tài khoản/dữ liệu nền | Quản lý | Xem hạn chế | Xem hạn chế | Hồ sơ cá nhân | Xem hạn chế | - |
| Dự án | Quản lý | Quản lý | Quản lý theo phân công | Xem dự án liên quan | Xem dự án liên quan | - |
| Work Order/Job Board | Cấu hình | Phê duyệt/giám sát | Tạo, mở, phân công | Tự nhận/thực hiện | Xem/kiểm tra | - |
| Lịch/tiến độ | Xem | Xem toàn dự án | Quản lý | Xem việc của mình | Xem việc kiểm tra | - |
| Checklist/chất lượng | Cấu hình | Giám sát | Theo dõi | Thực hiện/khắc phục | Kiểm tra/kết luận | - |
| Vật tư | Cấu hình | Phê duyệt | Tạo/xem | Yêu cầu/xác nhận | Xem | Cập nhật cung ứng |
| Dashboard/audit | Tất cả theo quyền | Dự án | Vận hành | Cá nhân | Chất lượng | Vật tư |

## **2.5. Giả định và ràng buộc**

* Phiên bản đầu phục vụ một doanh nghiệp; mọi người dùng nằm trong cùng phạm vi vận hành.
* Khách hàng cung cấp vai trò, loại công việc, ngành nghề, checklist và vật tư mẫu trước kiểm thử.
* Worker có thiết bị Mobile và kết nối mạng đủ để cập nhật; offline đầy đủ không thuộc phạm vi.
* Ảnh/tệp nghiệm thu không chứa dữ liệu cá nhân hoặc bí mật chưa được phép sử dụng.
* Đại diện QC xác nhận tiêu chí đạt/không đạt và dữ liệu bắt buộc của yêu cầu khắc phục.
* Những mục đánh dấu TBD phải được quyết định trước khi thiết kế hoặc trước kiểm thử tương ứng.

# **3. Quy trình nghiệp vụ tổng thể**

![Image: image2.png](data:image/png;base64...)

*Hình 2. Luồng giá trị xuyên suốt từ thiết lập đến hoàn thành chất lượng.*

## **3.1. Thiết lập dự án và nguồn lực**

**1.** Quản trị viên quản lý tài khoản, worker/nhà thầu, ngành nghề và kỹ năng.

**2.** Quản lý dự án tạo dự án, khu vực/hạng mục và thành viên.

**3.** Điều phối viên/Quản trị viên cấu hình loại công việc, checklist và dữ liệu nền.

## **3.2. Phân công trực tiếp**

**1.** Điều phối viên tạo và lập lịch Work Order.

**2.** Hệ thống kiểm tra dự án, dữ liệu bắt buộc, trạng thái nguồn lực, năng lực và xung đột lịch.

**3.** Khi hợp lệ, hệ thống tạo assignment, cập nhật My Jobs/lịch và gửi thông báo.

**4.** Khi tái phân công hoặc thu hồi, lý do và người thực hiện trước được giữ.

## **3.3. Worker tự nhận việc**

**1.** Điều phối viên mở Work Order còn trống trên Job Board.

**2.** Worker xem, lọc và mở chi tiết công việc.

**3.** Worker chọn Nhận việc.

**4.** Hệ thống kiểm tra điều kiện và xác nhận ngay trong một giao dịch nhất quán.

**5.** Nếu nhiều người nhận đồng thời, chỉ một người thành công; người còn lại được thông báo công việc đã được nhận.

## **3.4. Thực hiện và gửi hoàn thành**

**1.** Worker xem My Jobs/Today Jobs và checklist.

**2.** Worker hoàn thành checklist bắt đầu, cập nhật tiến độ, nhật ký và ảnh.

**3.** Hệ thống chỉ cho gửi Chờ kiểm tra khi dữ liệu bắt buộc đầy đủ.

## **3.5. Kiểm tra, khắc phục và tái kiểm tra**

**1.** QC đánh giá checklist nghiệm thu.

**2.** Nếu không đạt, QC tạo hạng mục khắc phục với người chịu trách nhiệm và hạn.

**3.** Worker nộp bằng chứng khắc phục; QC tái kiểm tra.

**4.** Work Order chỉ Hoàn thành khi mọi điều kiện bắt buộc đạt.

## **3.6. Yêu cầu vật tư**

**1.** Worker/Điều phối viên tạo yêu cầu vật tư gắn với Work Order.

**2.** Quản lý dự án phê duyệt hoặc từ chối kèm lý do.

**3.** Nếu phạm vi Should được triển khai, Kho/Mua hàng cập nhật cung ứng và worker xác nhận tiếp nhận.

## **3.7. Điều hành và truy vết**

**1.** Hệ thống phát thông báo theo sự kiện.

**2.** Dashboard tổng hợp chỉ số và cho phép drill-down.

**3.** Quản trị viên/Quản lý tra cứu lịch sử thay đổi quan trọng.

# **4. Quy tắc nghiệp vụ trọng yếu**

Các quy tắc dưới đây áp dụng xuyên suốt các yêu cầu chức năng và use case. Trường hợp yêu cầu chi tiết mâu thuẫn với quy tắc đã phê duyệt, quy tắc nghiệp vụ và quyết định thay đổi mới nhất được ưu tiên.

| Mã | Chủ đề | Quy tắc bắt buộc |
| --- | --- | --- |
| BR-01 | Điều phối kết hợp | Work Order có thể được phân công trực tiếp hoặc mở để worker tự nhận; hai phương thức dùng cùng nguyên tắc về trạng thái, năng lực và lịch. |
| BR-02 | Tự nhận có hiệu lực ngay | Worker đủ điều kiện nhận việc còn trống được xác nhận ngay, không chờ quản lý phê duyệt lần hai. |
| BR-03 | Một assignment chính | Một Work Order chỉ có một người/đội/nhà thầu thực hiện chính tại một thời điểm, không tính vai trò QC. |
| BR-04 | Điều kiện nhận việc | Nguồn lực phải đang hoạt động, đúng kỹ năng/ngành nghề, không trùng lịch và chưa vượt giới hạn việc. |
| BR-05 | Kết quả đồng thời duy nhất | Nhiều yêu cầu nhận cùng việc chỉ tạo một assignment chính; yêu cầu còn lại nhận kết quả nghiệp vụ rõ. |
| BR-06 | Hủy, thu hồi và tái phân công | Hủy/thu hồi/tái phân công phải có lý do, giữ lịch sử và cập nhật trạng thái/lịch/thông báo. |
| BR-07 | Chuyển trạng thái hợp lệ | Chỉ cho phép chuyển trạng thái theo vai trò, trạng thái hiện tại và điều kiện bắt buộc. |
| BR-08 | Checklist trước bắt đầu | Work Order có checklist chặn không được bắt đầu khi còn mục bắt buộc chưa đạt. |
| BR-09 | Chất lượng trước hoàn tất | Work Order không được Hoàn thành khi còn tiêu chí kiểm tra hoặc hạng mục khắc phục bắt buộc chưa đạt. |
| BR-10 | Bằng chứng và lịch sử | Tiến độ, checklist, kiểm tra, ảnh, phê duyệt và lý do ngoại lệ phải gắn đúng actor, thời điểm và đối tượng. |
| BR-11 | Không xóa lịch sử | Dữ liệu đã phát sinh giao dịch dùng trạng thái ngừng hoạt động hoặc bản ghi thay đổi; không xóa cứng làm mất lịch sử. |
| BR-12 | Vật tư giới hạn phạm vi | Module vật tư chỉ quản lý danh mục, yêu cầu, phê duyệt và trạng thái tiếp nhận; không quản lý tồn kho, giá, PO/VPO hoặc thanh toán. |
| BR-13 | Quyền theo vai trò và dự án | Người dùng chỉ xem/thao tác dữ liệu phù hợp vai trò và dự án được tham gia; kiểm tra quyền thực hiện ở phía hệ thống. |
| BR-14 | Thông báo không thay đổi nghiệp vụ | Đánh dấu đọc/xóa thông báo không thay đổi trạng thái của Work Order, kiểm tra hoặc yêu cầu vật tư. |
| BR-15 | Thời gian nhất quán | Thời gian được lưu và so sánh nhất quán; lịch và lịch sử phải hiển thị rõ thời điểm theo múi giờ áp dụng. |

# **5. Vòng đời trạng thái**

|  | **Nguyên tắc chuyển trạng thái** Chỉ cho phép chuyển trạng thái hợp lệ theo vai trò và điều kiện. Mỗi chuyển trạng thái quan trọng phải lưu actor, thời điểm, trạng thái trước/sau và lý do khi bắt buộc. Gửi lại cùng thao tác không được lặp tác động đã hoàn tất. |
| --- | --- |

## **5.1. Work Order**

![Image: image3.png](data:image/png;base64...)

*Hình 3. Vòng đời tham chiếu của Work Order.*

| Trạng thái | Ý nghĩa | Chuyển tiếp hợp lệ chính |
| --- | --- | --- |
| Nháp | Chưa đủ hoặc chưa sẵn sàng công bố. | Mở/Khả dụng; Hủy |
| Mở/Khả dụng | Đang hiển thị trên Job Board và chưa có assignee. | Đã phân công; Hủy |
| Đã phân công | Đã tự nhận hoặc phân công trực tiếp. | Đang thực hiện; Mở lại khi thu hồi; Hủy |
| Đang thực hiện | Worker đang thi công/cập nhật. | Chờ kiểm tra; Cần làm lại; Hủy có kiểm soát |
| Chờ kiểm tra | Đã gửi hoàn thành và chờ QC/Quản lý. | Hoàn thành; Cần làm lại |
| Cần làm lại | Có hạng mục phải khắc phục. | Đang thực hiện; Chờ kiểm tra |
| Hoàn thành | Đã đạt mọi điều kiện bắt buộc. | Không chuyển trực tiếp; mở lại qua ngoại lệ có audit |
| Hủy | Không tiếp tục thực hiện. | Không chuyển, trừ quy trình mở lại được phê duyệt |

## **5.2. Quality Inspection**

![Image: image4.png](data:image/png;base64...)

*Hình 4. Vòng đời kiểm tra chất lượng và tái kiểm tra.*

## **5.3. Các state model khác**

| Đối tượng | Vòng đời tham chiếu | Quy tắc chuyển quan trọng |
| --- | --- | --- |
| Dự án | Nháp → Đang hoạt động → Tạm dừng → Hoàn thành → Đóng | Dự án Đóng không tạo việc mới; mở lại cần quyền. |
| Assignment | Khả dụng → Đã nhận/Đã giao → Đã hủy/Thu hồi | Một assignment chính; tái phân công giữ lịch sử. |
| Yêu cầu vật tư | Nháp → Chờ duyệt → Đã duyệt/Từ chối → Đang chuẩn bị → Đang giao → Đã nhận; hoặc Hủy | Các trạng thái cung ứng/nhận là Should; không duyệt hai lần. |
| Thông báo | Chưa đọc → Đã đọc | Trạng thái thông báo không thay đổi đối tượng nghiệp vụ. |

# **6. Tổng quan yêu cầu chức năng**

| Mã | Năng lực | Tổng FR | Ưu tiên | Use Case |
| --- | --- | --- | --- | --- |
| IAM | Tài khoản và phân quyền | 8 | Must 7; Should 1 | UC-01 |
| ORG | Tổ chức và nguồn lực | 8 | Must 6; Should 2 | UC-02, UC-03, UC-04 |
| PRJ | Dự án và dữ liệu nền | 9 | Must 7; Should 2 | UC-02 |
| JOB | Work Order và điều phối kết hợp | 22 | Must 19; Should 3 | UC-03, UC-04, UC-05 |
| SCH | Lịch và tiến độ | 7 | Must 4; Should 3 | UC-03, UC-04, UC-05, UC-08 |
| QUA | Checklist và kiểm soát chất lượng | 12 | Must 12; Should 0 | UC-05, UC-06 |
| MAT | Yêu cầu vật tư | 8 | Must 5; Should 3 | UC-07 |
| RPT | Thông báo, báo cáo và truy vết | 8 | Must 7; Should 1 | UC-08 |
|  | **Baseline chức năng** Tài liệu định nghĩa 82 yêu cầu chức năng: 67 Must và 15 Should. Chỉ yêu cầu Must là phạm vi cam kết của phiên bản đầu; Should chỉ bắt đầu sau khi workflow tạo việc → nhận/phân công → thực hiện → kiểm tra → làm lại/hoàn tất hoạt động ổn định. |

# **7. Yêu cầu chức năng chi tiết**

Mỗi yêu cầu có mã duy nhất để truy vết đến yêu cầu kinh doanh, use case và kiểm thử. Các yêu cầu mô tả hành vi mong muốn; chi tiết màn hình hoặc endpoint có thể thay đổi miễn kết quả nghiệp vụ và tiêu chí nghiệm thu được giữ.

## **7.1. IAM - Tài khoản và phân quyền**

| Tổng yêu cầu | 8 |
| --- | --- |
| Phân bố ưu tiên | Must: 7; Should: 1 |
| Use case liên quan | UC-01 |

*Bảo đảm người dùng được xác thực, truy cập đúng vai trò và mọi thay đổi nhạy cảm có thể truy vết.*

| **Mã / Ưu tiên** | **Tác nhân** | **Yêu cầu phần mềm** | **Điều kiện nghiệm thu, quy tắc và ngoại lệ** |
| --- | --- | --- | --- |
| **IAM-SRS-001 Must** | Tất cả người dùng | **Đăng nhập** Hệ thống phải cho phép người dùng đăng nhập bằng thông tin xác thực hợp lệ và khởi tạo phiên làm việc theo vai trò được cấp.  *Truy vết BRD: IAM-01, IAM-05* | Tài khoản bị khóa hoặc ngừng hoạt động bị từ chối; thông báo lỗi không tiết lộ tài khoản có tồn tại; sau đăng nhập người dùng chỉ thấy chức năng thuộc quyền. |
| **IAM-SRS-002 Must** | Tất cả người dùng | **Đăng xuất và hết phiên** Người dùng phải có thể đăng xuất; hệ thống phải kết thúc hoặc yêu cầu xác thực lại khi phiên hết hạn hoặc bị thu hồi.  *Truy vết BRD: IAM-01* | Đăng xuất làm mất hiệu lực phiên hiện tại; dữ liệu đã lưu hợp lệ không bị mất; yêu cầu tiếp theo bằng phiên hết hạn bị từ chối. |
| **IAM-SRS-003 Must** | Người dùng | **Quản lý hồ sơ cá nhân** Người dùng phải xem và cập nhật các trường hồ sơ được phép gồm họ tên, số điện thoại, ảnh đại diện và thông tin liên hệ.  *Truy vết BRD: IAM-03* | Trường ảnh hưởng định danh hoặc quyền không được tự thay đổi; dữ liệu hợp lệ được hiển thị nhất quán trên Web và Mobile. |
| **IAM-SRS-004 Must** | Quản trị viên | **Quản lý tài khoản** Quản trị viên phải tạo, cập nhật, khóa, mở khóa và ngừng hoạt động tài khoản trong phạm vi doanh nghiệp.  *Truy vết BRD: IAM-04* | Email/tên đăng nhập phải duy nhất; không xóa cứng tài khoản có lịch sử nghiệp vụ; thay đổi trạng thái lưu người thực hiện và thời điểm. |
| **IAM-SRS-005 Must** | Quản trị viên | **Gán vai trò và quyền** Quản trị viên phải gán một hoặc nhiều vai trò đã được phê duyệt cho tài khoản; hệ thống phải kiểm soát quyền xem và quyền thao tác tại phía hệ thống.  *Truy vết BRD: IAM-05* | Ẩn nút trên giao diện không thay thế kiểm tra quyền; thay đổi quyền có hiệu lực với lần truy cập tiếp theo theo chính sách phiên. |
| **IAM-SRS-006 Must** | Hệ thống | **Giới hạn dữ liệu theo dự án** Hệ thống phải giới hạn dữ liệu nghiệp vụ theo vai trò và danh sách dự án mà người dùng được tham gia.  *Truy vết BRD: IAM-05, PRJ-05* | Thay đổi mã đối tượng hoặc đường dẫn không cho phép truy cập dự án ngoài phạm vi; vai trò quản trị ngoại lệ phải được xác định rõ. |
| **IAM-SRS-007 Should** | Tất cả người dùng | **Đổi và đặt lại mật khẩu** Người dùng nên có thể đổi mật khẩu khi đang đăng nhập và yêu cầu đặt lại mật khẩu khi quên.  *Truy vết BRD: IAM-02* | Mã hoặc liên kết đặt lại có thời hạn, dùng một lần; mật khẩu mới phải đáp ứng chính sách; hệ thống không tiết lộ email có tồn tại. |
| **IAM-SRS-008 Must** | Hệ thống/Quản trị viên | **Nhật ký xác thực và tài khoản** Hệ thống phải ghi nhận đăng nhập thành công/thất bại, đăng xuất, khóa/mở khóa, ngừng hoạt động và thay đổi vai trò.  *Truy vết BRD: IAM-01, IAM-04, IAM-05, RPT-05* | Nhật ký có người dùng, thời điểm, loại hành động và kết quả; không ghi mật khẩu, mã đặt lại hoặc bí mật xác thực. |

## **7.2. ORG - Tổ chức và nguồn lực**

| Tổng yêu cầu | 8 |
| --- | --- |
| Phân bố ưu tiên | Must: 6; Should: 2 |
| Use case liên quan | UC-02, UC-03, UC-04 |

*Quản lý worker, nhà thầu, đội và năng lực dùng trong điều phối.*

| **Mã / Ưu tiên** | **Tác nhân** | **Yêu cầu phần mềm** | **Điều kiện nghiệm thu, quy tắc và ngoại lệ** |
| --- | --- | --- | --- |
| **ORG-SRS-001 Must** | Quản trị viên | **Quản lý worker/nhân viên** Quản trị viên phải tạo, xem, cập nhật và tìm kiếm hồ sơ worker/nhân viên gồm thông tin liên hệ, trạng thái, ngành nghề và kỹ năng.  *Truy vết BRD: ORG-01, ORG-05* | Hồ sơ phải có định danh duy nhất; worker ngừng hoạt động không được phân công hoặc tự nhận việc mới. |
| **ORG-SRS-002 Must** | Quản trị viên | **Quản lý nhà thầu** Hệ thống phải lưu hồ sơ nhà thầu/đối tác thi công, thông tin liên hệ, phạm vi công việc và trạng thái hợp tác.  *Truy vết BRD: ORG-02* | Nhà thầu ngừng hoạt động không được chọn cho phân công mới nhưng lịch sử cũ vẫn được giữ. |
| **ORG-SRS-003 Must** | Quản trị viên | **Quản lý ngành nghề và kỹ năng** Quản trị viên phải quản lý danh mục ngành nghề/kỹ năng và gán các năng lực phù hợp cho worker hoặc nhà thầu.  *Truy vết BRD: ORG-05* | Danh mục đã được dùng chỉ được ngừng hoạt động; năng lực ngừng hiệu lực không dùng cho phân công/tự nhận mới. |
| **ORG-SRS-004 Must** | Quản trị viên | **Quản lý trạng thái nguồn lực** Quản trị viên phải kích hoạt, tạm ngừng hoặc chấm dứt trạng thái hoạt động của worker, nhà thầu và đội.  *Truy vết BRD: ORG-01, ORG-02, ORG-03* | Trước khi ngừng hoạt động, hệ thống cảnh báo công việc hoặc lịch đang mở; không làm mất lịch sử đã phát sinh. |
| **ORG-SRS-005 Must** | Quản lý/Điều phối viên | **Tra cứu nguồn lực** Người có quyền phải tìm kiếm và lọc nguồn lực theo trạng thái, ngành nghề, kỹ năng và đội để phục vụ phân công.  *Truy vết BRD: ORG-01, ORG-02, ORG-05* | Kết quả chỉ chứa nguồn lực trong phạm vi được phép; dữ liệu trạng thái phải là dữ liệu hiện hành. |
| **ORG-SRS-006 Should** | Điều phối viên | **Quản lý đội thi công** Điều phối viên nên có thể tạo đội, đặt tên, chỉ định trưởng nhóm và cập nhật trạng thái đội.  *Truy vết BRD: ORG-04* | Đội ngừng hoạt động không nhận phân công mới; thay đổi không làm mất liên kết với công việc đã hoàn tất. |
| **ORG-SRS-007 Should** | Điều phối viên/Trưởng nhóm | **Quản lý thành viên đội** Người có quyền nên có thể thêm hoặc loại thành viên khỏi đội và xác định thời gian hiệu lực của quan hệ thành viên.  *Truy vết BRD: ORG-04* | Hệ thống cảnh báo thành viên trùng đội hoặc trùng lịch theo chính sách; lịch sử thành viên tại thời điểm thực hiện công việc được bảo toàn. |
| **ORG-SRS-008 Must** | Hệ thống | **Cung cấp dữ liệu điều kiện nhận việc** Hệ thống phải cung cấp trạng thái hoạt động, ngành nghề, kỹ năng và quan hệ đội của nguồn lực cho các bước phân công và tự nhận.  *Truy vết BRD: ORG-01, ORG-02, ORG-03, ORG-05, JOB-07* | Khi dữ liệu năng lực thay đổi, các kiểm tra mới dùng dữ liệu hiện hành; assignment đã phát sinh vẫn giữ thông tin lịch sử cần thiết. |

## **7.3. PRJ - Dự án và dữ liệu nền**

| Tổng yêu cầu | 9 |
| --- | --- |
| Phân bố ưu tiên | Must: 7; Should: 2 |
| Use case liên quan | UC-02 |

*Thiết lập cấu trúc dự án, khu vực, loại công việc và thành viên trước khi tạo Work Order.*

| **Mã / Ưu tiên** | **Tác nhân** | **Yêu cầu phần mềm** | **Điều kiện nghiệm thu, quy tắc và ngoại lệ** |
| --- | --- | --- | --- |
| **PRJ-SRS-001 Must** | Quản lý dự án | **Tạo và cập nhật dự án** Quản lý dự án phải tạo và cập nhật dự án với mã, tên, địa điểm, thời gian dự kiến, người phụ trách và mô tả.  *Truy vết BRD: PRJ-01* | Mã dự án duy nhất; trường bắt buộc được kiểm tra; thay đổi quan trọng lưu người và thời điểm. |
| **PRJ-SRS-002 Must** | Quản lý dự án | **Quản lý trạng thái dự án** Người có quyền phải chuyển dự án giữa Nháp, Đang hoạt động, Tạm dừng, Hoàn thành và Đóng theo điều kiện.  *Truy vết BRD: PRJ-01* | Dự án Đóng không tạo Work Order mới; mở lại hoặc hủy phải có quyền và lý do. |
| **PRJ-SRS-003 Must** | Quản lý dự án | **Quản lý khu vực/hạng mục** Dự án phải hỗ trợ danh sách khu vực hoặc hạng mục để liên kết công việc và tổng hợp tiến độ.  *Truy vết BRD: PRJ-02* | Phiên bản đầu chỉ hỗ trợ một cấp phân nhóm dưới dự án; hạng mục đã dùng không bị xóa làm mất lịch sử. |
| **PRJ-SRS-004 Must** | Quản trị viên/Điều phối viên | **Quản lý loại công việc** Hệ thống phải quản lý loại công việc, nhóm công việc, yêu cầu kỹ năng và dữ liệu bắt buộc tương ứng.  *Truy vết BRD: PRJ-03* | Loại công việc ngừng hoạt động không dùng cho Work Order mới; dữ liệu cũ vẫn hiển thị đúng. |
| **PRJ-SRS-005 Must** | Quản lý dự án | **Quản lý thành viên dự án** Quản lý dự án phải thêm hoặc loại quản lý, điều phối viên, QC và thành viên liên quan vào dự án.  *Truy vết BRD: PRJ-05* | Người bị loại không tiếp tục truy cập dữ liệu mới của dự án, nhưng hành động lịch sử của họ vẫn được giữ. |
| **PRJ-SRS-006 Must** | Hệ thống | **Kiểm soát truy cập dự án** Hệ thống phải dùng vai trò và quan hệ thành viên dự án để giới hạn danh sách, chi tiết và thao tác trên dự án.  *Truy vết BRD: PRJ-05, IAM-05* | Người dùng không thể truy cập dự án ngoài phạm vi bằng cách sửa tham số; quyền quản trị ngoại lệ phải được audit. |
| **PRJ-SRS-007 Must** | Quản trị viên | **Quản lý vòng đời dữ liệu nền** Danh mục loại công việc, kỹ năng, khu vực và các dữ liệu nền đã phát sinh giao dịch phải hỗ trợ trạng thái hoạt động/ngừng hoạt động.  *Truy vết BRD: PRJ-02, PRJ-03* | Không xóa cứng dữ liệu đang được tham chiếu; danh sách chọn chỉ hiển thị bản ghi còn hoạt động cho giao dịch mới. |
| **PRJ-SRS-008 Should** | Điều phối viên | **Quản lý mẫu công việc** Điều phối viên nên có thể tạo mẫu gồm mô tả, thời lượng dự kiến, kỹ năng và checklist để dùng khi tạo Work Order.  *Truy vết BRD: PRJ-04* | Sửa mẫu không thay đổi Work Order đã tạo; người dùng có thể chỉnh dữ liệu sau khi áp dụng mẫu. |
| **PRJ-SRS-009 Should** | Quản lý dự án | **Quản lý tài liệu đính kèm cơ bản** Người có quyền nên có thể tải lên, xem, tải xuống và ngừng sử dụng tệp gắn với dự án hoặc Work Order.  *Truy vết BRD: PRJ-06* | Giới hạn loại/kích thước tệp được kiểm tra; không bao gồm cây thư mục, chia sẻ công khai hoặc versioning phức tạp. |

## **7.4. JOB - Work Order và điều phối kết hợp**

| Tổng yêu cầu | 22 |
| --- | --- |
| Phân bố ưu tiên | Must: 19; Should: 3 |
| Use case liên quan | UC-03, UC-04, UC-05 |

*Quản lý toàn bộ vòng đời công việc, bao gồm phân công trực tiếp và worker tự nhận việc.*

| **Mã / Ưu tiên** | **Tác nhân** | **Yêu cầu phần mềm** | **Điều kiện nghiệm thu, quy tắc và ngoại lệ** |
| --- | --- | --- | --- |
| **JOB-SRS-001 Must** | Điều phối viên | **Tạo Work Order nháp** Điều phối viên phải tạo Work Order gắn với dự án, khu vực/hạng mục, loại công việc, mô tả, ưu tiên, thời hạn và yêu cầu kỹ năng.  *Truy vết BRD: JOB-01* | Thiếu dữ liệu bắt buộc chỉ cho lưu Nháp; Work Order nháp chưa được phân công hoặc hiển thị trên Job Board. |
| **JOB-SRS-002 Must** | Hệ thống | **Kiểm tra điều kiện công bố** Trước khi phân công hoặc mở Job Board, hệ thống phải kiểm tra dự án còn hoạt động, loại công việc hợp lệ, lịch và dữ liệu bắt buộc.  *Truy vết BRD: JOB-01, JOB-03* | Mọi điều kiện chưa đạt được liệt kê cụ thể; không tạo assignment một phần khi kiểm tra thất bại. |
| **JOB-SRS-003 Must** | Điều phối viên | **Cập nhật Work Order** Điều phối viên phải cập nhật mô tả, ưu tiên, thời hạn, hướng dẫn và dữ liệu được phép khi trạng thái cho phép.  *Truy vết BRD: JOB-02* | Thay đổi lịch, kỹ năng hoặc người thực hiện phải gửi thông báo và lưu giá trị trước/sau; dữ liệu bị khóa sau hoàn tất chỉ sửa qua quy trình ngoại lệ. |
| **JOB-SRS-004 Must** | Điều phối viên | **Mở và đóng Job Board** Điều phối viên phải công bố Work Order còn trống lên Job Board, xác định thời gian nhận việc và đóng khỏi danh sách khi cần.  *Truy vết BRD: JOB-03* | Chỉ Work Order đủ điều kiện, chưa có assignee và chưa hủy mới được mở; đóng Job Board không tự hủy assignment đã tồn tại. |
| **JOB-SRS-005 Must** | Worker | **Xem Job Board** Worker phải xem danh sách công việc còn trống mà mình được phép truy cập.  *Truy vết BRD: JOB-05* | Danh sách loại trừ việc đã có người nhận, hết cửa sổ đăng ký, không đúng trạng thái hoặc ngoài phạm vi dự án được phép. |
| **JOB-SRS-006 Must** | Worker | **Tìm kiếm và lọc Job Board** Worker phải lọc công việc theo ngày, dự án, khu vực, loại công việc và kỹ năng phù hợp.  *Truy vết BRD: JOB-05* | Bộ lọc kết hợp cho kết quả nhất quán; làm mới danh sách phản ánh trạng thái hiện tại của công việc. |
| **JOB-SRS-007 Must** | Worker | **Xem chi tiết công việc còn trống** Trước khi nhận việc, worker phải xem được thời gian, địa điểm, mô tả, yêu cầu kỹ năng, checklist liên quan và hướng dẫn cần thiết.  *Truy vết BRD: JOB-05* | Thông tin hiển thị là phiên bản hiện hành; dữ liệu ngoài quyền hoặc dữ liệu cá nhân không cần thiết không được hiển thị. |
| **JOB-SRS-008 Must** | Worker | **Tự nhận công việc** Worker phải có thể chọn Nhận việc và được hệ thống xác nhận ngay khi công việc còn trống và mọi điều kiện đều đạt.  *Truy vết BRD: JOB-06* | Không có bước quản lý phê duyệt lại; assignment được ghi nhận là Đã nhận và công việc xuất hiện trong My Jobs/lịch. |
| **JOB-SRS-009 Must** | Hệ thống | **Kiểm tra điều kiện nhận việc** Hệ thống phải kiểm tra worker đang hoạt động, đúng ngành nghề/kỹ năng, không trùng lịch và chưa vượt giới hạn công việc.  *Truy vết BRD: JOB-07, ORG-05* | Mỗi điều kiện không đạt trả về lý do cụ thể và hành động tiếp theo; không để lại assignment hoặc bản ghi chờ không hợp lệ. |
| **JOB-SRS-010 Must** | Hệ thống | **Bảo đảm một người nhận hợp lệ** Khi nhiều worker nhận cùng một Work Order, hệ thống phải thực hiện kiểm tra và ghi nhận theo cách chỉ một assignment chính được tạo.  *Truy vết BRD: JOB-07* | Một yêu cầu thành công; các yêu cầu còn lại nhận thông báo công việc vừa được người khác nhận; gửi lặp không tạo bản ghi trùng. |
| **JOB-SRS-011 Must** | Hệ thống | **Đồng bộ sau khi tự nhận** Sau khi tự nhận thành công, hệ thống phải loại công việc khỏi Job Board và cập nhật My Jobs, lịch, trạng thái và thông báo liên quan.  *Truy vết BRD: JOB-06, RPT-01* | Các kênh hiển thị cùng một assignee và trạng thái; lỗi cập nhật phụ không làm tạo assignment thứ hai khi thử lại. |
| **JOB-SRS-012 Must** | Điều phối viên | **Phân công trực tiếp** Điều phối viên phải gán Work Order cho worker, đội hoặc nhà thầu phù hợp.  *Truy vết BRD: JOB-04, JOB-07* | Trước khi gán phải kiểm tra trạng thái hoạt động, năng lực và lịch như luồng tự nhận; assignment ghi nguồn Phân công trực tiếp. |
| **JOB-SRS-013 Must** | Điều phối viên | **Tái phân công và thu hồi** Điều phối viên phải thay hoặc thu hồi người thực hiện khi trạng thái cho phép.  *Truy vết BRD: JOB-04, JOB-12* | Bắt buộc nhập lý do; giữ assignee trước, thời điểm và người thao tác; công việc được đưa về trạng thái thích hợp và các bên nhận thông báo. |
| **JOB-SRS-014 Should** | Worker | **Tiếp nhận hoặc từ chối việc được giao** Đối với chính sách yêu cầu xác nhận, worker nên có thể tiếp nhận hoặc từ chối assignment trực tiếp kèm lý do.  *Truy vết BRD: JOB-08* | Từ chối đưa công việc về danh sách cần điều phối; luồng này không áp dụng cho tự nhận đã xác nhận ngay. |
| **JOB-SRS-015 Should** | Worker/Điều phối viên | **Hủy hoặc bỏ việc** Worker hoặc điều phối viên nên có thể hủy assignment theo điều kiện cho phép và cung cấp lý do.  *Truy vết BRD: JOB-09, JOB-12* | Không cho hủy âm thầm sau khi công việc bị khóa; công việc có thể mở lại nếu còn hợp lệ; lịch sử và thông báo được cập nhật. |
| **JOB-SRS-016 Must** | Worker | **Xem My Jobs và việc hôm nay** Worker phải xem danh sách việc đã được giao hoặc tự nhận, phân nhóm Hôm nay, Sắp tới, Đang thực hiện và Đã hoàn tất.  *Truy vết BRD: JOB-06, SCH-02* | Danh sách phản ánh thay đổi lịch, hủy, thu hồi và tái phân công; chỉ hiển thị công việc thuộc assignment hợp lệ của worker. |
| **JOB-SRS-017 Must** | Worker | **Xem chi tiết và hành động khả dụng** Worker phải xem chi tiết Work Order, lịch, checklist, tiến độ, bằng chứng và hành động tiếp theo phù hợp trạng thái.  *Truy vết BRD: JOB-10, JOB-11* | Hệ thống không hiển thị hoặc thực hiện hành động không hợp lệ; thông báo lý do khi trạng thái thay đổi trong lúc người dùng đang xem. |
| **JOB-SRS-018 Should** | Worker | **Bắt đầu, tạm dừng và tiếp tục** Worker nên có thể bắt đầu, tạm dừng và tiếp tục công việc theo quy tắc trạng thái.  *Truy vết BRD: JOB-09, QUA-03* | Bắt đầu bị chặn khi checklist bắt buộc chưa đạt; tạm dừng yêu cầu lý do; mỗi mốc lưu thời điểm và người thao tác. |
| **JOB-SRS-019 Must** | Worker | **Cập nhật tiến độ và nhật ký** Worker phải cập nhật phần trăm hoặc mốc tiến độ, ghi chú hiện trường, vấn đề phát sinh và ảnh bằng chứng.  *Truy vết BRD: JOB-10, QUA-05* | Tiến độ nằm trong phạm vi hợp lệ; mỗi lần cập nhật có người/thời điểm; upload thất bại hiển thị trạng thái và cho phép thử lại. |
| **JOB-SRS-020 Must** | Worker | **Gửi yêu cầu hoàn thành** Worker phải gửi Work Order sang Chờ kiểm tra sau khi hoàn tất phần việc và dữ liệu bắt buộc.  *Truy vết BRD: JOB-11* | Hệ thống hiển thị tóm tắt mục còn thiếu; checklist chặn hoặc dữ liệu bắt buộc chưa đạt không cho gửi; thao tác gửi chống bấm lặp. |
| **JOB-SRS-021 Must** | QC/Quản lý dự án | **Phê duyệt hoặc yêu cầu làm lại** Người có quyền phải xác nhận đạt hoặc trả Work Order về Cần làm lại với nội dung khắc phục.  *Truy vết BRD: JOB-12, QUA-06, QUA-07* | Kết luận phải gắn người, thời điểm, lý do và bằng chứng khi áp dụng; Work Order chỉ Hoàn thành khi mọi điều kiện chất lượng đạt. |
| **JOB-SRS-022 Must** | Hệ thống/Người có quyền | **Lịch sử trạng thái công việc** Hệ thống phải lưu và hiển thị timeline các lần tạo, công bố, nhận/phân công, đổi lịch, bắt đầu, cập nhật, gửi kiểm tra, làm lại và hoàn thành.  *Truy vết BRD: JOB-12, RPT-05* | Mỗi mục có trạng thái trước/sau, actor, thời điểm và lý do khi bắt buộc; người dùng thông thường không sửa lịch sử. |

## **7.5. SCH - Lịch và tiến độ**

| Tổng yêu cầu | 7 |
| --- | --- |
| Phân bố ưu tiên | Must: 4; Should: 3 |
| Use case liên quan | UC-03, UC-04, UC-05, UC-08 |

*Lập lịch, hiển thị lịch, đối chiếu xung đột và tổng hợp tiến độ.*

| **Mã / Ưu tiên** | **Tác nhân** | **Yêu cầu phần mềm** | **Điều kiện nghiệm thu, quy tắc và ngoại lệ** |
| --- | --- | --- | --- |
| **SCH-SRS-001 Must** | Điều phối viên | **Lập và cập nhật lịch công việc** Điều phối viên phải thiết lập ngày/giờ bắt đầu, thời lượng dự kiến và hạn hoàn thành cho Work Order.  *Truy vết BRD: SCH-01* | Thời gian bắt đầu trước thời gian kết thúc; thay đổi sau phân công lưu lịch cũ và gửi thông báo cho người liên quan. |
| **SCH-SRS-002 Must** | Các vai trò liên quan | **Xem lịch ngày/tuần/tháng** Web phải hiển thị lịch ngày, tuần hoặc tháng theo phạm vi quyền và cho phép mở chi tiết công việc.  *Truy vết BRD: SCH-02* | Lịch phản ánh trạng thái hiện tại; công việc hủy được phân biệt rõ; múi giờ hiển thị nhất quán. |
| **SCH-SRS-003 Must** | Worker | **Xem Hôm nay và Sắp tới trên Mobile** Mobile phải hiển thị công việc theo thời gian, trạng thái và hành động tiếp theo trong ngày hoặc thời gian sắp tới.  *Truy vết BRD: SCH-02, JOB-10* | Đổi lịch, hủy hoặc thu hồi cập nhật sau khi làm mới; công việc không còn assignment không hiển thị như đang thực hiện. |
| **SCH-SRS-004 Must** | Hệ thống | **Đối chiếu lịch khi nhận/phân công** Hệ thống phải so sánh khoảng thời gian Work Order với các assignment đang hoạt động của worker/đội trước khi nhận hoặc phân công.  *Truy vết BRD: SCH-01, JOB-07* | So sánh theo khoảng thời gian, không chỉ theo ngày; kết quả được dùng trong JOB-SRS-009 và JOB-SRS-012. |
| **SCH-SRS-005 Should** | Điều phối viên | **Cảnh báo trùng lịch và quá tải** Hệ thống nên cảnh báo hoặc chặn khi một người/đội có công việc giao nhau hoặc vượt giới hạn được cấu hình.  *Truy vết BRD: SCH-03* | Ghi đè nếu được phép phải có quyền và lý do; phiên bản đầu không tự tối ưu hoặc tự sắp xếp lịch. |
| **SCH-SRS-006 Should** | Quản lý dự án | **So sánh kế hoạch và thực tế** Hệ thống nên hiển thị thời điểm dự kiến và thực tế để nhận biết bắt đầu muộn, kéo dài hoặc hoàn thành trễ.  *Truy vết BRD: SCH-04* | Sai lệch truy được tới Work Order và lịch sử thay đổi; không tự sửa kế hoạch từ dữ liệu thực tế. |
| **SCH-SRS-007 Should** | Quản lý dự án | **Tổng hợp tiến độ dự án** Hệ thống nên tổng hợp tỷ lệ công việc theo trạng thái, dự án, khu vực và người thực hiện.  *Truy vết BRD: SCH-05, RPT-03* | Công thức baseline là số Work Order hoàn thành trên tổng Work Order hợp lệ; phải hiển thị thời điểm cập nhật và cho phép drill-down. |

## **7.6. QUA - Checklist và kiểm soát chất lượng**

| Tổng yêu cầu | 12 |
| --- | --- |
| Phân bố ưu tiên | Must: 12; Should: 0 |
| Use case liên quan | UC-05, UC-06 |

*Chuẩn hóa checklist, kiểm tra, khắc phục và tái kiểm tra cho đến khi đạt.*

| **Mã / Ưu tiên** | **Tác nhân** | **Yêu cầu phần mềm** | **Điều kiện nghiệm thu, quy tắc và ngoại lệ** |
| --- | --- | --- | --- |
| **QUA-SRS-001 Must** | Quản trị viên/QC | **Tạo mẫu checklist** Người có quyền phải tạo mẫu checklist gồm tên, nhóm tiêu chí, loại câu trả lời, hướng dẫn và cờ bắt buộc.  *Truy vết BRD: QUA-01* | Mẫu phải có trạng thái Nháp/Hoạt động/Ngừng hoạt động; mẫu đã dùng không bị sửa làm thay đổi kết quả lịch sử. |
| **QUA-SRS-002 Must** | QC/Điều phối viên | **Gán checklist và lưu phiên bản áp dụng** Hệ thống phải gán checklist theo loại công việc, dự án hoặc giai đoạn và lưu phiên bản áp dụng cho từng Work Order.  *Truy vết BRD: QUA-02* | Công việc biết rõ checklist trước bắt đầu và checklist nghiệm thu; thay đổi mẫu chỉ áp dụng theo quy tắc phiên bản. |
| **QUA-SRS-003 Must** | Worker | **Thực hiện checklist trước khi bắt đầu** Worker phải trả lời các mục chuẩn bị/an toàn được yêu cầu trước khi bắt đầu công việc.  *Truy vết BRD: QUA-03* | Mục chặn chưa đạt không cho bắt đầu; lưu câu trả lời, người thực hiện và thời điểm; cho phép đính kèm ảnh khi cấu hình. |
| **QUA-SRS-004 Must** | QC | **Xem hàng đợi kiểm tra** QC phải xem danh sách Work Order Chờ kiểm tra trong phạm vi được giao hoặc được phép.  *Truy vết BRD: QUA-04* | Danh sách có dự án, địa điểm, người thực hiện, thời điểm gửi và trạng thái; QC không thấy dự án ngoài phạm vi. |
| **QUA-SRS-005 Must** | QC | **Thực hiện kiểm tra chất lượng** QC phải mở phiếu kiểm tra và ghi kết quả cho từng tiêu chí theo mẫu áp dụng.  *Truy vết BRD: QUA-04* | Mọi mục bắt buộc phải có kết quả trước khi kết luận; chỉ QC có quyền mới được gửi kết luận. |
| **QUA-SRS-006 Must** | Worker/QC | **Quản lý bằng chứng kiểm tra** Người có quyền phải chụp hoặc tải ảnh và ghi chú gắn với tiêu chí, lỗi, khắc phục hoặc lần kiểm tra.  *Truy vết BRD: QUA-05* | Bằng chứng gắn đúng Work Order, vòng kiểm tra, người gửi và thời điểm; kiểm tra loại/kích thước; không bắt buộc video. |
| **QUA-SRS-007 Must** | QC | **Kết luận đạt hoặc không đạt** QC phải kết luận kiểm tra Đạt hoặc Không đạt sau khi hoàn thành các tiêu chí.  *Truy vết BRD: QUA-06* | Kết luận Không đạt phải có ít nhất một hạng mục lỗi; kết luận Đạt chỉ hợp lệ khi không còn tiêu chí chặn chưa đạt. |
| **QUA-SRS-008 Must** | QC | **Tạo yêu cầu khắc phục** Với mỗi hạng mục không đạt, QC phải ghi mô tả lỗi, mức độ, người chịu trách nhiệm, hạn khắc phục và bằng chứng khi cần.  *Truy vết BRD: QUA-06* | Hạng mục có trạng thái riêng; Work Order chuyển Cần làm lại và không được hoàn tất. |
| **QUA-SRS-009 Must** | Worker/Đội thi công | **Nộp kết quả khắc phục** Người chịu trách nhiệm phải xem lỗi, cập nhật nội dung đã sửa và nộp ảnh/ghi chú chứng minh khắc phục.  *Truy vết BRD: QUA-07* | Chỉ được cập nhật lỗi thuộc assignment; nộp khắc phục chuyển lỗi sang chờ tái kiểm tra và giữ lịch sử trước đó. |
| **QUA-SRS-010 Must** | QC | **Tái kiểm tra** QC phải kiểm tra lại từng hạng mục đã nộp khắc phục và xác nhận đạt hoặc tiếp tục không đạt.  *Truy vết BRD: QUA-07* | Mỗi vòng có thời điểm, người kiểm tra, kết quả và bằng chứng riêng; không ghi đè vòng trước. |
| **QUA-SRS-011 Must** | Hệ thống | **Điều kiện hoàn tất theo chất lượng** Hệ thống chỉ cho Work Order Hoàn thành khi checklist bắt buộc, kết luận kiểm tra và mọi hạng mục khắc phục đều đạt.  *Truy vết BRD: JOB-12, QUA-06, QUA-07* | Xử lý lại hoặc gửi lặp không tạo hai lần hoàn tất; trường hợp ngoại lệ cần quyền và lý do được audit. |
| **QUA-SRS-012 Must** | Quản lý dự án/QC | **Lịch sử chất lượng** Người có quyền phải xem timeline các vòng kiểm tra, lỗi, khắc phục, tái kiểm tra và kết luận cuối.  *Truy vết BRD: QUA-07, RPT-05* | Lịch sử không cho sửa trực tiếp; mỗi dữ liệu truy được tới Work Order, tiêu chí, actor và thời điểm. |

## **7.7. MAT - Yêu cầu vật tư**

| Tổng yêu cầu | 8 |
| --- | --- |
| Phân bố ưu tiên | Must: 5; Should: 3 |
| Use case liên quan | UC-07 |

*Theo dõi nhu cầu vật tư gắn với công việc ở mức yêu cầu, phê duyệt và tiếp nhận đơn giản.*

| **Mã / Ưu tiên** | **Tác nhân** | **Yêu cầu phần mềm** | **Điều kiện nghiệm thu, quy tắc và ngoại lệ** |
| --- | --- | --- | --- |
| **MAT-SRS-001 Must** | Quản trị viên/Kho | **Quản lý danh mục vật tư** Hệ thống phải quản lý mã, tên, nhóm, đơn vị tính và trạng thái sử dụng của vật tư.  *Truy vết BRD: MAT-01* | Mã vật tư duy nhất; bản ghi đã dùng chỉ được ngừng hoạt động; phạm vi không quản lý tồn kho hoặc giá mua. |
| **MAT-SRS-002 Must** | Worker/Điều phối viên | **Tạo yêu cầu vật tư** Người có quyền phải tạo yêu cầu vật tư gắn với dự án hoặc Work Order, gồm vật tư, số lượng, lý do và thời điểm cần.  *Truy vết BRD: MAT-02* | Không gửi phê duyệt nếu thiếu đối tượng liên kết, vật tư hoạt động hoặc số lượng dương; người tạo xem được mã và trạng thái yêu cầu. |
| **MAT-SRS-003 Must** | Người tạo yêu cầu | **Xem và hủy yêu cầu chưa xử lý** Người tạo phải xem chi tiết, timeline và có thể hủy yêu cầu khi còn ở trạng thái Nháp hoặc Chờ duyệt.  *Truy vết BRD: MAT-02, MAT-03* | Hủy yêu cầu cần lý do; không cho hủy sau khi đã phê duyệt và chuyển cung ứng; lịch sử vẫn được giữ. |
| **MAT-SRS-004 Must** | Quản lý dự án | **Phê duyệt hoặc từ chối** Quản lý dự án phải xem yêu cầu và phê duyệt hoặc từ chối kèm lý do.  *Truy vết BRD: MAT-03, RPT-01* | Chỉ xử lý yêu cầu Chờ duyệt; quyết định chống bấm lặp và lưu người/thời điểm; người tạo nhận thông báo. |
| **MAT-SRS-005 Must** | Hệ thống | **Liên kết vật tư với công việc** Mỗi yêu cầu phải giữ liên kết đến dự án/Work Order và hiển thị trong chi tiết công việc cho các vai trò được phép.  *Truy vết BRD: MAT-02, MAT-03* | Thay đổi trạng thái yêu cầu không làm thay đổi trạng thái Work Order trừ khi checklist/quy tắc chặn được cấu hình. |
| **MAT-SRS-006 Should** | Kho/Mua hàng | **Theo dõi trạng thái cung ứng** Người phụ trách nên cập nhật yêu cầu đã duyệt qua Đang chuẩn bị, Đang giao và Đã giao.  *Truy vết BRD: MAT-04* | Chuyển trạng thái đúng thứ tự; lưu người/thời điểm; không bao gồm đơn mua, giá hoặc quản lý nhà cung cấp chi tiết. |
| **MAT-SRS-007 Should** | Worker | **Xác nhận tiếp nhận vật tư** Worker nên xác nhận số lượng thực nhận và thời điểm nhận đối với yêu cầu đã giao.  *Truy vết BRD: MAT-05* | Số lượng không âm; cho phép ghi nhận thiếu/hỏng; xác nhận không cập nhật tồn kho vì tồn kho ngoài phạm vi. |
| **MAT-SRS-008 Should** | Worker/Kho | **Ghi nhận sai lệch khi nhận** Người nhận nên ghi chú, số lượng thiếu/hỏng và ảnh bằng chứng để người phụ trách xử lý.  *Truy vết BRD: MAT-05, QUA-05* | Sai lệch giữ liên kết yêu cầu và vật tư; không ghi đè số lượng đã xác nhận trước mà không có lịch sử. |

## **7.8. RPT - Thông báo, báo cáo và truy vết**

| Tổng yêu cầu | 8 |
| --- | --- |
| Phân bố ưu tiên | Must: 7; Should: 1 |
| Use case liên quan | UC-08 |

*Cung cấp thông tin kịp thời, dashboard có thể drill-down và lịch sử thao tác.*

| **Mã / Ưu tiên** | **Tác nhân** | **Yêu cầu phần mềm** | **Điều kiện nghiệm thu, quy tắc và ngoại lệ** |
| --- | --- | --- | --- |
| **RPT-SRS-001 Must** | Hệ thống | **Tạo thông báo nghiệp vụ** Hệ thống phải tạo thông báo trong ứng dụng khi được giao việc, tự nhận thành công, lịch thay đổi, bị thu hồi, cần làm lại hoặc có quyết định vật tư.  *Truy vết BRD: RPT-01* | Thông báo nhắm đúng người, không tạo trùng khi tác vụ được thử lại và chứa đối tượng nguồn. |
| **RPT-SRS-002 Must** | Người dùng | **Hộp thông báo** Người dùng phải xem danh sách thông báo, số chưa đọc, đánh dấu đã đọc và đánh dấu tất cả đã đọc.  *Truy vết BRD: RPT-02* | Trạng thái chưa đọc đồng bộ giữa các lần truy cập; xóa khỏi hộp cá nhân không xóa lịch sử nghiệp vụ nguồn. |
| **RPT-SRS-003 Must** | Hệ thống/Người dùng | **Mở đúng ngữ cảnh từ thông báo** Khi người dùng chọn thông báo, hệ thống phải mở đúng Work Order, kiểm tra, vật tư hoặc màn hình liên quan.  *Truy vết BRD: RPT-01, RPT-02, IAM-05* | Quyền và trạng thái đối tượng được kiểm tra lại; nếu không còn quyền, hiển thị thông báo phù hợp thay vì lộ dữ liệu. |
| **RPT-SRS-004 Must** | Quản lý dự án/Điều phối viên | **Dashboard điều hành** Web phải hiển thị các chỉ số cố định về công việc theo trạng thái, chưa có người nhận, trễ hạn, đang làm lại, kết quả kiểm tra và yêu cầu vật tư.  *Truy vết BRD: RPT-03, SCH-05* | Mỗi chỉ số có định nghĩa, thời điểm cập nhật và tôn trọng phạm vi dự án/quyền. |
| **RPT-SRS-005 Must** | Người dùng dashboard | **Drill-down từ chỉ số** Người dùng phải mở danh sách bản ghi tạo nên một chỉ số dashboard với cùng bộ lọc và quyền.  *Truy vết BRD: RPT-03* | Tổng ở danh sách chi tiết đối chiếu được với chỉ số; bản ghi không còn quyền không xuất hiện. |
| **RPT-SRS-006 Should** | Người có quyền | **Xuất dữ liệu cơ bản** Người dùng nên xuất danh sách hoặc báo cáo đã được phê duyệt sang định dạng thông dụng.  *Truy vết BRD: RPT-04* | Dữ liệu xuất dùng cùng bộ lọc và quyền; có giới hạn số dòng; không có trình thiết kế báo cáo tùy biến. |
| **RPT-SRS-007 Must** | Hệ thống | **Ghi lịch sử thao tác quan trọng** Hệ thống phải ghi các thay đổi về tài khoản/quyền, phân công, trạng thái, lịch, quyết định QC và phê duyệt vật tư.  *Truy vết BRD: RPT-05, JOB-12, QUA-07* | Bản ghi gồm actor, thời điểm, hành động, đối tượng, kết quả và lý do khi bắt buộc; không chứa mật khẩu hoặc bí mật. |
| **RPT-SRS-008 Must** | Quản trị viên/Quản lý | **Tra cứu lịch sử thao tác** Người có quyền phải lọc lịch sử theo thời gian, người thao tác, loại đối tượng và hành động.  *Truy vết BRD: RPT-05* | Dữ liệu lịch sử chỉ đọc; kết quả tôn trọng quyền; có thể mở đối tượng nguồn khi còn tồn tại và được phép. |

# **8. Trường hợp sử dụng chi tiết**

Use case mô tả các workflow xuyên suốt dùng để thiết kế tương tác và xây dựng kịch bản kiểm thử. Các bước thay thế là một phần bắt buộc của use case.

## **8.1. UC-01 - Đăng nhập và truy cập theo vai trò**

| Thuộc tính | Nội dung |
| --- | --- |
| Tác nhân | Người dùng; Quản trị viên; Hệ thống |
| Mục tiêu | Cho phép người dùng vào đúng phạm vi chức năng và dữ liệu. |
| Kích hoạt | Người dùng mở hệ thống và nhập thông tin đăng nhập. |
| Tiền điều kiện | • Tài khoản đã tồn tại và đang hoạt động. • Người dùng có ít nhất một vai trò hợp lệ. |
| Hậu điều kiện | • Phiên làm việc hợp lệ được tạo. • Menu, dữ liệu và hành động bị giới hạn theo vai trò/dự án. • Sự kiện đăng nhập được ghi nhận. |
| Yêu cầu liên quan | IAM-SRS-001..008; NFR-SEC-001..007 |

### **Luồng chính**

**1.** Người dùng nhập thông tin xác thực.

**2.** Hệ thống kiểm tra tài khoản, trạng thái và thông tin xác thực.

**3.** Hệ thống xác định vai trò và phạm vi dự án.

**4.** Hệ thống tạo phiên và hiển thị trang khởi đầu phù hợp.

### **Luồng thay thế và ngoại lệ**

* Thông tin sai: từ chối và tăng bộ đếm thất bại.
* Tài khoản bị khóa/ngừng hoạt động: từ chối và nêu trạng thái phù hợp.
* Phiên hết hạn: yêu cầu xác thực lại, không mất dữ liệu đã lưu.

## **8.2. UC-02 - Thiết lập dự án và nguồn lực**

| Thuộc tính | Nội dung |
| --- | --- |
| Tác nhân | Quản trị viên; Quản lý dự án; Điều phối viên |
| Mục tiêu | Chuẩn bị dữ liệu dự án, worker/nhà thầu, kỹ năng và thành viên để tạo công việc. |
| Kích hoạt | Khách hàng bắt đầu một dự án hoặc bổ sung nguồn lực. |
| Tiền điều kiện | • Người thao tác có quyền quản trị tương ứng. |
| Hậu điều kiện | • Dự án, khu vực/hạng mục, loại công việc và nguồn lực có trạng thái hợp lệ. • Thành viên dự án được cấp đúng phạm vi truy cập. |
| Yêu cầu liên quan | ORG-SRS-001..008; PRJ-SRS-001..009 |

### **Luồng chính**

**1.** Quản trị viên tạo/cập nhật worker, nhà thầu và kỹ năng.

**2.** Quản lý dự án tạo dự án và khu vực/hạng mục.

**3.** Quản trị viên/điều phối viên cấu hình loại công việc.

**4.** Quản lý dự án thêm thành viên và QC.

**5.** Hệ thống kiểm tra dữ liệu duy nhất và trạng thái hoạt động.

### **Luồng thay thế và ngoại lệ**

* Dữ liệu nền đã được dùng: chỉ cho ngừng hoạt động, không xóa cứng.
* Dự án đóng: không tạo Work Order mới cho đến khi được mở lại.

## **8.3. UC-03 - Tạo, lập lịch và phân công trực tiếp**

| Thuộc tính | Nội dung |
| --- | --- |
| Tác nhân | Điều phối viên; Worker/Đội/Nhà thầu; Hệ thống |
| Mục tiêu | Tạo Work Order hợp lệ và giao trực tiếp cho nguồn lực phù hợp. |
| Kích hoạt | Điều phối viên nhận nhu cầu công việc trong dự án. |
| Tiền điều kiện | • Dự án đang hoạt động. • Loại công việc và nguồn lực hợp lệ. |
| Hậu điều kiện | • Work Order được lập lịch và có assignment chính. • Người nhận thấy việc trong My Jobs/lịch và nhận thông báo. |
| Yêu cầu liên quan | JOB-SRS-001..004, 012..017, 022; SCH-SRS-001..005; RPT-SRS-001 |

### **Luồng chính**

**1.** Điều phối viên tạo Work Order nháp.

**2.** Điều phối viên nhập lịch và dữ liệu bắt buộc.

**3.** Hệ thống kiểm tra điều kiện công bố.

**4.** Điều phối viên chọn worker/đội/nhà thầu.

**5.** Hệ thống kiểm tra trạng thái, kỹ năng và xung đột lịch.

**6.** Hệ thống tạo assignment, cập nhật trạng thái/lịch và gửi thông báo.

### **Luồng thay thế và ngoại lệ**

* Nguồn lực không đủ điều kiện: hiển thị lý do, không tạo assignment.
* Nếu chính sách yêu cầu xác nhận, worker tiếp nhận hoặc từ chối.
* Tái phân công: bắt buộc lý do và giữ lịch sử người trước.

## **8.4. UC-04 - Worker tự nhận việc trên Job Board**

| Thuộc tính | Nội dung |
| --- | --- |
| Tác nhân | Worker; Hệ thống |
| Mục tiêu | Cho worker đủ điều kiện nhận ngay công việc còn trống mà không chờ quản lý duyệt lại. |
| Kích hoạt | Worker mở Job Board và chọn Nhận việc. |
| Tiền điều kiện | • Worker đăng nhập, đang hoạt động và có quyền Job Board. • Work Order đang Mở/Khả dụng trong cửa sổ đăng ký. |
| Hậu điều kiện | • Một assignment duy nhất được ghi nhận là Đã nhận. • Work Order xuất hiện trong My Jobs/lịch của worker. • Công việc biến mất khỏi Job Board của người khác. |
| Yêu cầu liên quan | JOB-SRS-004..011, 016..017; SCH-SRS-004; NFR-PERF-003; NFR-REL-001..002 |

### **Luồng chính**

**1.** Worker xem và lọc Job Board.

**2.** Worker mở chi tiết công việc.

**3.** Worker chọn Nhận việc.

**4.** Hệ thống kiểm tra trạng thái, kỹ năng, lịch và giới hạn việc.

**5.** Hệ thống xác nhận Work Order vẫn còn trống và tạo assignment trong cùng giao dịch.

**6.** Hệ thống cập nhật My Jobs/lịch và gửi thông báo.

### **Luồng thay thế và ngoại lệ**

* Không đủ điều kiện: nêu lý do cụ thể và không tạo dữ liệu một phần.
* Nhiều worker nhận đồng thời: chỉ một người thành công; người còn lại thấy việc đã được nhận.
* Gửi lại do mất mạng: trả về kết quả hiện tại, không tạo assignment thứ hai.

## **8.5. UC-05 - Thực hiện và gửi hoàn thành công việc**

| Thuộc tính | Nội dung |
| --- | --- |
| Tác nhân | Worker; Hệ thống; Điều phối viên |
| Mục tiêu | Ghi nhận đầy đủ quá trình thực hiện và chuyển công việc sang chờ kiểm tra. |
| Kích hoạt | Worker mở một Work Order trong My Jobs. |
| Tiền điều kiện | • Assignment còn hiệu lực. • Work Order chưa hủy/hoàn thành. |
| Hậu điều kiện | • Tiến độ, nhật ký và bằng chứng được lưu. • Work Order ở Chờ kiểm tra nếu mọi điều kiện gửi đã đạt. |
| Yêu cầu liên quan | JOB-SRS-016..020; QUA-SRS-002..003, 006; NFR-REL-003 |

### **Luồng chính**

**1.** Worker xem chi tiết và checklist.

**2.** Worker hoàn thành checklist trước bắt đầu.

**3.** Worker bắt đầu công việc.

**4.** Worker cập nhật tiến độ, ghi chú, vấn đề và ảnh.

**5.** Worker xem tóm tắt dữ liệu bắt buộc.

**6.** Worker gửi yêu cầu hoàn thành.

**7.** Hệ thống khóa dữ liệu theo quyền và chuyển Chờ kiểm tra.

### **Luồng thay thế và ngoại lệ**

* Checklist chưa đạt: chặn bắt đầu hoặc gửi và chỉ rõ mục thiếu.
* Upload lỗi: giữ dữ liệu hợp lệ và cho phép thử lại.
* Công việc bị thu hồi/hủy trong lúc mở: từ chối thao tác mới và làm mới trạng thái.

## **8.6. UC-06 - Kiểm tra chất lượng, khắc phục và tái kiểm tra**

| Thuộc tính | Nội dung |
| --- | --- |
| Tác nhân | QC; Worker/Đội thi công; Quản lý dự án; Hệ thống |
| Mục tiêu | Đánh giá chất lượng có cấu trúc và lặp lại đến khi mọi điều kiện bắt buộc đạt. |
| Kích hoạt | Work Order được gửi sang Chờ kiểm tra. |
| Tiền điều kiện | • QC có quyền hoặc được phân công. • Checklist nghiệm thu đúng phiên bản đã được gắn. |
| Hậu điều kiện | • Nếu đạt, Work Order Hoàn thành. • Nếu không đạt, các lỗi và vòng khắc phục/tái kiểm tra được lưu đầy đủ. |
| Yêu cầu liên quan | QUA-SRS-004..012; JOB-SRS-021..022; RPT-SRS-001, 007 |

### **Luồng chính**

**1.** QC mở hàng đợi kiểm tra và chọn Work Order.

**2.** QC đánh giá từng tiêu chí, thêm ảnh/ghi chú.

**3.** Nếu có lỗi, QC tạo hạng mục khắc phục và kết luận Không đạt.

**4.** Worker xem lỗi, sửa và nộp bằng chứng.

**5.** QC tái kiểm tra từng hạng mục.

**6.** Khi tất cả đạt, QC kết luận Đạt.

**7.** Hệ thống kiểm tra quality gate và hoàn tất Work Order.

### **Luồng thay thế và ngoại lệ**

* Khắc phục chưa đạt: tạo vòng tiếp theo, không ghi đè vòng cũ.
* Thiếu tiêu chí bắt buộc: không cho gửi kết luận.
* Ngoại lệ chất lượng: chỉ người có quyền, bắt buộc lý do và audit.

## **8.7. UC-07 - Yêu cầu, phê duyệt và tiếp nhận vật tư**

| Thuộc tính | Nội dung |
| --- | --- |
| Tác nhân | Worker/Điều phối viên; Quản lý dự án; Kho/Mua hàng; Hệ thống |
| Mục tiêu | Theo dõi nhu cầu vật tư gắn với công việc mà không mở rộng thành quản lý kho đầy đủ. |
| Kích hoạt | Worker hoặc điều phối viên phát hiện nhu cầu vật tư. |
| Tiền điều kiện | • Dự án/Work Order hợp lệ. • Vật tư đang hoạt động. |
| Hậu điều kiện | • Yêu cầu có quyết định và timeline rõ. • Nếu triển khai Should, trạng thái cung ứng/tiếp nhận được cập nhật. |
| Yêu cầu liên quan | MAT-SRS-001..008; RPT-SRS-001 |

### **Luồng chính**

**1.** Người dùng tạo yêu cầu với vật tư, số lượng, lý do và thời điểm cần.

**2.** Hệ thống kiểm tra dữ liệu và gửi Chờ duyệt.

**3.** Quản lý dự án phê duyệt hoặc từ chối kèm lý do.

**4.** Hệ thống thông báo người tạo.

**5.** Kho/Mua hàng cập nhật trạng thái cung ứng nếu chức năng được triển khai.

**6.** Worker xác nhận tiếp nhận và sai lệch nếu chức năng được triển khai.

### **Luồng thay thế và ngoại lệ**

* Người tạo hủy khi Nháp/Chờ duyệt.
* Yêu cầu đã xử lý không được phê duyệt lần hai.
* Thiếu/hỏng được ghi nhận nhưng không làm thay đổi tồn kho.

## **8.8. UC-08 - Theo dõi dashboard, thông báo và lịch sử**

| Thuộc tính | Nội dung |
| --- | --- |
| Tác nhân | Quản lý dự án; Điều phối viên; Quản trị viên; Người dùng |
| Mục tiêu | Cung cấp thông tin điều hành có thể truy đến dữ liệu nguồn và thông báo đúng ngữ cảnh. |
| Kích hoạt | Người dùng mở Dashboard, Hộp thông báo hoặc Lịch sử thao tác. |
| Tiền điều kiện | • Người dùng có quyền tương ứng. |
| Hậu điều kiện | • Chỉ số, danh sách nguồn và lịch sử được hiển thị theo phạm vi quyền. |
| Yêu cầu liên quan | RPT-SRS-001..008; SCH-SRS-007; NFR-PERF-004 |

### **Luồng chính**

**1.** Hệ thống tổng hợp chỉ số theo trạng thái và dự án.

**2.** Người dùng chọn một chỉ số để drill-down.

**3.** Hệ thống áp dụng cùng bộ lọc và quyền cho danh sách chi tiết.

**4.** Người dùng mở thông báo để tới đúng đối tượng.

**5.** Quản trị viên/Quản lý lọc lịch sử theo actor, đối tượng, hành động và thời gian.

### **Luồng thay thế và ngoại lệ**

* Không còn quyền đối tượng: không mở chi tiết và nêu thông báo.
* Dữ liệu lớn: dùng phân trang/lọc.
* Xuất dữ liệu chỉ có khi yêu cầu Should được triển khai và người dùng có quyền.

# **9. Yêu cầu dữ liệu**

## **9.1. Nhóm dữ liệu nghiệp vụ**

| Nhóm | Đối tượng tiêu biểu | Yêu cầu dữ liệu |
| --- | --- | --- |
| Tài khoản và quyền | Người dùng, vai trò, trạng thái, hồ sơ, dự án được tham gia | Duy nhất, trạng thái rõ, lịch sử khóa/ngừng hoạt động. |
| Nguồn lực | Worker, nhà thầu, đội, ngành nghề, kỹ năng | Dùng để kiểm tra khả năng phân công/tự nhận; giữ trạng thái tại thời điểm assignment. |
| Dự án | Dự án, khu vực/hạng mục, thành viên, loại công việc, tệp | Mã rõ, quan hệ toàn vẹn, không mất lịch sử khi đóng/ngừng hoạt động. |
| Công việc | Work Order, lịch, assignment, Job Board, tiến độ, nhật ký, trạng thái | Lưu nguồn assignment, assignee chính và timeline chuyển trạng thái. |
| Chất lượng | Checklist, tiêu chí, kết quả, lỗi, khắc phục, tái kiểm tra, ảnh | Mỗi vòng độc lập, có phiên bản mẫu và bằng chứng. |
| Vật tư | Danh mục, yêu cầu, phê duyệt, cung ứng, xác nhận nhận | Liên kết dự án/Work Order; không chứa dữ liệu tồn kho hoặc giá. |
| Thông báo và audit | Thông báo, trạng thái đọc, lịch sử thao tác | Có đối tượng nguồn; không ghi bí mật; chỉ đọc đối với người dùng thường. |

## **9.2. Quy tắc dữ liệu bắt buộc**

* Mỗi thực thể nghiệp vụ chính phải có mã/định danh duy nhất và trạng thái hiện hành.
* Bản ghi quan trọng phải có thời điểm tạo, người tạo, thời điểm cập nhật và người cập nhật khi áp dụng.
* Thời gian lưu ở dạng nhất quán; giao diện phải hiển thị theo múi giờ đã thống nhất và tránh nhầm lẫn ngày/giờ.
* Assignment phải giữ nguồn tạo, assignee, Work Order, thời gian hiệu lực và trạng thái.
* State transition phải giữ trạng thái trước/sau, actor, thời điểm và lý do khi quy tắc yêu cầu.
* Checklist/phiếu kiểm tra phải giữ phiên bản nội dung áp dụng; sửa mẫu không thay đổi kết quả lịch sử.
* Ảnh/tệp phải lưu loại, kích thước, người tải, thời điểm, đối tượng liên kết và quyền truy cập.
* Dữ liệu đã phát sinh giao dịch ưu tiên ngừng hoạt động hoặc soft delete; hard delete chỉ dùng cho dữ liệu nháp chưa tham chiếu theo chính sách.

## **9.3. Chất lượng dữ liệu**

| Thuộc tính | Yêu cầu |
| --- | --- |
| Đầy đủ | Không chuyển trạng thái khi thiếu trường hoặc bằng chứng bắt buộc. |
| Hợp lệ | Kiểm tra kiểu, phạm vi, ngày/giờ, số lượng và quan hệ trước khi lưu. |
| Nhất quán | Web, Mobile, dashboard và chi tiết phải phản ánh cùng trạng thái/assignee. |
| Duy nhất | Mã dự án, vật tư, tài khoản và assignment chính phải tuân quy tắc duy nhất. |
| Kịp thời | Sau thao tác thành công, dữ liệu liên quan được cập nhật trong thời gian NFR quy định. |
| Truy vết | Quyết định và thay đổi quan trọng truy được đến actor, thời điểm và đối tượng nguồn. |

## **9.4. Lưu trữ và vòng đời**

Thời gian lưu dữ liệu chính thức cần được khách hàng xác nhận. Baseline của đồ án: dữ liệu nghiệp vụ và audit được giữ trong suốt vòng đời phiên bản demo/triển khai; ảnh có thể được dọn theo chính sách sau khi sao lưu và hết nhu cầu nghiệm thu. Dữ liệu xóa khỏi giao diện không được làm mất audit hoặc bằng chứng của Work Order đã hoàn tất.

# **10. Yêu cầu giao diện và tích hợp**

## **10.1. Kênh Web quản trị**

* Thiết kế desktop-first cho quản trị viên, quản lý dự án, điều phối viên, QC và Kho/Mua hàng.
* Menu và hành động hiển thị theo quyền; API/hệ thống vẫn phải kiểm tra lại quyền.
* Danh sách lớn có tìm kiếm, lọc, sắp xếp, phân trang và bảo toàn bộ lọc khi quay lại.
* Biểu mẫu có validation theo trường, trạng thái đang lưu và xác nhận cho thao tác phá hủy/thu hồi.
* Dashboard có chỉ số, thời điểm cập nhật và đường dẫn drill-down tới danh sách nguồn.

## **10.2. Kênh Mobile hiện trường**

* Ưu tiên Job Board, My Jobs/Today Jobs, chi tiết công việc, checklist, tiến độ, ảnh, chất lượng và vật tư.
* Hành động chính có vùng bấm phù hợp, trạng thái loading/success/error rõ và không phụ thuộc duy nhất vào màu.
* Khi mất mạng hoặc gửi thất bại, ứng dụng phải cho biết dữ liệu chưa đồng bộ và cho phép thử lại an toàn.
* Quyền camera/tệp chỉ được yêu cầu khi dùng chức năng liên quan; từ chối quyền không làm ứng dụng crash.

## **10.3. Upload ảnh và tệp**

| Thuộc tính | Baseline |
| --- | --- |
| Loại ảnh | JPEG, PNG, WebP; loại tệp dự án bổ sung theo danh sách được phê duyệt. |
| Kích thước | Tối đa 10 MB mỗi ảnh/tệp trong phiên bản đầu, trừ quyết định khác. |
| Liên kết | Mỗi tệp gắn với dự án, Work Order, checklist, lỗi hoặc yêu cầu vật tư cụ thể. |
| Bảo mật | Chỉ người có quyền đối tượng nguồn được xem/tải; đường dẫn không được dùng để bỏ qua quyền. |
| Phản hồi | Hiển thị tiến trình, thành công/thất bại và cho phép thử lại không tạo tệp trùng ngoài ý muốn. |

## **10.4. Giao tiếp giữa các kênh**

Web và Mobile phải dùng cùng quy tắc nghiệp vụ, trạng thái và dữ liệu nguồn. Hệ thống cung cấp các giao diện dịch vụ cho đăng nhập, truy vấn và thao tác nghiệp vụ; chi tiết endpoint, payload và công nghệ trao đổi được xác định trong tài liệu thiết kế/API sau khi SRS được phê duyệt.

## **10.5. Thông báo**

Phạm vi Must chỉ yêu cầu thông báo trong ứng dụng. Push notification, email hoặc SMS không phải tiêu chí nghiệm thu, trừ khi được bổ sung bằng thay đổi phạm vi. Mỗi thông báo phải có đối tượng nguồn và kiểm tra quyền khi người dùng mở.

# **11. Yêu cầu phi chức năng**

Các baseline dưới đây dùng cho nghiệm thu phiên bản đồ án. Giá trị có thể được thay đổi bằng quyết định phạm vi có ghi nhận, nhưng không được âm thầm giảm sau khi phát triển.

| Mã / Mức | Thuộc tính | Yêu cầu chất lượng |
| --- | --- | --- |
| NFR-PERF-001 Must | Hiệu năng đọc dữ liệu | 95% thao tác mở danh sách, chi tiết và lịch phổ biến phải hoàn tất trong 2 giây dưới tải kiểm thử bình thường, không tính thời gian tải tệp. |
| NFR-PERF-002 Must | Hiệu năng ghi dữ liệu | 95% thao tác tạo/cập nhật thông thường phải phản hồi trong 3 giây; người dùng thấy trạng thái đang xử lý và không thể vô tình gửi lặp. |
| NFR-PERF-003 Must | Tự nhận việc đồng thời | Trong kiểm thử 20 yêu cầu đồng thời cho cùng một Work Order, hệ thống phải trả kết quả trong 3 giây, chỉ một yêu cầu thành công và không tạo assignment trùng. |
| NFR-PERF-004 Must | Dashboard | Dashboard chính phải tải trong 5 giây với bộ dữ liệu nghiệm thu tối thiểu 10.000 Work Order và 50.000 bản ghi lịch sử. |
| NFR-PERF-005 Should | Upload ảnh | Ảnh tối đa 10 MB nên tải thành công trong 15 giây trên kết nối ổn định 10 Mbps; tiến trình và lỗi phải được hiển thị. |
| NFR-SEC-001 Must | Mã hóa truyền tải | Mọi trao đổi có thông tin xác thực hoặc dữ liệu nghiệp vụ phải sử dụng kênh truyền được mã hóa trong môi trường triển khai. |
| NFR-SEC-002 Must | Lưu mật khẩu | Mật khẩu không được lưu hoặc ghi log ở dạng đọc được; cơ chế lưu phải dùng thuật toán băm mật khẩu phù hợp và salt riêng. |
| NFR-SEC-003 Must | Phân quyền phía hệ thống | Mỗi thao tác đọc/ghi phải kiểm tra quyền và phạm vi dự án ở phía hệ thống; không tin cậy dữ liệu quyền từ giao diện. |
| NFR-SEC-004 Must | Kiểm soát đầu vào | Dữ liệu đầu vào phải được kiểm tra kiểu, độ dài, phạm vi và định dạng; tệp phải kiểm tra loại, kích thước và tên tệp an toàn. |
| NFR-SEC-005 Must | Chống lạm dụng đăng nhập | Hệ thống phải giới hạn thử đăng nhập thất bại và khóa tạm thời hoặc áp dụng biện pháp giảm dò quét theo cấu hình. |
| NFR-SEC-006 Must | Bảo vệ nhật ký | Nhật ký không ghi mật khẩu, mã đặt lại, token hoặc dữ liệu nhạy cảm đầy đủ; quyền xem nhật ký chỉ cấp cho vai trò được ủy quyền. |
| NFR-SEC-007 Should | Thời gian phiên | Thời gian hết phiên do không hoạt động nên cấu hình được; baseline đề xuất 60 phút và yêu cầu đăng nhập lại cho thao tác nhạy cảm khi cần. |
| NFR-REL-001 Must | Tính nguyên tử | Tự nhận việc, phân công, chuyển trạng thái và phê duyệt phải hoàn tất toàn bộ hoặc không để lại dữ liệu một phần. |
| NFR-REL-002 Must | Chống gửi lặp | Các thao tác ghi quan trọng phải an toàn khi người dùng bấm nhiều lần hoặc ứng dụng thử lại; cùng yêu cầu không tạo nhiều bản ghi nghiệp vụ. |
| NFR-REL-003 Must | Phục hồi lỗi giao diện | Khi thao tác thất bại, hệ thống hiển thị kết quả rõ; dữ liệu nhập hợp lệ chưa gửi nên được giữ ở mức có thể để người dùng thử lại. |
| NFR-REL-004 Must | Sao lưu | Dữ liệu nghiệm thu và môi trường triển khai phải được sao lưu ít nhất hằng ngày; phải có quy trình khôi phục đã được thử nghiệm. |
| NFR-REL-005 Must | Mục tiêu khôi phục | Baseline RPO không quá 24 giờ và RTO không quá 4 giờ cho môi trường triển khai của đồ án. |
| NFR-USA-001 Must | Luồng Mobile rõ ràng | Sau đăng nhập, worker phải truy cập My Jobs/Job Board trong không quá hai hành động điều hướng chính; hành động tiếp theo của công việc được hiển thị rõ. |
| NFR-USA-002 Must | Thông báo lỗi có thể hành động | Lỗi nghiệp vụ phải nêu nguyên nhân và cách khắc phục; không dùng thông báo chung như “Dữ liệu không hợp lệ” khi có thể xác định trường hoặc quy tắc. |
| NFR-USA-003 Must | Thiết kế thích ứng | Web phải sử dụng được ở độ phân giải 1366x768 trở lên; Mobile phải sử dụng được ở chiều rộng hiển thị từ 360 px mà không mất hành động chính. |
| NFR-USA-004 Must | Khả năng truy cập cơ bản | Web phải hỗ trợ điều hướng bàn phím cho chức năng chính, nhãn biểu mẫu rõ, trạng thái không chỉ truyền đạt bằng màu và độ tương phản đủ đọc. |
| NFR-CMP-001 Must | Trình duyệt Web | Hệ thống Web phải hoạt động trên hai phiên bản ổn định gần nhất của Chrome và Edge; Firefox được kiểm thử cho các luồng chính. |
| NFR-CMP-002 TBD | Nền tảng Mobile | Nền tảng Mobile mục tiêu phải được chốt trước thiết kế chi tiết. Baseline đề xuất Android 10 trở lên; iOS 15 trở lên là phạm vi bổ sung nếu nhóm xác nhận phát hành đa nền tảng. |
| NFR-MNT-001 Must | Khả năng kiểm thử | Business rule về điều kiện nhận việc, state transition, một winner và quality gate phải có unit test; các workflow chính phải có integration test. |
| NFR-MNT-002 Must | Ghi log vận hành | Lỗi hệ thống và thao tác quan trọng phải có mã theo dõi/correlation để đối chiếu giữa yêu cầu, nhật ký và phản hồi người dùng. |
| NFR-MNT-003 Must | Cấu hình môi trường | Thông tin bí mật và cấu hình môi trường phải được quản lý tách khỏi gói phát hành và tài liệu công khai; phải có hướng dẫn cấu hình riêng. |
| NFR-MNT-004 Should | Tài liệu vận hành | Phải có hướng dẫn cài đặt, dữ liệu mẫu, tài khoản demo, mô tả vai trò và kịch bản trình diễn xuyên suốt. |

# **12. Xác minh, kiểm thử và nghiệm thu**

## **12.1. Nguyên tắc nghiệm thu**

* Mọi yêu cầu Must phải có ít nhất một test case hoặc bước demo chứng minh kết quả quan sát được.
* Yêu cầu Should không chặn phát hành nếu chưa triển khai, nhưng phải được đánh dấu rõ trong báo cáo phạm vi.
* Lỗi làm sai assignment, quyền, trạng thái hoặc mất bằng chứng là lỗi nghiêm trọng và phải xử lý trước nghiệm thu.
* Test phải bao gồm luồng chính, ngoại lệ, gửi lặp, đồng thời, quyền và dữ liệu không hợp lệ.
* Dữ liệu demo phải đủ để trình diễn Web và Mobile dùng chung trạng thái và workflow.

## **12.2. Kịch bản nghiệm thu tối thiểu**

| Mã | Tiêu chí nghiệm thu |
| --- | --- |
| AC-01 | Người dùng đăng nhập đúng vai trò và không truy cập chức năng/dự án ngoài quyền. |
| AC-02 | Quản lý tạo được dự án, nguồn lực và Work Order với dữ liệu bắt buộc. |
| AC-03 | Điều phối viên phân công trực tiếp; người nhận thấy việc trong My Jobs/lịch. |
| AC-04 | Điều phối viên mở Job Board; worker đủ điều kiện tự nhận và được xác nhận ngay không chờ duyệt. |
| AC-05 | Hai worker nhận đồng thời không tạo hai assignment chính. |
| AC-06 | Worker không đủ kỹ năng hoặc trùng lịch bị chặn với lý do cụ thể. |
| AC-07 | Worker cập nhật tiến độ, nhật ký, ảnh và gửi Chờ kiểm tra. |
| AC-08 | Checklist bắt buộc chưa đạt chặn bắt đầu hoặc gửi hoàn thành. |
| AC-09 | QC ghi lỗi, giao khắc phục; worker nộp bằng chứng và QC tái kiểm tra. |
| AC-10 | Work Order chỉ Hoàn thành khi mọi hạng mục chất lượng đạt. |
| AC-11 | Yêu cầu vật tư được tạo, phê duyệt/từ chối và thông báo đúng người. |
| AC-12 | Dashboard drill-down khớp dữ liệu nguồn và tôn trọng quyền. |
| AC-13 | Lịch sử hiển thị actor, thời điểm, hành động, trạng thái trước/sau và lý do cần thiết. |
| AC-14 | Upload lỗi cho phép thử lại mà không tạo bằng chứng trùng ngoài ý muốn. |

## **12.3. Nhóm kiểm thử bắt buộc**

| Nhóm | Phạm vi |
| --- | --- |
| Unit test | Điều kiện nhận việc, state transition, quality gate, validation và tính một winner. |
| Integration test | Đăng nhập/quyền, tạo-phân công, tự nhận, gửi hoàn thành, QC, vật tư và audit. |
| Concurrency test | Nhiều worker nhận cùng việc, bấm lặp phê duyệt, gửi lặp completion. |
| Security test | ID tampering, truy cập ngoài dự án, thao tác ngoài vai trò, input/tệp không hợp lệ. |
| Usability test | Các persona hoàn thành kịch bản chính trên Web/Mobile mà không cần hướng dẫn kỹ thuật. |
| Performance test | Các baseline NFR-PERF với bộ dữ liệu nghiệm thu. |
| Backup/restore test | Khôi phục dữ liệu demo và xác nhận quan hệ/trạng thái không bị hỏng. |

## **12.4. Điều kiện hoàn thành phát hành**

* Toàn bộ yêu cầu Must được đánh dấu Passed hoặc có waiver được nhà tài trợ phê duyệt.
* Không còn lỗi Critical/High về quyền, assignment, trạng thái, mất dữ liệu hoặc quality gate.
* Có hướng dẫn cài đặt, dữ liệu mẫu, tài khoản demo, tài liệu API/thiết kế cần thiết và kịch bản demo.
* Môi trường thử nghiệm được triển khai, có sao lưu và có thể khởi động lại theo hướng dẫn.

# **13. Truy vết yêu cầu**

## **13.1. Ma trận BRD - SRS - Use Case**

| Yêu cầu BRD | Yêu cầu SRS | Use Case |
| --- | --- | --- |
| IAM-01 | IAM-SRS-001, IAM-SRS-002, IAM-SRS-008 | UC-01 |
| IAM-02 | IAM-SRS-007 | UC-01 |
| IAM-03 | IAM-SRS-003 | UC-01 |
| IAM-04 | IAM-SRS-004, IAM-SRS-008 | UC-01 |
| IAM-05 | IAM-SRS-001, IAM-SRS-005, IAM-SRS-006, IAM-SRS-008, PRJ-SRS-006, RPT-SRS-003 | UC-01 |
| ORG-01 | ORG-SRS-001, ORG-SRS-004, ORG-SRS-005, ORG-SRS-008 | UC-02/03/04 |
| ORG-02 | ORG-SRS-002, ORG-SRS-004, ORG-SRS-005, ORG-SRS-008 | UC-02/03/04 |
| ORG-03 | ORG-SRS-004, ORG-SRS-008 | UC-02/03/04 |
| ORG-04 | ORG-SRS-006, ORG-SRS-007 | UC-02/03/04 |
| ORG-05 | ORG-SRS-001, ORG-SRS-003, ORG-SRS-005, ORG-SRS-008, JOB-SRS-009 | UC-02/03/04 |
| PRJ-01 | PRJ-SRS-001, PRJ-SRS-002 | UC-02 |
| PRJ-02 | PRJ-SRS-003, PRJ-SRS-007 | UC-02 |
| PRJ-03 | PRJ-SRS-004, PRJ-SRS-007 | UC-02 |
| PRJ-04 | PRJ-SRS-008 | UC-02 |
| PRJ-05 | IAM-SRS-006, PRJ-SRS-005, PRJ-SRS-006 | UC-02 |
| PRJ-06 | PRJ-SRS-009 | UC-02 |
| JOB-01 | JOB-SRS-001, JOB-SRS-002 | UC-03/04/05 |
| JOB-02 | JOB-SRS-003 | UC-03/04/05 |
| JOB-03 | JOB-SRS-002, JOB-SRS-004 | UC-03/04/05 |
| JOB-04 | JOB-SRS-012, JOB-SRS-013 | UC-03/04/05 |
| JOB-05 | JOB-SRS-005, JOB-SRS-006, JOB-SRS-007 | UC-03/04/05 |
| JOB-06 | JOB-SRS-008, JOB-SRS-011, JOB-SRS-016 | UC-03/04/05 |
| JOB-07 | ORG-SRS-008, JOB-SRS-009, JOB-SRS-010, JOB-SRS-012, SCH-SRS-004 | UC-03/04/05 |
| JOB-08 | JOB-SRS-014 | UC-03/04/05 |
| JOB-09 | JOB-SRS-015, JOB-SRS-018 | UC-03/04/05 |
| JOB-10 | JOB-SRS-017, JOB-SRS-019, SCH-SRS-003 | UC-03/04/05 |
| JOB-11 | JOB-SRS-017, JOB-SRS-020 | UC-03/04/05 |
| JOB-12 | JOB-SRS-013, JOB-SRS-015, JOB-SRS-021, JOB-SRS-022, QUA-SRS-011, RPT-SRS-007 | UC-03/04/05 |
| SCH-01 | SCH-SRS-001, SCH-SRS-004 | UC-03/04/05/08 |
| SCH-02 | JOB-SRS-016, SCH-SRS-002, SCH-SRS-003 | UC-03/04/05/08 |
| SCH-03 | SCH-SRS-005 | UC-03/04/05/08 |
| SCH-04 | SCH-SRS-006 | UC-03/04/05/08 |
| SCH-05 | SCH-SRS-007, RPT-SRS-004 | UC-03/04/05/08 |
| QUA-01 | QUA-SRS-001 | UC-05/06 |
| QUA-02 | QUA-SRS-002 | UC-05/06 |
| QUA-03 | JOB-SRS-018, QUA-SRS-003 | UC-05/06 |
| QUA-04 | QUA-SRS-004, QUA-SRS-005 | UC-05/06 |
| QUA-05 | JOB-SRS-019, QUA-SRS-006, MAT-SRS-008 | UC-05/06 |
| QUA-06 | JOB-SRS-021, QUA-SRS-007, QUA-SRS-008, QUA-SRS-011 | UC-05/06 |
| QUA-07 | JOB-SRS-021, QUA-SRS-009, QUA-SRS-010, QUA-SRS-011, QUA-SRS-012, RPT-SRS-007 | UC-05/06 |
| MAT-01 | MAT-SRS-001 | UC-07 |
| MAT-02 | MAT-SRS-002, MAT-SRS-003, MAT-SRS-005 | UC-07 |
| MAT-03 | MAT-SRS-003, MAT-SRS-004, MAT-SRS-005 | UC-07 |
| MAT-04 | MAT-SRS-006 | UC-07 |
| MAT-05 | MAT-SRS-007, MAT-SRS-008 | UC-07 |
| RPT-01 | JOB-SRS-011, MAT-SRS-004, RPT-SRS-001, RPT-SRS-003 | UC-08 |
| RPT-02 | RPT-SRS-002, RPT-SRS-003 | UC-08 |
| RPT-03 | SCH-SRS-007, RPT-SRS-004, RPT-SRS-005 | UC-08 |
| RPT-04 | RPT-SRS-006 | UC-08 |
| RPT-05 | IAM-SRS-008, JOB-SRS-022, QUA-SRS-012, RPT-SRS-007, RPT-SRS-008 | UC-08 |

## **13.2. Truy vết nghiệp vụ nhạy cảm**

| Nghiệp vụ | Yêu cầu trọng tâm | Kiểm thử chính |
| --- | --- | --- |
| Worker tự nhận việc | JOB-SRS-005..011; SCH-SRS-004; NFR-PERF-003; NFR-REL-001..002 | Đủ/không đủ điều kiện; đồng thời; gửi lặp; cập nhật My Jobs. |
| Phân công trực tiếp | JOB-SRS-012..014; SCH-SRS-004..005 | Năng lực/lịch; xác nhận/từ chối; tái phân công và lịch sử. |
| Thực hiện hiện trường | JOB-SRS-016..020; QUA-SRS-003,006 | Checklist chặn; tiến độ; upload; gửi completion. |
| Quality/reinspection | QUA-SRS-004..012; JOB-SRS-021 | Phiên bản form; lỗi; khắc phục; nhiều vòng; quality gate. |
| Yêu cầu vật tư | MAT-SRS-001..008 | Validation; phê duyệt một lần; trạng thái; sai lệch không cập nhật tồn. |
| Phân quyền dự án | IAM-SRS-005..006; PRJ-SRS-005..006 | ID tampering; quyền chức năng; loại thành viên. |
| Audit | IAM-SRS-008; JOB-SRS-022; QUA-SRS-012; RPT-SRS-007..008 | Actor/thời điểm/trước-sau; không sửa; lọc theo phạm vi. |

# **14. Quyết định cần xác nhận và quản lý thay đổi**

## **14.1. Quyết định cần xác nhận**

| Mã | Quyết định |
| --- | --- |
| Q-01 | Giữ riêng vai trò Quản lý dự án và Điều phối viên hay gộp trong phiên bản đầu? |
| Q-02 | Work Order phân công trực tiếp có bắt buộc worker xác nhận hay có hiệu lực ngay? |
| Q-03 | Giới hạn công việc worker giữ đồng thời được tính theo số lượng, theo thời gian hay cả hai? |
| Q-04 | Worker hủy việc có thời gian chờ trước khi nhận lại cùng Work Order hay không? |
| Q-05 | Xung đột lịch là chặn hoàn toàn hay cảnh báo cho người có quyền ghi đè? |
| Q-06 | Tiến độ dự án dùng số Work Order hay trọng số theo thời lượng/khối lượng? |
| Q-07 | Checklist trước bắt đầu và checklist nghiệm thu dùng chung mẫu hay hai loại riêng? |
| Q-08 | Mức độ lỗi chất lượng có cần phân loại Nhẹ/Nghiêm trọng/Chặn hoàn tất không? |
| Q-09 | Module vật tư Should có được cam kết trong kỳ bảo vệ hay chỉ dùng làm backlog mở rộng? |
| Q-10 | Định dạng xuất dữ liệu cần CSV, Excel hay PDF? |
| Q-11 | Nền tảng Mobile bắt buộc là Android hay yêu cầu cả Android và iOS? |
| Q-12 | Thời gian giữ dữ liệu audit và ảnh trong môi trường demo/triển khai là bao lâu? |

## **14.2. Quy trình thay đổi yêu cầu**

**1.** Người đề xuất mô tả nhu cầu, giá trị, mức khẩn cấp và yêu cầu hiện tại bị ảnh hưởng.

**2.** Business Analyst đánh giá tác động đến phạm vi, workflow, dữ liệu, quyền, kiểm thử và thời gian.

**3.** Nhà tài trợ/đại diện khách hàng quyết định chấp nhận, hoãn hoặc từ chối.

**4.** Yêu cầu được cập nhật mã phiên bản, truy vết và ưu tiên; thay đổi Must phải có yêu cầu khác được loại hoặc điều chỉnh kế hoạch.

**5.** SRS, test case, thiết kế và tài liệu liên quan được đồng bộ trước khi phát triển tiếp.

|  | **Kiểm soát phình to phạm vi** Trong phạm vi đồ án, yêu cầu mới không tự động trở thành Must. Mọi mở rộng phải chứng minh không làm ảnh hưởng workflow cốt lõi hoặc phải thay thế một hạng mục có khối lượng tương đương. |
| --- | --- |

# **Phụ lục A. Thuật ngữ**

| Thuật ngữ | Định nghĩa |
| --- | --- |
| Work Order/Công việc thi công | Đơn vị công việc được quản lý theo dự án, trạng thái, người thực hiện, lịch và checklist. |
| Job Board | Danh sách Work Order còn trống được phép hiển thị để worker đủ điều kiện chủ động nhận. |
| Worker | Nhân viên hoặc cá nhân/nhà thầu trực tiếp thực hiện công việc tại hiện trường. |
| Điều phối viên | Người tạo, mở, phân công, tái phân công và lập lịch Work Order. |
| Assignment/Phân công | Quan hệ xác định worker, đội hoặc nhà thầu chịu trách nhiệm chính cho Work Order. |
| Eligibility/Điều kiện nhận việc | Tập điều kiện về trạng thái, năng lực, lịch và giới hạn để nguồn lực được nhận hoặc phân công. |
| My Jobs | Danh sách Work Order worker đã được giao hoặc tự nhận. |
| Checklist | Tập tiêu chí/câu hỏi cần hoàn thành ở một giai đoạn công việc. |
| Quality Inspection/QC | Quá trình kiểm tra chất lượng và người có quyền đưa ra kết luận kiểm tra. |
| Rework/Cần làm lại | Trạng thái công việc hoặc hạng mục chưa đạt và cần khắc phục. |
| Material Request | Yêu cầu vật tư gắn với dự án hoặc Work Order trong phạm vi đơn giản của đồ án. |
| Audit/Lịch sử thao tác | Bản ghi không sửa trực tiếp dùng để truy vết actor, thời điểm, hành động, đối tượng và kết quả. |

# **Phụ lục B. Tóm tắt số lượng yêu cầu**

| Nhóm | Tổng | Must | Should |
| --- | --- | --- | --- |
| Tài khoản và phân quyền | 8 | 7 | 1 |
| Tổ chức và nguồn lực | 8 | 6 | 2 |
| Dự án và dữ liệu nền | 9 | 7 | 2 |
| Work Order và điều phối kết hợp | 22 | 19 | 3 |
| Lịch và tiến độ | 7 | 4 | 3 |
| Checklist và kiểm soát chất lượng | 12 | 12 | 0 |
| Yêu cầu vật tư | 8 | 5 | 3 |
| Thông báo, báo cáo và truy vết | 8 | 7 | 1 |
| Tổng yêu cầu chức năng | 82 | 67 | 15 |

Yêu cầu phi chức năng: 27 (bao gồm 1 mục TBD về nền tảng Mobile). Use case chi tiết: 8. Business rule trọng yếu: 15.
