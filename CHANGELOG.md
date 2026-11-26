# Changelog

Ghi các thay đổi đáng chú ý của frontend OMS Algo theo từng đợt phát triển. Định dạng theo
[Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số phiên bản theo [SemVer](https://semver.org/lang/vi/).
Bản 0.x là bản demo chạy với dữ liệu giả lập, chưa có backend.

## [0.4.0] – 2026-11-26 · Đợt 10A: Bàn làm việc, nhóm liên kết màu, phím tắt

Màn mới cho dealer và vận hành, ghép từ component có sẵn. Không đổi nghiệp vụ, không đổi engine. Tách cửa sổ / màn hình
thứ hai để sang Đợt 10B.

### Thêm
- **Bàn làm việc `/ban-lam-viec`** (mọi vai trò):
  - Panel dock được (dockview-react 8.10.0, MIT): kéo tab để dock trái / phải / trên / dưới hoặc gộp tab, kéo viền đổi
    kích thước, thả nổi.
  - 7 loại panel: Danh mục theo dõi, Phiếu lệnh, Sổ lệnh 3 mức, Sổ lệnh, Chi tiết lệnh, Thuật toán đang chạy, Thông báo.
    Một loại mở được nhiều lần.
  - Tab có chấm màu nhóm kèm nhãn, menu "⋯" (đổi nhóm, thả nổi, "Tách cửa sổ" khóa đến 10B), nút đóng; nút "+" thêm panel.
  - Theme dockview lấy từ token Đợt 9 (4 theme và mù màu).
- **Bố cục:**
  - Mẫu Cơ bản (mặc định cho khách hàng) và Chuyên nghiệp (dealer, vận hành); "Về mặc định".
  - Nhiều bố cục có tên lưu theo tài khoản (localStorage, `schemaVersion: 2`, có migrate từ v1); xuất / nhập JSON.
  - Dữ liệu hỏng thì dùng bố cục mặc định kèm báo nhẹ.
- **Nhóm liên kết 4 màu + "Không nhóm":**
  - Chọn mã ở Danh mục thì Phiếu lệnh, Sổ lệnh 3 mức, Sổ lệnh cùng nhóm đổi theo; bấm mức giá thì điền vào phiếu cùng
    nhóm; bấm một lệnh thì Chi tiết lệnh cùng nhóm mở lệnh đó.
  - Token `link-1..4` đạt tương phản ở mọi theme.
- **Giữ bản nháp:** phiếu đang nhập dở mà nhóm đổi mã thì hỏi "Giữ bản nháp cho mã cũ / Chuyển sang mã mới", không xóa
  trắng; "Khóa mã" trên phiếu.
- **Phím tắt** (react-hotkeys-hook 5.4.0, MIT, có scope):
  - B / S mở phiếu Mua / Bán (không bao giờ gửi lệnh); O, D, N tới panel; Alt+1…9 chuyển panel.
  - "?" hoặc "/" mở bảng phím tắt; phím hiện trong Ctrl+K và tooltip.
  - Không chạy khi đang gõ, khi có hộp thoại mở, khi đang Demo; tắt được ở Cài đặt. Không dùng F1, không chặn Ctrl+W/T/R.
- **Bàn phím:** bảng trong panel theo mẫu Grid WAI-ARIA (một điểm dừng Tab; mũi tên, Home/End, PageUp/PageDown, Enter);
  panel có `aria-label`.
- **Demo và tour:**
  - Kịch bản 13 "Dealer dùng bàn làm việc": đổi mã theo nhóm, bấm B, điền và xác nhận lệnh, mở chi tiết.
  - Tour 1 bước giới thiệu Bàn làm việc lần đầu mở màn.
- **Test:**
  - Vitest: lưu / khôi phục, migrate v1 → v2, JSON hỏng, nhóm liên kết, giữ bản nháp, phím tắt không chạy trong ô nhập,
    điều hướng lưới.
  - Playwright: kéo panel rồi tải lại; nhóm đổi mã; "B" trong ô nhập; B rồi Xác nhận; duyệt bằng bàn phím; kịch bản 13
    trên giao diện.
  - axe color-contrast = 0 ở 4 theme và mù màu.
- **`npm run perf:workspace`:** đo khung hình trên bản build production; số đo ở
  [quality-report.md](docs/quality-report.md).
- **Tài liệu và ảnh:** [docs/licenses.md](docs/licenses.md); ảnh [docs/screenshots/dot10a/](docs/screenshots/dot10a/).

### Đổi
- **Màn cũ dùng chung phần lõi với Bàn làm việc**, hành vi trên màn cũ không đổi:
  - Bảng giá tách `PriceBoardTable`.
  - Sổ lệnh tách `OrderBlotter`.
  - Chi tiết lệnh tách `OrderDetailView({ id })`; tìm dòng nhật ký trong khung của chính nó.
  - Thông báo tách `NotificationList`.
- **Phiếu lệnh đọc mã qua `useSymbolScope()`** (mặc định vẫn là mã toàn cục) và chỉ theo dõi giá của mã đang chọn, không
  vẽ lại cả phiếu mỗi tick của mọi mã. Hàng bảng giá `memo` theo mã.
- **Cài đặt giao diện** có thêm mục "Phím tắt".

## [0.3.0] – 2026-11-25 · Đợt 9: Theme Sáng / Tối / Tương phản cao, màu giá VN, mù màu, trang Cài đặt giao diện

Mọi màu giao diện đi qua token ngữ nghĩa. Không đổi nghiệp vụ, không đổi engine. Chi tiết: [docs/theme.md](docs/theme.md).

### Thêm
- **4 theme:** Tối (mặc định, nền giữ như cũ), Sáng (nền `#F8FAFC`, thẻ `#FFFFFF`), Tương phản cao tối, Tương phản cao
  sáng.
- **Bảng màu mù màu xanh–cam:** tăng xanh lam, giảm cam; áp cả nút Mua/Bán và nhãn thành công/lỗi.
- **Màu giá theo thông lệ thị trường VN** (không phải quy định của Sở): mỗi theme có bộ giá trị riêng, đạt ≥ 4,5:1
  (≥ 7:1 ở tương phản cao) trên mọi nền xuất hiện. Theme sáng: giá tham chiếu chữ đậm trên chip vàng nhạt.
- **Không chỉ dựa vào màu:** giá có ▲/▼ so tham chiếu, trần "T" và sàn "S" có tên đọc "Giá trần"/"Giá sàn". Nhấp nháy giá
  = nền nhạt cộng mũi tên ↑/↓ trong 600ms, tắt khi hệ điều hành giảm chuyển động hoặc người dùng tắt.
- **Script khởi động trong `<head>`:** đặt theme trước lần vẽ đầu, nên tải lại không nháy khung tối. Đọc lựa chọn đã lưu
  (lỗi lưu trữ thì dùng Tối) và `prefers-color-scheme` / `prefers-contrast`.
- **ThemeProvider (Zustand):**
  - Sáng / Tối / Theo hệ thống; tự nhận `prefers-contrast: more` và `forced-colors`;
  - nút Sáng/Tối trên thanh trên; Ctrl+K "Đổi giao diện sáng/tối" và "Mở Cài đặt giao diện".
- **Trang Cài đặt giao diện `/cai-dat`** (mọi vai trò, mục "Cài đặt" trong menu tài khoản):
  - giao diện, tương phản cao, bảng màu, mật độ Thoáng/Gọn, cỡ chữ 90/100/110%, nhấp nháy giá;
  - ẩn bps/slippage (`•••`) và số tài khoản (`058C•••456`) khi trình chiếu;
  - mỗi lựa chọn có hàng xem trước đủ 5 màu giá; lưu riêng theo tài khoản demo.
- **`npm run tokens`:** sinh `src/styles/tokens.css` từ `src/config/theme.ts`, nơi duy nhất có mã màu.
- **`npm run lint` chặn mã màu viết cứng:** ESLint và `scripts/check-colors.mjs`, kiểm cả `tokens.css` khớp `theme.ts`.
- **Test:**
  - Vitest: tương phản WCAG của mọi cặp token ở 4 theme × 2 bảng màu; chọn theme; script khởi động; lưu theo tài khoản;
    lỗi localStorage.
  - Playwright + axe (`@axe-core/playwright`, gói dev duy nhất thêm vào): color-contrast = 0 vi phạm trên Trung tâm lệnh,
    Đặt lệnh, Sổ lệnh, Chi tiết, Báo cáo, Lịch sử, Đối soát, Cài đặt, Demo, ở 4 theme và mù màu.
  - Playwright: không nháy khung tối, đổi theme bằng nút và Ctrl+K, Recharts đổi màu không tải lại, trang Cài đặt.
  - 20 ảnh chuẩn `toHaveScreenshot` (Trung tâm lệnh, Đặt lệnh × 5 biến thể × 1440/1366).
  - Ảnh nghiệm thu [docs/screenshots/dot9/](docs/screenshots/dot9/).

### Đổi
- **Màu nhấn:** từ xanh lam `#38BDF8` (trùng màu sàn) sang chàm `#818CF8` (tối) / `#4338CA` (sáng).
- **Biểu đồ Recharts:** đọc màu qua biến CSS, đổi theo theme ngay.
- **Khoảng 105 lớp màu bảng Tailwind và mã hex/rgb** ở khoảng 25 file thay bằng lớp token (`text-status-danger`,
  `bg-buy`, `bg-surface-hover`…).
- **Hàng bảng đang rê/chọn:** dùng nền `--surface-hover` riêng (đỏ giảm trên nền mục menu cũ chỉ đạt 4,40:1).
- **Sổ lệnh 3 mức:** mức giá tham khảo trong phiên định kỳ hiển thị chữ nghiêng thay vì làm mờ.
- **HUNT xem lại:** bước chưa tới là khung trống thay vì làm mờ (làm mờ làm chữ tụt dưới ngưỡng tương phản).

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
