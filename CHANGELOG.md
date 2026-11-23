# Changelog

Ghi các thay đổi đáng chú ý của frontend OMS Algo theo từng đợt phát triển. Định dạng theo
[Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số phiên bản theo [SemVer](https://semver.org/lang/vi/).
Bản 0.x là bản demo chạy với dữ liệu giả lập, chưa có backend.

## [0.2.1] – 2026-11-23 · Đợt 8B: Phiên giao dịch đặc biệt theo KRX

Bổ sung vào gói luật của Đợt 8A ba nhóm luật: mã bị hạn chế giao dịch, phiên sau tạm ngừng, lệnh thỏa thuận cơ bản.

### Thêm
- **Mã bị hạn chế giao dịch** (HOSE): chỉ khớp định kỳ, chỉ lô chẵn: ATO, các lượt 15 phút trong giờ khớp liên tục (chỉ LO),
  ATC; khóa sửa/hủy 5 phút cuối lượt. Tham số nằm ở `restricted` của pack STO. Mã mô phỏng `XRS`. Nhãn "Hạn chế GD" trên
  phiếu lệnh, OrderBook3, Sổ lệnh; đồng hồ đếm ngược tới lần khớp kế tiếp; nút Sửa/Hủy bị khóa kèm lý do. Lô lẻ, MTL (kể
  cả lệnh thuật toán sinh MTL), HUNT bị chặn với mã lý do riêng; lệnh thuật toán không sinh lệnh con lúc nghỉ trưa.
- **Phiên sau tạm ngừng**: màn Vận hành có "Tạm ngừng mã" / "Giao dịch lại" (mô phỏng). Tạm ngừng thì lệnh cha đang chạy
  chuyển "Hệ thống tạm dừng" (mã lý do `SYMBOL_HALTED`, có câu giải thích), lệnh mới bị từ chối. Giao dịch lại thì một phiên
  khớp định kỳ 15 phút chỉ nhận LO, cấm sửa/hủy; lệnh tự chạy lại (`SYMBOL_RESUMED`), hết phiên khớp một lần rồi về bình
  thường. Trạng thái mã: Tạm ngừng → Khớp định kỳ sau tạm ngừng → Bình thường.
- **Lệnh thỏa thuận cơ bản**: tab "Thỏa thuận" trong Sổ lệnh, phiếu lệnh thỏa thuận (mã, chiều, KL, giá, tài khoản đối ứng
  mô phỏng). Tối thiểu 20.000 CP trên HOSE (5.000 trên HNX/UPCoM), bước giá 1 đ, trong biên của mã, trong giờ giao dịch và
  phiên 14:45–15:00; chưa khớp hết hiệu lực lúc 15:00. Gửi → đối ứng xác nhận hoặc từ chối → khớp; chỉ hủy được khi chưa
  khớp. Không đổi sổ lệnh 3 mức, không tính vào VWAP khớp lệnh của báo cáo.
- Demo: kịch bản 10 "Mã hạn chế khớp định kỳ 15 phút", 11 "Tạm ngừng và giao dịch lại", 12 "Thỏa thuận sau giờ 14:45–15:00".
- Test: lượt khớp đúng mốc 15 phút, khóa đúng 5 phút cuối, chặn lô lẻ/MTL/HUNT; phiên sau tạm ngừng; kiểm tra và luồng thỏa
  thuận, VWAP không đổi; ma trận `validateOrder` thêm phiên mới; Playwright `krx-special.spec`. Ảnh
  [docs/screenshots/dot8b/](docs/screenshots/dot8b/).

### Sửa
- Lệnh của mã hạn chế không còn bị khớp sớm khi vào 5 phút cuối lượt; chỉ khớp lúc hết lượt.

### Đổi
- Dữ liệu đã lưu trong trình duyệt của bản cũ bị bỏ (phiên bản trạng thái 10).

## [0.2.0] – 2026-11-19 · Đợt 8A: Luật giao dịch theo KRX

HOSE chạy hệ thống KRX từ 05/05/2025; cổ phiếu niêm yết HNX giao dịch trên HOSE từ 28/12/2026 (TT 139/2025/TT-BTC).
Luật giao dịch thành dữ liệu cấu hình theo bảng giao dịch × ngày hiệu lực.

### Thêm
- Gói luật `src/rules/`: pack STO, STX (hết hiệu lực 23/12/2026), UPX theo KRX, pack thử nghiệm bỏ nghỉ trưa;
  `resolveRules(board, ngày)`, `symbolBoard(mã, ngày)`, lịch ngày giao dịch có ngày nghỉ. Điểm chưa rõ là cờ có nhãn
  "Chưa kiểm chứng" / "Giả định" (MOK/MAK tắt, khóa sửa/hủy ATO/ATC, luật mã HNX sau khi sang HOSE).
- Bộ kiểm tra `validateOrder` (hàm thuần) phủ ma trận bảng × phiên × loại lệnh × lô × loại chứng khoán, câu lỗi có số
  cụ thể (`RULE_REASONS`). Form Đặt lệnh, Sửa lệnh, Sửa giá, mẫu chiến lược, HUNT, Demo và engine dùng chung.
- Phiếu lệnh: công tắc Lô chẵn / Lô lẻ (lô lẻ 1–99 CP, chỉ lệnh "Lệnh giới hạn (LO)" mới), nhãn sàn HOSE/HNX/UPCoM cạnh
  mã, bước giá theo loại chứng khoán (ETF, chứng quyền 10 đ), biên độ theo bảng.
- Sửa lệnh: mỗi lần chỉ giá hoặc khối lượng, ô còn lại bị khóa, cảnh báo mất/giữ ưu tiên thời gian; lệnh con LO sửa tại
  chỗ, MODIFY ghi `amend_kind`.
- MTL khớp một phần: phần còn lại chuyển LO giá khớp gần nhất ± 1 bước. Lệnh trong ngày hết hiệu lực lúc 14:45, Sổ lệnh
  hiện "Hết hiệu lực 14:45". Phiên thỏa thuận sau giờ 14:45–15:00 trên đồng hồ. Sổ lệnh có bộ lọc Lô.
- Room ngoại theo mã (dòng "Room NN còn lại" ở OrderBook3), tài khoản 058C345678 là nhà đầu tư nước ngoài; lệnh mua giữ
  room ngay khi đặt, vượt room bị từ chối (`FOREIGN_ROOM_EXCEEDED`).
- Ngày mô phỏng cạnh đồng hồ phiên, nút "Đến 28/12/2026": mã HNX đổi nhãn sàn, áp luật mới, không tải lại trang.
- Trang `/cau-hinh/luat` "Luật giao dịch" (OPS, chỉ đọc), nút "Thử cấu hình bỏ nghỉ trưa".
- Mã mô phỏng: XHA, XHB, XHC (HNX), XUA, XUB (UPCoM), XETF30 (ETF), CFPT2699 (chứng quyền).
- Demo: kịch bản 7 "Sửa lệnh: mất / giữ ưu tiên", 8 "Lô lẻ khớp trong ATC", 9 "Ngày 28/12/2026: mã HNX sang HOSE".
- Test: ma trận `validateOrder` (1.008 ô), test thuộc tính trần/sàn, ví dụ tính tay, `resolveRules`/`symbolBoard` tại
  23–28/12/2026, pack bỏ nghỉ trưa; Playwright `krx.spec`. Ảnh [docs/screenshots/dot8a/](docs/screenshots/dot8a/).

### Đổi
- 14:45–15:00 là `PUT_THROUGH` (thỏa thuận sau giờ), không còn `CLOSED`; đóng cửa hẳn từ 15:00. Nút "Sang ngày mới" hiện
  từ 14:45.
- Sửa lệnh không còn hủy lệnh con rồi sinh lại; đổi cả giá lẫn KL một lần bị từ chối.
- Lỗi 422 của API giả lập có thêm `errors[].code`. Engine kiểm lệnh mới theo gói luật (một đường kiểm tra), API không
  kiểm lại lần hai.
- Dưới 1600px nút "Về đầu ngày" trên thanh trên chỉ còn biểu tượng (chỗ cho đồng hồ ngày).
- Dữ liệu đã lưu trong trình duyệt của bản cũ bị bỏ (phiên bản trạng thái 9).


## [0.1.1] – 2026-11-18 · Đợt 7: Lịch sử và đối soát

### Thêm
- Màn `/bao-cao/lich-su` (mục "Lịch sử và đối soát" trên thanh bên đã mở khóa, mọi vai trò), 3 tab nhớ trên URL:
  - **Lịch sử lệnh**: lệnh đã kết thúc và lệnh nhiều phiên đang chạy theo ngày; lọc Hôm nay / 5 phiên / tùy chọn, mã,
    chiến lược, chiều, trạng thái, tài khoản; sắp xếp, 50 dòng mỗi trang, dòng tổng, xuất CSV đúng bộ lọc.
  - **Nhật ký kiểm toán**: mọi OrderEvent, chỉ đọc, lọc theo hành động, người, mã lệnh, thời gian, tìm không dấu, xuất CSV.
    Khách hàng thấy "Người dùng khác" thay cho user_id của người khác.
  - **Đối soát** (DEALER, OPS): so OMS với Core theo từng lệnh con (STATUS_MISMATCH, QTY_MISMATCH, UNKNOWN_OPEN,
    UNKNOWN_RESOLVED, DUP_FILL_IGNORED, PARENT_SUM_MISMATCH, OVERFILL), 4 thẻ, "Đối soát ngay"; vận hành đánh dấu đã xử lý
    có ghi chú và duyệt theo maker-checker.
- Engine giả lập có sổ phía Core; lệnh mẫu đủ 5 phiên gần nhất, có sẵn ít nhất một chênh lệch mỗi loại (trừ OVERFILL).
- Trung tâm lệnh: liên kết "Xem đối soát" khi có chênh lệch đang mở. Ctrl+K: "Mở nhật ký kiểm toán", "Đối soát ngay".
- Thuật ngữ: STATUS_MISMATCH, QTY_MISMATCH, DUP_FILL_IGNORED, PARENT_SUM_MISMATCH, OVERFILL, Nhật ký kiểm toán.
- Test: `reconcile` (mỗi loại, khớp hoàn toàn = 0, khớp trùng bỏ qua đúng 1 lần, OVERFILL = 0 với 6 kịch bản Demo),
  lịch sử, nhật ký, phân quyền; Playwright `lich-su.spec`. Ảnh [docs/screenshots/dot7/](docs/screenshots/dot7/).

### Sửa
- Lệnh mẫu "hôm qua" lấy phiên giao dịch liền trước thay vì ngày lịch (trước đây mở app thứ Hai thì có phiên Chủ nhật).

## [0.1.0] – 2026-11-17 · Đợt 6: Chất lượng và hoàn thiện

Không thêm tính năng nghiệp vụ. Chi tiết số liệu ở [docs/quality-report.md](docs/quality-report.md).

### Thêm
- Kiểm thử giao diện tự động bằng Playwright (`npm run test:e2e`, `test:e2e:ui`, `test:all`), chạy trên Chrome/Edge có
  sẵn ở 2 khung 1440×900 và 1366×768; đồng hồ giả lập và seed cố định để kết quả lặp lại.
- Spec cho đăng nhập và phân quyền, Trung tâm lệnh, Đặt lệnh, Sổ lệnh, Chi tiết lệnh, HUNT, Báo cáo + CSV, Vận hành,
  Chế độ Demo, Tìm nhanh và tour, thao tác chỉ bằng bàn phím, bố cục, trạng thái tải/trống/lỗi, quét lỗi console mọi route.
- Cờ chỉ dùng khi test (`?e2e=1&seed=…&fail=…&delay=…`), không có trong bản build.
- [docs/quality-report.md](docs/quality-report.md), [docs/demo-checklist.md](docs/demo-checklist.md), bộ ảnh
  [docs/screenshots/v0.1.0/](docs/screenshots/v0.1.0/).

### Sửa
- Thanh bên tự thu gọn ở màn ≤1280px; breadcrumb không còn bị cắt ở 1366–1440px.
- Mọi màn có dữ liệu đều có nút "Thử lại" khi lỗi; trạng thái trống có câu hướng dẫn và nút hành động
  (vd "Chưa có lệnh nào · Đặt lệnh mới", "Bỏ lọc").
- Truy cập: viền focus rõ cho dòng bảng và mức giá sổ lệnh; màn Đặt lệnh có tiêu đề h1; chữ phụ mờ 60% (≈3,7:1) nâng
  lên 80% (≈5,5:1); nút X của hộp thoại đọc là "Đóng hộp thoại".
- Bỏ chữ tiếng Anh còn sót ("Cấu hình strategy", "Child/Parent", "Close"); giờ thông báo theo dạng dd/MM HH:mm:ss.
- Sổ lệnh không còn vẽ lại toàn bộ bảng mỗi nhịp giá (33,8 → 13,0 lần vẽ dòng mỗi nhịp, đo ở chế độ dev).

## [0.0.5] – 2026-11-16 · Đợt 5: Giải thích, thuật ngữ, tìm nhanh, tour

### Thêm
- Thẻ "Vì sao lệnh này…" ở Chi tiết lệnh, giải thích theo quy tắc cho lệnh dừng, bị từ chối, chưa rõ, chờ kích hoạt…;
  câu rút gọn khi rê chuột vào badge trạng thái ở Sổ lệnh và Trung tâm lệnh.
- Tooltip thuật ngữ có công thức và ví dụ bằng số; trang `/thuat-ngu`.
- Tìm nhanh Ctrl+K (lệnh, mã, màn hình, thao tác, thuật ngữ; gõ không dấu).
- Tour 5 bước lần đầu cho từng vai trò.

## [0.0.4] – 2026-11-13 · Đợt 4: Sổ lệnh 3 mức, HUNT quét, mẫu chiến lược

### Thêm
- Sổ lệnh 3 mức mua/bán ở Đặt lệnh (bấm để điền giá) và Chi tiết lệnh.
- HUNT quét từng mức giá, không vượt giá tối đa; khung quét từng bước và "Xem lại".
- 6 mẫu chiến lược một chạm, trang `/mau-chien-luoc`.

## [0.0.3] – 2026-11-12 · Đợt 3: Chế độ Demo

### Thêm
- 6 kịch bản E2E tự chạy có chú thích, tô sáng, điều kiện kiểm tra và hộp kết quả; dữ liệu riêng, thoát thì khôi phục.

## [0.0.2] – 2026-11-11 · Đợt 2: Báo cáo hiệu quả thực hiện

### Thêm
- Báo cáo `/bao-cao/hieu-qua`: so giá bình quân với arrival và VWAP, tỷ lệ tham gia, biểu đồ theo chiến lược, xuất CSV.
- Thẻ "Hiệu quả" ở Chi tiết lệnh.

## [0.0.1] – 2026-11-10 · Đợt 1: Khung ứng dụng và Trung tâm lệnh

### Thêm
- Trang giới thiệu + đăng nhập gộp; khung ứng dụng có thanh bên theo vai trò và thanh trên.
- Trung tâm lệnh: 4 KPI, lệnh cần chú ý, hoạt động gần nhất.
- Trung tâm thông báo có số chưa đọc.

## [0.0.0] – 2026-11-06 → 2026-11-09 · Nền tảng (trước Đợt 1)

### Thêm
- 5 màn nghiệp vụ: Đặt lệnh nâng cao (kiểm luật HOSE), Sổ lệnh, Chi tiết lệnh, Giám sát hệ thống (bơm lỗi, kill switch),
  Cấu hình chiến lược (maker-checker).
- Engine giả lập sinh lệnh con, khớp, ATO/ATC, đối soát; API giả lập bằng MSW.
- Bộ test case E2E và bảng phủ test.

[0.1.0]: https://github.com/tonypham-hp/OMS_Algo/compare/main...test/fe-e2e-polish
