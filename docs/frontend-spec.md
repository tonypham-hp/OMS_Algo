# Đặc tả Frontend OMS (bản demo, dữ liệu mô phỏng)

> File này là đầu vào cho Claude Code. Làm frontend chạy độc lập bằng dữ liệu mock;
> backend FastAPI sẽ nối vào sau, nên mọi chỗ gọi dữ liệu phải đi qua `src/services/`.

## 1. Mục tiêu
Giao diện Advanced Order Management cho khách hàng / dealer trên sàn HOSE:
đặt lệnh nâng cao, theo dõi sổ lệnh, xem chi tiết lệnh cha – lệnh con – khớp lệnh,
và màn vận hành. Toàn bộ dữ liệu là demo, có ghi chú "Dữ liệu demo" trên header.

## 2. Công nghệ (khớp dự án admin-p2p của công ty)
- Vite + React + TypeScript, Tailwind CSS + shadcn/ui (`components.json`)
- React Router (lazy load từng trang), TanStack Query (dữ liệu server), Zustand (state client)
- react-hook-form + zod (form đặt lệnh), Recharts (biểu đồ)
- MSW (Mock Service Worker) giả lập API REST; bộ giả lập thị trường chạy trong trình duyệt
- ESLint, Vitest
- Không thêm thư viện ngoài danh sách khi chưa hỏi.

## 3. Cấu trúc thư mục (giữ đúng convention admin-p2p)
```
frontend/
  public/
  src/
    assets/
    components/        # component dùng chung; components/ui là của shadcn, không sửa tay
    config/            # hằng số: phiên giao dịch, bước giá, màu trạng thái
    hooks/             # useOrders, useMarketStream, usePermission ...
    lib/               # utils của shadcn, format số VN, query client
    mocks/             # MSW handlers + simulator (giá, sinh lệnh con, khớp, lỗi)
    pages/             # mỗi màn hình một thư mục
    routes/            # index.tsx, LazyLoader.tsx, LoginRoute.tsx, ProtectedRoute.tsx, PermissionRoute.tsx
    services/          # hàm gọi API (orders.service.ts, market.service.ts ...)
    store/             # zustand: auth, market ticks, ui
    types/             # kiểu dữ liệu theo ERD (mục 6)
    utils/
    App.tsx
    main.tsx
  .env.example         # VITE_API_BASE_URL, VITE_USE_MOCK=true
  components.json, eslint.config.js, tsconfig*.json, vite.config.ts
```

## 4. Đăng nhập và phân quyền (demo)
- Trang "/" (chưa đăng nhập) và "/login" là cùng một màn hai cột.
  - Bên trái giới thiệu: logo ALGO OMS, tiêu đề, 3 thẻ tính năng, chân trang "Bản demo · dữ liệu mô phỏng".
  - Bên phải chọn 1 trong 3 tài khoản demo, mỗi thẻ ghi các màn xem được; thẻ được chọn có viền màu nhấn.
  - Nút "Vào hệ thống với vai trò …". Không cần mật khẩu thật.
  - Đã đăng nhập mà vào "/" hoặc "/login" thì chuyển sang /trung-tam.
  - `khachhang` (role CUSTOMER): màn 1, 2, 3
  - `dealer` (role DEALER): màn 1, 2, 3 + xem lệnh của nhiều tài khoản
  - `vanhanh` (role OPS): thêm màn 4, 5
  - `vanhanh2` (role OPS): người duyệt thứ hai cho maker-checker ở màn 5; hiện ở dòng nhỏ dưới 3 thẻ
  - Mọi vai trò đều vào được Trung tâm lệnh (/trung-tam).
- ProtectedRoute: chưa đăng nhập → /login. PermissionRoute: thiếu quyền → trang 403.

## 5. Màn hình
| # | Route | Màn hình | Nội dung chính |
|---|---|---|---|
| 0 | /trung-tam | Trung tâm lệnh | Trang mặc định sau đăng nhập: 4 KPI, bảng lệnh cần chú ý, 10 hoạt động gần nhất |
| 1 | /dat-lenh | Đặt lệnh nâng cao | Bảng giá VN30 thu gọn (giá trần/sàn/TC, giá khớp, nháy màu khi đổi) + ticket đặt lệnh |
| 2 | /so-lenh | Sổ lệnh nâng cao | Bảng lệnh cha: mã, chiều, loại lệnh, KL đặt/khớp, thanh tiến độ, trạng thái; lọc + hành động |
| 3 | /so-lenh/:id | Chi tiết lệnh | Thông tin lệnh cha, timeline lệnh con, bảng khớp, biểu đồ thực hiện vs kế hoạch, giá BQ vs arrival, nhật ký |
| 4 | /van-hanh | Giám sát hệ thống | Cảnh báo (Child UNKNOWN, REJECTED, dữ liệu giá trễ), kill switch, nút bơm lỗi cho demo |
| 5 | /cau-hinh | Cấu hình chiến lược | Danh sách tham số theo strategy; tạo yêu cầu thay đổi → người khác duyệt (maker-checker) |
| 6 | /bao-cao/hieu-qua | Hiệu quả thực hiện | So giá BQ với arrival và VWAP thị trường, tỷ lệ tham gia, biểu đồ theo chiến lược, xuất CSV (mục 12) |

Làm theo thứ tự 1 → 2 → 3 → 4 → 5, mỗi màn xong mới sang màn sau.

### Khung ứng dụng (AppLayout, dùng chung cho mọi trang sau đăng nhập)
- Thanh bên rộng 232px, thu gọn còn icon (nhớ trong localStorage).
  - Nhóm menu: Trung tâm lệnh · GIAO DỊCH: Đặt lệnh, Sổ lệnh, Mẫu chiến lược · BÁO CÁO: Hiệu quả thực hiện,
    Lịch sử và đối soát · VẬN HÀNH (chỉ OPS): Giám sát hệ thống (màn 4), Cấu hình chiến lược (màn 5).
  - Mẫu chiến lược mở từ Đợt 4, Lịch sử và đối soát mở từ Đợt 7 (mục 21): không còn mục "Sắp có". Cơ chế khóa
    (`comingSoon`) vẫn giữ cho màn sau này.
  - Hiệu quả thực hiện mở cho mọi vai trò (Đợt 2).
- Thanh trên cao 56px: chấm màu + tên phiên HOSE + giờ giả lập, nút tua x1/x10/x60, breadcrumb,
  nhãn "Dữ liệu demo · cập nhật hh:mm:ss", chuông thông báo, tài khoản, đăng xuất.
- Thông báo sinh từ OrderEvent theo loại Notification (mục 6): PARENT_ACTIVATED, CONDITION_TRIGGERED,
  CHILD_REJECTED, PARENT_PAUSED (hệ thống tạm dừng), PARENT_COMPLETED, PARENT_CANCELLED, PARENT_EXPIRED.
  - Mỗi event chỉ sinh một thông báo.
  - Chuông có badge số chưa đọc. Bấm một mục thì mục đó được đánh dấu đã đọc và mở lệnh.
  - Có nút "Đánh dấu tất cả đã đọc".
- Trạng thái dùng chung: LoadingState, EmptyState, ErrorState.

### Trung tâm lệnh (/trung-tam)
- 4 KPI:
  - Lệnh đang chạy, kèm số đang tạm dừng.
  - Khối lượng khớp hôm nay, trên tổng KL đã đặt.
  - Cần chú ý, chia theo số UNKNOWN / REJECTED / PAUSED_SYSTEM.
  - Slippage trung bình so với arrival, gia quyền theo KL; dương là bất lợi. Không có dữ liệu thì hiện "—".
- Bảng "Lệnh cần chú ý" (mã lệnh, mã CK, vấn đề, trạng thái); bấm dòng mở /so-lenh/:id.
- "Hoạt động gần nhất": 10 OrderEvent mới nhất.
- Phạm vi dữ liệu giống sổ lệnh: khách hàng thấy tài khoản mình, dealer thấy các tài khoản quản lý, OPS thấy tất cả.
- Mọi số tính bằng hàm thuần (src/utils/dashboard.ts).

### Ticket đặt lệnh (màn 1)
- Loại lệnh: Stop, Stop Limit, Take Profit, Trailing Stop, OCO, Bracket, Iceberg, TWAP, VWAP, POV, HUNT.
- Form tham số đổi theo loại lệnh (ví dụ Iceberg: slice_qty; TWAP: start, end, interval;
  POV: participation %, max %; Trailing: trailing_value; OCO: giá TP + giá SL).
- Kiểm tra ngay khi nhập (mục 7), báo lỗi bằng tiếng Việt cạnh ô nhập.
- Bấm Đặt lệnh → hộp xác nhận tóm tắt → tạo lệnh cha, trả mã lệnh.

### Hành động ở sổ lệnh (màn 2)
| Hành động | Cho phép khi trạng thái | Khóa thêm khi |
|---|---|---|
| Sửa | ACTIVE, PARTIALLY_EXECUTED, PAUSED_USER; PAUSED_SYSTEM có reason_code = PRICE_OUT_OF_BAND (chỉ sửa giá, xem dưới) | phiên ATO/ATC |
| Hủy | mọi trạng thái chưa kết thúc | phiên ATO/ATC |
| Tạm dừng | ACTIVE, PARTIALLY_EXECUTED | — |
| Tiếp tục | PAUSED_USER (không áp dụng cho PAUSED_SYSTEM) | — |

Lệnh PAUSED_SYSTEM do giá ngoài biên độ (reason_code = PRICE_OUT_OF_BAND):
- Phát sinh đầu ngày mới, khi limit_price, trigger_price, giá TP, giá SL hoặc giá săn còn dùng tới của lệnh mang sang
  nằm ngoài trần/sàn mới. Lệnh không sinh lệnh con, ghi OrderEvent và Notification lý do.
- Sửa: chỉ sửa các giá trên, không sửa khối lượng. Giá mới hợp lệ trong biên độ ngày hiện tại thì lệnh tự chuyển lại
  ACTIVE (hoặc PARTIALLY_EXECUTED nếu đã khớp một phần), ghi OrderEvent MODIFY và RESUME.
- PAUSED_SYSTEM vì lý do khác không được Sửa.

## 6. Mô hình dữ liệu (dùng đúng tên trường, đặt trong src/types)
- **ParentOrder**: parent_order_id, client_request_id, account_no, symbol, side (BUY|SELL),
  total_qty, executed_qty, limit_price, strategy_type, status, reason_code, valid_from, valid_to,
  persistence_mode (DAY|GTD|MULTI_SESSION), version, created_at, updated_at
  - status: DRAFT, ACTIVE, PARTIALLY_EXECUTED, PAUSED_USER, PAUSED_SYSTEM,
    CANCEL_PENDING, COMPLETED, CANCELLED, EXPIRED
- **StrategyParameter**: parameter_code, parameter_value, data_type
- **OrderCondition**: condition_id, parent_order_id, condition_type, trigger_price,
  oco_group_id, status (ACTIVE|TRIGGERED|CANCELLED), triggered_at
- **ChildOrder**: child_order_id, parent_order_id, cycle_no, side, order_type (LO|MTL|ATO|ATC),
  price, quantity, filled_qty, status, client_order_id, idempotency_key, core_order_id,
  created_at, sent_at
  - status: CREATED, SENDING, ACKNOWLEDGED, PARTIAL_FILLED, FILLED, CANCEL_PENDING,
    CANCELLED, REJECTED, UNKNOWN, EXPIRED
- **Execution**: execution_id, child_order_id, parent_order_id, exchange_match_id, price, qty, match_time
- **MarketSnapshot**: arrival_price, arrival_bid, arrival_ask, arrival_timestamp
- **OrderEvent** (nhật ký): event_id, parent_order_id, child_order_id, action
  (CREATE, MODIFY, PAUSE, RESUME, CANCEL, TRIGGER, CHILD_CREATE, CHILD_SEND, FILL, REJECT,
  RECOVERY, DECISION, CHILD_UNKNOWN), user_id, channel, old_value, new_value, event_time
- **Notification**: notification_type (PARENT_ACTIVATED, CONDITION_TRIGGERED, CHILD_REJECTED,
  PARENT_PAUSED, PARENT_COMPLETED, PARENT_CANCELLED, PARENT_EXPIRED), sent_at

## 7. Luật giao dịch theo KRX (Đợt 8A)

HOSE chạy hệ thống KRX từ 05/05/2025. Luật không viết trong code mà là **dữ liệu cấu hình**: mỗi gói luật (`RulePack`)
áp cho một bảng giao dịch trong một khoảng ngày hiệu lực. Đổi giờ phiên, biên độ, bước giá chỉ cần thêm hoặc sửa một
pack. Giá dùng số nguyên đồng; hiển thị kiểu Việt Nam: 1.000.000.

### Gói luật (`src/rules/`)
- `types.ts`: `RulePack` gồm bảng (`STO` HOSE, `STX` HNX, `UPX` UPCoM), ngày hiệu lực, phiên, loại lệnh theo phiên
  và theo lô, biên độ (thường, ngày đầu), bảng bước giá theo loại chứng khoán (`STOCK`, `CLOSED_FUND`, `ETF`, `CW`), lô
  chẵn/lẻ, KL tối đa, chính sách sửa/hủy, giờ hết hiệu lực, cờ cấu hình (có trạng thái kiểm chứng và nhãn), nguồn công
  khai. Chừa sẵn `restricted`, `haltResume`, `putThrough` cho Đợt 8B.
- `packs/`: `sto-krx-2025`, `stx-krx-2025` (hết hiệu lực 23/12/2026), `upx-krx-2025`, và pack **thử nghiệm**
  `sto-experimental-no-lunch` (bỏ nghỉ trưa, chỉ để chứng minh đổi lịch phiên không cần sửa code).
- `registry.ts`: `resolveRules(board, simDate)` chọn pack theo ngày; `setExperimentalPack` nạp đè pack thử nghiệm lúc chạy.
- `symbols.ts`: danh mục mã (sở niêm yết, loại chứng khoán) và `symbolBoard(symbol, simDate)`.
- `calendar.ts`: ngày giao dịch bỏ thứ Bảy, Chủ nhật và danh sách ngày nghỉ `config/holidays.ts` (danh sách mẫu).
- `price.ts`, `session.ts`: bước giá, trần/sàn, MTL phần còn lại, phiên theo pack.
- `config/hose.ts`, `utils/hose.ts` chỉ còn là lớp mỏng đọc từ pack HOSE đang hiệu lực.

### Đã xác nhận (HOSE, bảng STO, `verified = true`)
- Phiên: ATO 9:00–9:15 · liên tục 9:15–11:30 và 13:00–14:30 · ATC 14:30–14:45 · thỏa thuận sau giờ 14:45–15:00
  (8A chỉ hiện trên đồng hồ phiên, chưa có phiếu thỏa thuận).
- Lệnh LO, ATC chưa khớp **hết hiệu lực lúc 14:45**; Sổ lệnh hiện "Hết hiệu lực 14:45".
- MTL chỉ trong phiên liên tục; phần chưa khớp chuyển thành LO tại giá khớp gần nhất +1 bước giá (mua) / −1 bước (bán).
  Ví dụ: mua, giá khớp gần nhất 27.650 → LO 27.700. Chi tiết lệnh hiện "Phần còn lại chuyển LO giá …".
- ATO/ATC không còn ưu tiên trước LO mua giá trần / LO bán giá sàn đặt trước đó (`auctionPriorityOverLimit = false`).
- Sửa lệnh LO tại chỗ: mỗi lần **chỉ giá HOẶC khối lượng**. Đổi giá hoặc tăng KL thì mất ưu tiên thời gian, giảm KL thì
  giữ. OrderEvent MODIFY ghi `amend_kind` = `PRICE` / `QTY_UP` / `QTY_DOWN`; lệnh con có `priority_at`.
- Lô lẻ 1–99 CP: chỉ lệnh LO (chiến lược "Lệnh giới hạn (LO)"), khớp cả ATO, liên tục, ATC.
- Biên độ ±7%, ngày giao dịch đầu ±20%. Trần = tham chiếu × (1 + biên) làm tròn **xuống** theo bước giá; sàn =
  tham chiếu × (1 − biên) làm tròn **lên**. Ví dụ tham chiếu 128.500 → trần 137.400, sàn 119.600.
- Bước giá: cổ phiếu, chứng chỉ quỹ đóng 10/50/100 đ (dưới 10.000 / tới dưới 50.000 / từ 50.000); ETF và chứng quyền
  10 đ mọi mức giá (ETF 21.350 hợp lệ). Chứng quyền: trần/sàn theo khoảng trần/sàn của mã cơ sở chia tỷ lệ chuyển đổi;
  sàn âm hiển thị 0 nhưng lệnh phải từ 10 đ.
- Lô chẵn: bội số 100, tối đa 500.000 CP/lệnh.
- Room ngoại bị trừ **ngay khi đặt** lệnh mua; lệnh mua vượt room còn lại bị từ chối (`FOREIGN_ROOM_EXCEEDED`). Phần
  chưa khớp trả lại room khi hủy, hết hiệu lực; tăng KL giữ thêm, giảm KL trả lại.

### Đã lên lịch: cổ phiếu niêm yết HNX sang HOSE (Thông tư 139/2025/TT-BTC)
- Giao dịch phiên cuối trên HNX ngày 23/12/2026, ngừng giao dịch 24–25/12/2026, giao dịch trên HOSE từ 28/12/2026.
- `symbolBoard`: mã niêm yết HNX trả `STX` tới 23/12, `null` (ngừng giao dịch) ngày 24–25/12, `STO` từ 28/12.
  Đặt lệnh ngày ngừng giao dịch bị từ chối (`SYMBOL_TRANSFER_HALT`).
- Đồng hồ ngày mô phỏng cạnh đồng hồ phiên: chọn ngày giao dịch (chỉ tiến), nút "Đến 28/12/2026". Đổi ngày thì mã HNX
  đổi nhãn sàn và áp luật mới, không tải lại trang.

### Chưa kiểm chứng (cờ cấu hình, `verified = false`, có nhãn trên giao diện)
- MOK/MAK (FOK/FAK) trên HOSE: cờ `MOK_MAK` mặc định **tắt** (`ORDER_TYPE_DISABLED`).
- Khóa sửa/hủy trong ATO/ATC: giữ quy tắc đang dùng, cờ `AMEND_CANCEL_IN_AUCTION_LOCK`, nhãn "Chưa kiểm chứng".
- Biên độ, bước giá của mã HNX sau khi sang HOSE: giả định dùng luật STO, cờ `TRANSFERRED_SYMBOL_RULES`, nhãn "Giả định".
- HNX (`STX`): biên ±10% (ngày đầu ±30%), bước 100 đ; UPCoM (`UPX`): biên ±15% (ngày đầu ±40%), bước 100 đ, tham
  chiếu là bình quân gia quyền phiên trước. Lịch phiên dưới KRX chưa kiểm chứng từ nguồn gốc nên cả hai pack
  `verified = false`.

### Bộ kiểm tra (`src/rules/validate.ts`, hàm thuần)
- `validateOrder(input, rules, sessionNow, symbolInfo, account)` phủ ma trận bảng × phiên × loại lệnh × loại lô × loại
  chứng khoán; trả `RuleViolation[]` có mã lý do, trường, mức (`error` / `warn`) và số liệu. Kèm `checkPrice`,
  `checkQty`, `validateAmend`/`classifyAmend`, `validateCancel`.
- Câu tiếng Việt có số cụ thể: `RULE_REASONS` trong `src/explain/reasons.ts`.
- Một đường kiểm tra: form Đặt lệnh, Sửa lệnh, Sửa giá, mẫu chiến lược, HUNT, Demo và engine (API giả lập) đều gọi bộ
  này. Lệnh gửi ngay (LO thường, lô lẻ) chịu luật phiên đầy đủ; lệnh thuật toán chỉ nhận cảnh báo phiên (lệnh con gửi khi
  vào phiên). Lỗi 422 trả `errors: [{ field, message, code }]`.

### Giao diện
- Phiếu lệnh: công tắc "Lô chẵn / Lô lẻ"; nhãn sàn HOSE/HNX/UPCoM cạnh mã (kèm "Giả định", "Ngừng GD"); bước giá theo
  loại chứng khoán và giá đang nhập; dòng loại chứng khoán, biên độ, phiên của bảng.
- Sửa lệnh: sửa một ô thì ô kia bị khóa, nút "Đổi trường sửa", cảnh báo mất/giữ ưu tiên.
- Sổ lệnh: bộ lọc Lô; OrderBook3 có dòng "Room NN còn lại".
- Trang `/cau-hinh/luat` (chỉ OPS, chỉ đọc): bảng các pack, ngày hiệu lực, kiểm chứng, cờ, nguồn; nút "Thử cấu hình bỏ
  nghỉ trưa".

### Mã bị hạn chế giao dịch (Đợt 8B, HOSE)
- Chỉ khớp định kỳ, chỉ lô chẵn: ATO, rồi các lượt định kỳ 15 phút trong giờ khớp liên tục (chỉ LO), rồi ATC.
  Lượt tính từ đầu mỗi khung liên tục: kết thúc 09:30, 09:45 … 11:30 và 13:15 … 14:30.
- Khóa sửa, hủy 5 phút cuối mỗi lượt. Độ dài lượt, thời gian khóa, loại lệnh theo phiên nằm ở `restricted` của pack STO.
- Hàm thuần `restrictedPhaseAt(seconds, rules)` (`src/rules/session.ts`) trả phiên riêng của mã: `PERIODIC`,
  `PERIODIC_LOCK` (5 phút cuối), giờ khớp và mã lượt. Bảng giá gắn vào `SymbolQuote.phase`.
- Engine (adapter mỏng): lệnh của mã hạn chế chỉ khớp khi mã lượt đổi (hết lượt), như ATO/ATC; lệnh thuật toán chỉ sinh
  lệnh con trong cửa sổ nhận lệnh (không trong nghỉ trưa).
- Bị chặn với mã lý do riêng: lô lẻ (`RESTRICTED_ROUND_LOT_ONLY`), MTL kể cả lệnh thuật toán sẽ sinh MTL
  (`RESTRICTED_NO_MTL`), HUNT (`RESTRICTED_NO_HUNT`), sửa/hủy trong cửa sổ khóa (`RESTRICTED_LOCKED`, câu nêu giờ khớp).
- Giao diện: nhãn "Hạn chế GD" trên phiếu lệnh, OrderBook3, Sổ lệnh; đồng hồ "Khớp kế tiếp 09:45 · còn 07:12"; nút
  Sửa/Hủy bị vô hiệu kèm lý do "Khóa sửa, hủy 5 phút cuối lượt khớp định kỳ (khớp lúc …)".
- Dữ liệu mô phỏng: mã `XRS` "Cổ phiếu hạn chế GD (mô phỏng)", danh sách `RESTRICTED_SYMBOLS` (`src/mocks/data.ts`).

### Phiên sau tạm ngừng (Đợt 8B)
- Vận hành tạm ngừng / cho giao dịch lại một mã ở màn Vận hành (khung "Tạm ngừng mã (mô phỏng)", API
  `/api/ops/symbols/:symbol/halt | resume`, chỉ OPS).
- Tạm ngừng: giá, sổ lệnh đứng yên; lệnh cha đang chạy của mã chuyển `PAUSED_SYSTEM` với mã lý do `SYMBOL_HALTED` (lệnh con
  chờ bị hủy, có thông báo, có câu giải thích); lệnh mới bị từ chối (`SYMBOL_TRADING_HALTED`).
- Giao dịch lại: một phiên khớp định kỳ 15 phút (`REOPEN`, theo `haltResume` của pack) chỉ nhận LO, cấm sửa, hủy; lệnh cha
  tự chạy lại (`SYMBOL_RESUMED`). Hết phiên thì khớp một lần rồi mã về lịch bình thường.
- Trạng thái mã trên giao diện: Tạm ngừng → Khớp định kỳ sau tạm ngừng (đếm ngược) → Bình thường.

### Lệnh thỏa thuận cơ bản (Đợt 8B)
- Phiếu "Lệnh thỏa thuận" (Sổ lệnh, tab "Thỏa thuận", `?tab=thoa-thuan`): tài khoản, mã, chiều, KL, giá, tài khoản đối
  ứng (mô phỏng).
- Kiểm tra (`validatePutThrough`, `src/rules/putThrough.ts`, theo `putThrough` của pack): tối thiểu 20.000 CP trên HOSE,
  5.000 CP trên HNX/UPCoM; bước giá 1 đ; giá trong trần – sàn của mã; HOSE nhận trong giờ giao dịch và phiên thỏa thuận sau
  giờ 14:45–15:00; chưa khớp thì hết hiệu lực lúc 15:00 hoặc khi sang ngày.
- Luồng: gửi → bên đối ứng (mô phỏng) xác nhận hoặc từ chối → khớp. Chỉ hủy được khi chưa khớp; đã khớp thì không sửa, không
  hủy (`PT_MATCHED_LOCKED`).
- Lệnh thỏa thuận là danh sách riêng trong engine, nhật ký riêng (OrderEvent, `parent_order_id` là mã lệnh thỏa thuận);
  không vào bảng khớp lệnh, băng tick hay sổ lệnh, nên không đổi OrderBook3 và không tính vào VWAP khớp lệnh của báo cáo.
- Ngoài phạm vi: trừ room ngoại cho thỏa thuận, quảng cáo thỏa thuận, thỏa thuận nhiều bên, tiền và chứng khoán của bên đối
  ứng (xem `docs/backend-gaps.md` mục 15).

## 8. Quy tắc nghiệp vụ lõi (simulator phải tôn trọng)
- KL được phép sinh lệnh con = total_qty − executed_qty − working (Child chưa kết thúc).
- Tổng khớp không bao giờ vượt total_qty.
- Child UNKNOWN (mất phản hồi Core) vẫn tính là working cho tới khi đối soát xong.
- Mỗi lần khớp có exchange_match_id duy nhất; báo khớp lặp lại thì bỏ qua.
- Mọi thay đổi trạng thái đều ghi một OrderEvent.

## 9. Bộ giả lập (src/mocks)
- Mã: FPT, HPG, VCB, MWG, TCB, VNM, SSI, VHM, MBB, ACB với giá tham chiếu hợp lý. Từ Đợt 8A thêm mã **mô phỏng**:
  XHA, XHB, XHC (niêm yết HNX), XUA, XUB (UPCoM), XETF30 (ETF), CFPT2699 (chứng quyền trên FPT, tỷ lệ 10:1), dùng dãy
  random riêng để giá 10 mã cũ không đổi. Room ngoại theo mã; tài khoản 058C345678 là nhà đầu tư nước ngoài.
- Mỗi mã có bảng giao dịch, loại chứng khoán và phiên theo bảng (`MarketState.board_sessions`).
- Giá nhảy ngẫu nhiên trong biên độ, đúng bước giá; có đồng hồ phiên + nút tua nhanh (x1, x10, x60).
- Engine giả lập: lệnh cha sinh lệnh con theo strategy (Iceberg theo slice, TWAP theo interval…),
  lệnh con khớp dần theo giá thị trường.
- Nút bơm lỗi (màn 4): lệnh con bị từ chối, mất kết nối Core → UNKNOWN rồi tự đối soát,
  báo khớp trùng, dữ liệu giá trễ → lệnh cha PAUSED_SYSTEM.
- Có sẵn 13 lệnh mẫu để demo ngay khi mở:
  - 8 lệnh ở nhiều trạng thái khác nhau.
  - 5 lệnh đã hoàn tất ở 1–4 phiên trước (TWAP, POV, VWAP, HUNT, Iceberg). Cùng lệnh Iceberg đã hoàn tất sẵn có, bộ
    lệnh mẫu có đủ 5 chiến lược, cả mua và bán, cả có lợi và bất lợi so với arrival. Lần khớp trải theo thời gian, kèm
    tick thị trường sinh tất định trong khoảng chạy của từng lệnh.
- Tham số tùy chọn:
  - Stop Limit `slice_qty` (chỉ qua API và Chế độ Demo): kích hoạt xong thì chia lệnh con như Iceberg, mỗi lần một phần, phần trước xong mới gửi
    phần sau.
  - HUNT `max_levels` và `remainder_passive` (từ Đợt 4 có ô nhập trên ticket, xem mục 15):
    - Khi giá về mức săn, quét tối đa `max_levels` mức phía đối ứng, chỉ các mức không vượt giá giới hạn (giá tối
      đa khi mua). Mỗi mức một lệnh con LO đúng giá mức đó.
    - Chưa có mức hợp lệ thì thử lại nhịp sau, tới hạn `max_wait_min`.
    - Quét xong: `remainder_passive` = 1 thì phần còn lại đặt một lệnh LO tại giá tốt nhất cùng phía (chặn bởi giá
      giới hạn); 0 thì kết thúc lệnh (EXPIRED).
    - Sổ lệnh lấy từ `quote.depth`; không có thì dựng 5 mức tất định từ bid, ask.
- Sổ lệnh 3 mức mỗi mã (Đợt 4): xem mục 14.
- Core hủy phần chưa khớp của lệnh con (`cancelChildByCore`): lệnh con CANCELLED, lệnh cha giữ phần đã khớp.
- Băng tick khớp toàn thị trường (`src/mocks/marketTape.ts`):
  - Mỗi nhịp ghi lần khớp của bộ giả lập và của chính OMS (thời điểm, giá, KL).
  - Giữ 5 ngày giao dịch gần nhất, tối đa 40.000 tick.
  - Lưu ở khóa localStorage riêng.

## 10. Giao diện
- Tiếng Việt toàn bộ giao diện. Số căn phải, font số đều nhau (tabular-nums).
- **Theme (Đợt 9)**, chi tiết ở [docs/theme.md](theme.md):
  - Theme: Tối (mặc định), Sáng, Tương phản cao tối, Tương phản cao sáng.
  - Bảng màu mù màu xanh–cam đè lên theme bất kỳ.
  - Chọn ở trang `/cai-dat` (mọi vai trò), nút Sáng/Tối trên thanh trên, hoặc Ctrl+K. Lưu riêng theo tài khoản demo.
  - "Theo hệ thống" theo `prefers-color-scheme` và `prefers-contrast: more`. `forced-colors` để hệ điều hành quyết định
    màu.
  - Script nội tuyến trong `<head>` đặt `data-theme` trước lần vẽ đầu, nên tải lại không nháy sai theme. localStorage lỗi
    thì dùng Tối.
- **Màu chỉ khai báo ở `src/config/theme.ts`.**
  - `npm run tokens` sinh `src/styles/tokens.css`.
  - Component dùng lớp token (`text-price-up`, `bg-surface`, `bg-status-danger-bg`, `bg-buy`…) hoặc `var(--token)`.
  - Recharts dùng `var(--token)` nên đổi màu ngay khi đổi theme.
  - `npm run lint` chặn mã màu viết cứng (ESLint và `scripts/check-colors.mjs`).
- **Màu giá theo thông lệ thị trường VN (không phải quy định của Sở):** trần tím, tăng xanh lá, tham chiếu vàng, giảm
  đỏ, sàn xanh lam.
  - Mỗi theme có bộ giá trị riêng đạt ≥ 4,5:1 (≥ 7:1 ở tương phản cao) trên mọi nền nó xuất hiện.
  - Theme sáng: giá tham chiếu chữ đậm trên chip vàng nhạt.
- **Không chỉ dựa vào màu:**
  - giá có ▲/▼ so tham chiếu, trần "T", sàn "S" (tên đọc "Giá trần"/"Giá sàn");
  - cột +/− có dấu;
  - trạng thái lệnh luôn có chữ (6 cặp token `--status-*`, khai báo nhãn trong `src/config`).
- **Nhấp nháy khi giá đổi:** nền nhạt cộng mũi tên ↑/↓ trong 600ms. Tắt khi `prefers-reduced-motion` hoặc người dùng
  tắt trong Cài đặt.
- **Mật độ, cỡ chữ, ẩn số:**
  - mật độ Thoáng/Gọn (hàng bảng thấp hơn); cỡ chữ 90/100/110%;
  - "Ẩn số tiền và bps khi trình chiếu" che bps/slippage so arrival hoặc VWAP (`•••`) và số tài khoản (`058C•••456`).
    Chỉ đổi phần hiển thị.
- **Test:**
  - Vitest kiểm mọi cặp token theo ngưỡng WCAG;
  - axe (`@axe-core/playwright`, luật color-contrast) = 0 vi phạm trên các màn chính ở 4 theme và mù màu;
  - ảnh chuẩn từng theme ở 1440 và 1366.

## 11. Nghiệm thu mỗi màn
- `npm run lint` và `npm run build` không lỗi; có test Vitest cho bộ kiểm tra luật giao dịch (mục 7).
- Chạy `npm run dev`, mở localhost, thao tác được đúng luồng của màn đó.
- Commit theo Conventional Commits, ví dụ `feat(frontend): add order ticket with HOSE validation`.

## 12. Chỉ số hiệu quả thực hiện

Màn `/bao-cao/hieu-qua` và thẻ "Hiệu quả" ở `/so-lenh/:id` dùng chung các hàm thuần trong `src/utils/execQuality.ts`.
Giá là số nguyên đồng. Kết quả phép chia giữ nguyên phần lẻ, chỉ làm tròn khi hiển thị.

### Công thức
| Chỉ số | Công thức | Thiếu dữ liệu |
|---|---|---|
| Giá BQ | Σ(giá × KL khớp) / ΣKL khớp của lệnh cha; chỉ tính lệnh vào (lệnh thoát của Bracket không tính) | Chưa khớp → "—" |
| Arrival | `MarketSnapshot.arrival_price`, chụp lúc lệnh cha kích hoạt | Không có snapshot → "—" |
| Khoảng tính | [`arrival_timestamp`, lúc hoàn tất]; lệnh chưa kết thúc tính tới hiện tại. Lúc hoàn tất = `updated_at` khi lệnh ở trạng thái kết thúc | Không có arrival → không xác định |
| VWAP thị trường | Σ(giá × KL) / ΣKL của tick khớp toàn thị trường của mã trong khoảng tính (tính cả hai đầu) | Không có tick → "—" |
| Chênh lệch (%) | (Giá BQ − mốc) / mốc × 100, mốc là Arrival hoặc VWAP | "—" |
| Có lợi | MUA: chênh lệch < 0. BÁN: chênh lệch > 0. Bằng 0 thì không tô màu | — |
| bps có lợi | Chênh lệch × 100, đổi dấu theo chiều để dương luôn là có lợi | "—" |
| Tỷ lệ tham gia | KL khớp của lệnh / KL khớp toàn thị trường của mã trong khoảng tính, chặn trần 100% | KL thị trường = 0 → "—" |

Ví dụ kiểm tra:
- MUA giá BQ 92.380, arrival 92.500: chênh lệch −0,13%, có lợi, +13 bps.
- BÁN giá BQ 61.400, arrival 61.500: chênh lệch −0,16%, bất lợi, −16 bps.

KL toàn thị trường đã gồm lần khớp của chính lệnh, nên tỷ lệ tham gia không vượt 100%. Hàm vẫn chặn trần để phòng
dữ liệu lệch.

Quy ước dấu khác nhau giữa các màn:
- KPI "Slippage TB" ở Trung tâm lệnh là chi phí: dương là bất lợi.
- Báo cáo hiệu quả dùng bps có lợi: dương là có lợi.
- Thẻ "Hiệu quả" ở chi tiết lệnh ghi % kèm chữ "có lợi" / "bất lợi", để không ngược dấu với dòng bps sẵn có của
  phần tóm tắt.

### Màn báo cáo
- **Bộ lọc:**
  - Khoảng thời gian: Hôm nay, hoặc 5 phiên (mặc định; 5 ngày giao dịch gần nhất, bỏ thứ Bảy và Chủ nhật). Lệnh đã
    hoàn tất xét theo ngày hoàn tất.
  - Trạng thái: Đã hoàn tất (mặc định), hoặc Gồm cả đang chạy (lệnh đang chạy luôn thuộc khoảng thời gian).
  - Chiến lược, chiều, mã CK.
  - Tài khoản: chỉ DEALER và OPS.
- **Phạm vi dữ liệu:** giống Sổ lệnh. CUSTOMER thấy tài khoản mình, DEALER thấy các tài khoản quản lý, OPS thấy tất cả.
- **4 KPI:**
  - Số lệnh đã hoàn tất.
  - Tổng KL khớp.
  - Lệnh tốt hơn arrival, dạng x / y; y là số lệnh tính được chênh lệch so với arrival.
  - Tỷ lệ tham gia TB: trung bình cộng của các lệnh có số liệu.
- **Bảng:**
  - Cột: Mã lệnh, Mã CK, Chiều, Chiến lược, Giá BQ, Arrival, VWAP, So arrival, So VWAP, Tham gia.
  - Số căn phải, font mono; xanh là có lợi, đỏ là bất lợi.
  - Bấm tiêu đề cột để sắp xếp; ô "—" luôn nằm cuối. Bấm dòng để mở /so-lenh/:id.
- **Biểu đồ:**
  - Cột ngang, mỗi cột là bps có lợi của một chiến lược, bình quân gia quyền theo KL khớp.
  - Trục 0 ở giữa: phải là có lợi, trái là bất lợi.
  - Bên dưới có một câu nhận xét sinh theo quy tắc: nêu chiến lược kém nhất và tốt nhất, kèm số bps và số lệnh. Chỉ dùng
    số đã tính.

### Xuất Excel (CSV)
- UTF-8 có BOM ở đầu file để Excel đọc đúng tiếng Việt; xuống dòng kiểu CRLF.
- Ngăn cột bằng `;`. Số dùng dấu phẩy thập phân, không có dấu phân cách hàng nghìn. Đây là thiết lập vùng Việt Nam của
  Excel, nên số mở ra vẫn là số, không thành chữ.
- Không ghi dòng `sep=;`, vì có dòng đó thì Excel bỏ qua BOM và làm hỏng dấu tiếng Việt.
- Đúng 10 cột của bảng, đúng các dòng đang lọc và theo thứ tự đang sắp xếp. Ô không tính được để trống.
- Tên file: `hieu-qua-thuc-hien-YYYY-MM-DD.csv`. Không dùng thư viện xlsx.

## 13. Chế độ Demo

App tự chạy 6 kịch bản E2E của [TC-E2E.md](test-cases/TC-E2E.md) để trình bày. Kịch bản trình bày:
[demo-script.md](demo-script.md).

### Kiến trúc
- **Kịch bản là dữ liệu**, không viết cứng trong component.
  - Mỗi file trong `src/demo/scenarios/` là một kịch bản: `{ id, number, title, summary, tcRefs, seed, setup, steps }`.
  - Mỗi bước: `{ id, caption, action: { type, params }, route?, highlight?, waitMs?, settle?, checks? }`.
    - `caption`: 1–2 câu tiếng Việt, nói VÌ SAO hệ thống làm vậy.
    - `route`, `highlight`: viết dạng `{order}`, `{child:order:2}`, runner thay bằng mã thật.
    - `checks`: `{ label, fn(state) }`.
- **Action** (`src/demo/actions.ts`) chỉ gọi engine và bộ giả lập; mọi quyết định nghiệp vụ vẫn do engine làm.
  - Các loại: đặt lệnh, khớp thị trường, đặt sổ lệnh, tua / nhảy giờ, bơm lỗi (từ chối, mất ACK trước / sau Core, khớp
    trùng, giá trễ), đối soát, Core báo khớp / hủy phần còn lại, tạm dừng / tiếp tục / hủy lệnh.
  - Riêng kịch bản OMS sập: "sập" (ghi trạng thái ra đĩa, xóa bộ nhớ), Core khớp lúc OMS tắt, "bật lại", nhận báo khớp
    bị lỡ.
- **Runner** (`src/demo/runner.ts`) thuần logic, không phụ thuộc React, không dùng `setTimeout`.
  - Lệnh điều khiển: `play`, `pause`, `next`, `reset`, `setSpeed(1 | 2 | 4)`, `runToEnd`.
  - Mỗi bước:
    1. Mở màn.
    2. Chạy action.
    3. Chờ engine ổn định: tua từng giây giả lập tới khi 3 nhịp liền không có OrderEvent mới, tối đa 120 nhịp.
    4. Chấm check.
    5. Ghi kết quả.
  - Thời gian chờ giữa các bước do UI cấp qua `advanceClock(ms thật)`. Tốc độ chỉ đổi thời gian chờ để người xem đọc,
    không đổi số nhịp giả lập, nên kết quả không phụ thuộc tốc độ.
- **Check chung** (`src/demo/checks.ts`) chạy sau mọi bước, theo mục 8:
  - tổng khớp không vượt `total_qty`;
  - `executed_qty` = tổng Execution của lệnh vào;
  - `allowed = total − executed − working`, với UNKNOWN tính là working;
  - không trùng `client_order_id` / `idempotency_key`;
  - mỗi `exchange_match_id` ghi nhận một lần;
  - trạng thái hiện tại của mọi lệnh cha, lệnh con khớp với OrderEvent cuối cùng của nó.

### Cô lập dữ liệu (`src/demo/session.ts`)
- **Vào Demo:**
  - Lưu bản sao sâu: engine, bộ giả lập giá, băng tick, cấu hình, mọi khóa `oms-*` trong localStorage, store thông báo.
  - Bật cờ `demoGuard`: runtime không ghi trạng thái giả lập vào localStorage.
  - Bộ giả lập chuyển sang chế độ có kịch bản: giá và giờ chỉ đổi theo action.
- **Mỗi kịch bản:** sổ lệnh trống, random của engine có seed cố định, thị trường FPT do kịch bản đặt, nên chạy lại cho
  cùng kết quả.
- **Thoát Demo:**
  - Nạp lại nguyên bản lưu, trả random về `Math.random`, tắt cờ.
  - Điều hướng qua Sổ lệnh trước khi đổi dữ liệu, để màn chi tiết của lệnh sắp biến mất không gọi API.

### Giao diện
- **Ai thấy nút "▶ Demo":** vai trò OPS; mọi vai trò khi `VITE_DEMO_MODE=true`. Phần chạy Demo nạp chậm (lazy), chỉ
  tải khi vai trò được dùng.
- **Thanh trên khi đang chạy:**
  - Có nhãn vàng "ĐANG CHẠY DEMO · Scenario n" và nút "Thoát Demo".
  - Ẩn nút tua x1/x10/x60 và "Về đầu ngày" để không phá kịch bản.
- **Khung điều khiển nổi ở giữa đáy:**
  - Nội dung: tên kịch bản, "Bước x / y", thanh tiến độ, chú thích (16px), Phát / Tạm dừng, Bước tiếp, Làm lại, x1 / x2 / x4.
  - Kéo bằng thanh tiêu đề; thả gần góc thì bám góc.
  - Phím tắt chỉ khi đang Demo: Space, →, Esc.
- **Tô sáng phần tử:**
  - Viền vàng 2px và nền vàng nhạt, tự cuộn tới; không che phần còn lại của màn.
  - Áp theo `[data-demo-id]` bằng rule CSS, nên React vẽ lại phần tử cũng không mất.
  - Các `data-demo-id` đang có:
    - Sổ lệnh: `order-row-<mã>`.
    - Chi tiết lệnh: `order-status`, `order-executed`, `order-params`, `child-<mã>`, `child-status-<mã>`,
      `executions`, `event-log`, `progress-chart`, `exec-quality`.
    - Trung tâm lệnh: `kpi-running`, `kpi-filled`, `kpi-attention`, `kpi-slippage`, `attention-table`.
    - Giám sát hệ thống: `ops-alerts`.
    - Sổ lệnh 3 mức: `orderbook3`, `orderbook-level-ask-<giá>`, `orderbook-level-bid-<giá>`, `orderbook-spread`.
    - HUNT: `hunt-sweep`, `hunt-step-<n>`, `hunt-avg`, `hunt-remainder`, `hunt-replay`.
    - Mẫu chiến lược: `template-strip`, `template-<id>`, `template-active`, `template-grid`, `template-card-<id>`,
      `order-template`, `report-template`.
- **Bảng "Điều kiện kiểm tra"** bên phải (300px, thu gọn được): ĐẠT (xanh), KHÔNG ĐẠT (đỏ), CHỜ (xám); nội dung trang
  chừa lề phải tương ứng.
- **Hộp kết quả:**
  - Số bước, số điều kiện đạt / tổng, thời gian giả lập đã chạy, các điều kiện không đạt.
  - Nút: Chạy lại, Kịch bản khác, Xuất kết quả, Thoát Demo.
  - File xuất: CSV UTF-8 có BOM, các cột Kịch bản; Bước; Chú thích; Điều kiện; Kết quả; Giờ giả lập.

### 9 kịch bản
| # | Kịch bản | TC | Ghi chú |
|---|---|---|---|
| 1 | Iceberg thành công | 050, 051, 052, 220, 231 | Core khớp thiếu rồi hủy phần còn lại; lệnh con kế tiếp theo KL đã khớp thật |
| 2 | Stop kích hoạt → Iceberg | 010, 011, 012, 050 | Stop Limit bán có `slice_qty`. Tài liệu ghi lệnh mua "giá ≤ ngưỡng"; Stop của engine kích hoạt lệnh mua khi giá tăng, nên dùng lệnh bán |
| 3 | POV điều chỉnh theo thị trường | 070, 071, 072, 232 | Tài liệu ghép với Adaptive; engine chưa có Adaptive nên chỉ trình diễn phần POV |
| 4 | HUNT quét mức + phần còn lại | 090, 091 | Quét tối đa 3 mức trong giá tối đa, phần còn lại đặt bị động. Từ Đợt 4 tô sáng OrderBook3 và khung "HUNT quét từng mức"; kiểm thêm khớp tại giá mức (BQ 118.157) và sổ lệnh dồn mức |
| 5 | Core mất ACK → UNKNOWN → đối soát | 140, 141, 150 | Có thêm một báo khớp trùng bị bỏ qua |
| 6 | OMS sập → khôi phục | 200, 202 | "Đĩa" là bản ghi JSON trong bộ nhớ; backend thật dùng CSDL |
| 7 | Sửa lệnh: mất / giữ ưu tiên | KRX-AMEND | Đợt 8A. LO 1.000 CP; giảm KL giữ ưu tiên, đổi cả hai bị từ chối, đổi giá và tăng KL mất ưu tiên |
| 8 | Lô lẻ khớp trong ATC | KRX-ODD | Đợt 8A. Lô lẻ 150 CP bị từ chối; LO lô lẻ 50 CP đặt 14:35 khớp ở giá ATC |
| 9 | Ngày 28/12/2026: mã HNX sang HOSE | KRX-TRANSFER | Đợt 8A. XHA (mô phỏng) theo luật HNX ngày 23/12, ngừng giao dịch 24/12, theo luật HOSE từ 28/12 |
| 10 | Mã hạn chế khớp định kỳ 15 phút | KRX-RESTRICTED | Đợt 8B. XRS: LO chỉ khớp lúc hết lượt 09:30; lô lẻ, MTL, HUNT bị chặn; khóa sửa 5 phút cuối lượt |
| 11 | Tạm ngừng và giao dịch lại | KRX-HALT | Đợt 8B. FPT tạm ngừng → lệnh PAUSED_SYSTEM; giao dịch lại → phiên định kỳ 15 phút, lệnh tự chạy và khớp |
| 12 | Thỏa thuận sau giờ 14:45–15:00 | KRX-PT | Đợt 8B. Dưới 20.000 CP, ngoài biên bị từ chối; 20.000 CP đối ứng xác nhận thì khớp, không đổi sổ lệnh |

Kịch bản 1–9 không đổi chú thích: luật của Đợt 8A, 8B không đổi hành vi các bước của chúng.
Test: `src/demo/scenarios.test.ts` chạy cả 12 kịch bản headless, mọi check phải ĐẠT, chạy 2 lần cho kết quả giống nhau.

## 14. Sổ lệnh 3 mức (Đợt 4)

### Dữ liệu (`src/mocks/depth.ts`, hàm thuần)
- Mỗi mã có `quote.depth = { bids, asks }`, mỗi phía 3 mức `{ price, qty, own_taken? }`.
- Luật giao dịch (mục 7; bước giá theo bảng và loại chứng khoán của mã):
  - Giá đúng bước giá theo vùng: dưới 10.000 bước 10, 10.000–49.950 bước 50, từ 50.000 bước 100. Đi từng bước qua
    ngưỡng, ví dụ 49.950 → 50.000 → 50.100.
  - Giá nằm trong trần – sàn; gần trần (sàn) thì phía bán (mua) có thể ít hơn 3 mức.
  - KL là bội số 100.
  - Giá bán 1 > giá mua 1; các mức cùng phía cách nhau từ 1 bước giá trở lên.
  - `validateDepth` kiểm đủ các luật này.
- Các hàm:
  - `generateDepth`: sinh 3 mức mỗi phía từ giá mua, bán tốt nhất. Mỗi mức 1.000–9.900 CP.
  - `consumeLevel`: lệnh của OMS lấy KL ở một mức, tối đa bằng KL đang có (`taken ≤ qty` của mức). Mức hết KL thì bỏ,
    các mức sau dồn lên và sinh mức mới phía sau. Mức còn KL ghi `own_taken` để màn hình hiện số âm.
  - `replenishDepth`: mỗi nhịp phiên liên tục, mỗi mức có 30% khả năng được thêm 1–5 lô (tối đa 20.000 CP/mức).
    `own_taken` tự xóa sau 3 nhịp.
  - `rebaseDepth`: giá khớp đổi thì neo lại theo mua 1, bán 1 mới, giữ KL của các mức còn hợp lệ.
- Bộ giả lập dùng dãy random riêng (có seed) cho sổ lệnh, nên dãy giá cũ không đổi.
- Chế độ có kịch bản (Demo): sổ lệnh chỉ đổi qua `setDepth` và khi bị lệnh của OMS lấy, để kết quả lặp lại được.
- Giá mua, bán tốt nhất của quote luôn bằng mức đầu của sổ lệnh.

### Phiên khớp lệnh định kỳ (ATO, ATC)
- OrderBook3 hiện khung "Phiên khớp lệnh định kỳ (Phiên ATO/ATC)" kèm **giá dự kiến khớp**.
- Các mức hiển thị mờ, chỉ để tham khảo. Dòng giữa ghi rõ không có chênh lệch mua bán liên tục.

### Component `OrderBook3` (`src/components/OrderBook3.tsx`)
- Bảng 3 cột: Khối lượng | Giá | Bên. Bán ở trên (Bán 3 → Bán 1), dòng "Chênh lệch mua bán: x đ (n bước giá)" ở giữa,
  mua ở dưới (Mua 1 → Mua 3). Thiếu mức thì hiện "—".
- Màu giá theo `getPriceColor`: trần tím, tăng xanh lá, TC vàng, giảm đỏ, sàn xanh lam.
- Ô đổi giá trị nháy màu 600ms (`.flash-cell`; tắt khi người dùng chọn giảm chuyển động).
- Phần KL vừa bị lệnh của mình lấy hiện số âm màu vàng, ví dụ `-1.600`.
- Có `onPickPrice` thì mỗi mức bấm được, dùng chuột hoặc Enter/Space:
  - Màn Đặt lệnh: điền giá vào ô Giá giới hạn, hoặc ô giá đầu tiên nếu loại lệnh không có giá giới hạn. Form vẫn kiểm
    tra như cũ.
- `highlightPrice`: viền nhấn mức đang bị HUNT quét.
- `depth`: thay sổ lệnh trực tiếp bằng ảnh chụp (khi xem lại).
- Trạng thái: đang tải (`LoadingState`); chưa chọn mã, chưa có sổ lệnh (`EmptyState`).
- Vị trí:
  - **Đặt lệnh:** ≥1536px là 3 cột bảng giá | sổ lệnh | ticket. Ở 1366–1440px sổ lệnh nằm ngay trên ticket, cùng cột
    phải.
  - **Chi tiết lệnh:** sổ lệnh chỉ đọc của mã thuộc lệnh, cạnh thẻ Hiệu quả. Với HUNT thì nằm cạnh khung quét.

## 15. HUNT quét từng mức (Đợt 4)

### Quy tắc (`planHuntSweep` trong `src/utils/huntSweep.ts`, hàm thuần)
Giữ nguyên quy tắc cũ; Đợt 4 đưa phần tính toán ra hàm thuần và cho lệnh con quét khớp theo sổ lệnh.
- Quét lần lượt từ mức tốt nhất phía đối ứng:
  - MUA quét phía bán, giá tăng dần, không vượt **giá tối đa** (giá giới hạn).
  - BÁN quét phía mua, giá giảm dần, không thấp hơn **giá tối thiểu**.
- Chỉ xét tối đa `max_levels` mức (ticket cho nhập 1–3, bằng số mức hiển thị).
- Mỗi mức trong giới hạn sinh một lệnh con LO đúng giá mức, KL = min(KL của mức, KL còn thiếu).
- Dừng khi đủ KL hoặc hết mức trong giới hạn.
- Trạng thái từng mức trong kế hoạch: TAKE (lấy), UNUSED (trong giới hạn nhưng đã đủ), OUT_OF_LIMIT (vượt giới hạn).
- Phần còn lại theo `remainder_passive`:
  - 1, "Chờ ở giá tốt nhất": một LO tại giá tốt nhất cùng phía, chặn bởi giá giới hạn.
  - 0, "Hủy phần còn lại": lệnh kết thúc (EXPIRED).
  - Chưa có tùy chọn chuyển phần còn lại sang chiến lược khác (xem backend-gaps mục 11).
- Ví dụ: MUA 8.000, mức 27.650 có 6.400, mức 27.700 có 9.800 → lấy 6.400 + 1.600, giá BQ 27.660.

### Khớp
- Lệnh con quét khớp ngay **tại giá của mức**, tối đa KL đang có ở mức (trừ phần lệnh khác đã lấy trong cùng nhịp).
- Engine báo các lần lấy qua `drainDepthTakes()`; runtime trừ KL đó khỏi sổ lệnh của bộ giả lập
  (`marketSimulator.consumeDepth`).
- Các chiến lược khác và lệnh chờ phần còn lại vẫn khớp theo giá khớp gần nhất như trước.
- Quote không có sổ lệnh (test cũ) thì giữ hành vi cũ.

### Ghi nhận
- Event `DECISION` giữ `old_value = HUNT_SWEEP:<số mức trong giới hạn>`, `new_value = LEVELS:<giá,…>`.
- Event có thêm trường `sweep_plan`: các mức, KL lấy, KL còn thiếu, mã lệnh con của từng mức, giá BQ dự kiến, phần còn
  lại, cách xử lý, và ảnh chụp sổ lệnh lúc quét.

### Giao diện "HUNT quét từng mức" (`src/pages/OrderDetail/HuntSweepPanel.tsx`)
- Có ở Chi tiết lệnh HUNT, và ở dạng gọn ngay trong hộp "Đặt lệnh thành công".
- Hàng tóm tắt: cần mua/bán, giá tối đa/tối thiểu, đã khớp khi quét, giá bình quân. Chưa khớp thì hiện giá BQ dự kiến.
- Mỗi bước có một câu, ví dụ "Quét mức 27.650: lấy 6.400, còn thiếu 1.600", và nhãn trạng thái: Đã khớp / Đang chờ /
  Không cần dùng / Vượt giới hạn giá / Đã hủy.
- Dòng phần còn lại, ví dụ "Phần còn lại 3.000: chờ ở giá 117.900".
- Mức đang bị quét (lệnh con quét đầu tiên chưa khớp xong) được viền nhấn trên OrderBook3 bên cạnh.
- Nút **Xem lại**: phát lại từng bước, mỗi 700ms. Sổ lệnh khi đó là ảnh chụp lúc quét, mức đang phát được viền nhấn.
- Chưa tới giá săn thì hiện trạng thái trống "Chưa đến giá săn …". Lệnh không đặt số mức quét thì ghi rõ là vào một
  lệnh tại giá giới hạn.

## 16. Mẫu chiến lược (Đợt 4)

### Dữ liệu (`src/config/strategyTemplates.ts`)
- Mỗi mẫu: `{ id, name, description, strategy_type, side?, total_qty?, params, suitableWhen, roles?, hint? }`.
- Giá trong `params` không ghi cứng mà tính lúc chọn mẫu (`applyTemplate`, hàm thuần):
  - Giá: giá khớp, mua 1 hoặc bán 1, dịch n bước giá, kẹp trần – sàn.
  - Khoảng trượt: n bước giá của giá tham chiếu.
  - Giờ: theo đồng hồ giả lập, kẹp trong 09:15–14:45.
- Cách tính này giữ mọi mẫu đúng luật giao dịch (mục 7) ở mọi vùng giá và mọi giờ trong ngày (có test). Từ Đợt 8A giờ
  phiên, bước giá lấy từ gói luật của mã, và giá điền sẵn đi qua `checkPrice` (sai thì hiện cảnh báo).

| id | Tên | Loại | Vai trò |
|---|---|---|---|
| `iceberg-quiet` | Mua âm thầm | Iceberg, mua 20.000, mỗi phần 2.000 | Mọi vai trò |
| `twap-2h` | Bán êm trong 2 giờ | TWAP, bán 30.000, chu kỳ 10 phút | Mọi vai trò |
| `pov-10` | Theo nhịp thị trường | POV 10%, tối đa 15% | Dealer, Vận hành |
| `vwap-day` | Bám VWAP cả phiên | VWAP 09:15–14:30 | Dealer, Vận hành |
| `hunt-liquidity` | Mua nhanh khi có thanh khoản | HUNT, quét tối đa 3 mức, phần còn lại chờ | Dealer, Vận hành |
| `stop-loss-trailing` | Cắt lỗ tự động | Trailing Stop bán, khoảng trượt 3 bước giá | Mọi vai trò |

- `getVisibleTemplates(role, enabledStrategies)` ẩn mẫu của vai trò không được thấy và mẫu của loại lệnh đang bị vận
  hành tắt.

### Dải mẫu trên ticket Đặt lệnh (`TemplateStrip`)
- Bấm một thẻ thì điền sẵn chiều, loại lệnh, KL và tham số; tài khoản và mã giữ như đang chọn.
- Không tự đặt lệnh. Người dùng sửa được mọi ô, và form kiểm tra luật giao dịch (mục 7) như cũ.
- Thẻ đang chọn có viền nhấn, kèm dòng "Đã điền theo mẫu …" và lưu ý của mẫu.
- Nút "Bỏ chọn mẫu" giữ nguyên giá trị đã điền. Đổi loại lệnh khác loại của mẫu thì tự bỏ chọn.

### Trang `/mau-chien-luoc`
- Mục "Mẫu chiến lược" trên thanh bên đã mở, cần quyền `place_order`.
- Lưới thẻ: tên, loại, chiều, mô tả, tham số mặc định (tính theo mã đang chọn), "Phù hợp khi…", lưu ý.
- "Dùng mẫu này" mở `/dat-lenh?mau=<id>`. Ticket điền mẫu một lần rồi xóa tham số khỏi địa chỉ; không dùng localStorage.

### Ghi nhận mẫu đã dùng
- Lệnh đặt từ mẫu gửi `template_id`. Trường này được lưu ở `ParentOrder.template_id` và ở event CREATE
  (`OrderEvent.template_id`); cả hai là trường tùy chọn.
- Báo cáo hiệu quả hiện "Mẫu: <tên>" dưới cột Chiến lược. CSV ghi "<chiến lược> (mẫu: <tên>)" trong cùng ô, để không
  đổi bộ cột cũ.
- Chi tiết lệnh hiện tên mẫu cạnh loại lệnh.

## 17. Giải thích lệnh (Đợt 5)

Mọi câu giải thích sinh bằng **quy tắc** từ dữ liệu có sẵn, không gọi AI và không ước đoán số.

### Mã lý do trong engine
Mỗi lần đổi trạng thái, `OrderEvent` có thêm `reason_code` (tùy chọn, ngoài ERD). Lệnh con bị Core từ chối có thêm
`reject_code`: `LOT_SIZE`, `TICK_SIZE`, `MAX_QTY`, `PRICE_BAND`, `OTHER`.

| Nhóm | `reason_code` |
|---|---|
| Hệ thống tạm dừng | `PRICE_OUT_OF_BAND`, `CHILD_REJECTED_REPEAT`, `MARKET_DATA_STALE`, `KILL_SWITCH` |
| Người dùng, vận hành | `USER_PAUSE`, `USER_RESUME`, `USER_CANCEL`, `USER_REPRICE`, `OPS_REOPEN`, `MARKET_DATA_RESUMED` |
| Hết hạn | `DAY_END`, `VALID_TO_REACHED`, `WINDOW_END`, `HUNT_MAX_WAIT`, `HUNT_NO_LEVEL` |
| Lệnh con | `CORE_REJECT`, `ACK_TIMEOUT`, `RECONCILED_KEPT`, `RECONCILED_CANCELLED` |
| Quyết định của chiến lược | `POV_THROTTLED` (ghi một lần lúc bắt đầu bị chặn), `HUNT_WAITING_LEVEL` (ghi một lần) |
| Kết thúc | `COMPLETED` |

Ô bơm lỗi "Core từ chối" ở màn Vận hành có thêm ô chọn lý do từ chối.

### Hàm thuần (`src/explain/`)
- `buildExplainContext` (`context.ts`) gom mọi dữ kiện của lệnh vào `ctx`. Số tính thêm (giá trần, sàn, bước giá,
  khoảng cách tới giá kích hoạt) dùng đúng hàm của `src/utils/hose.ts`. Thiếu dữ kiện thì để `null`.
- `REASONS` (`reasons.ts`): mỗi mã có `appliesTo`, `title`, `template(ctx)`, `actions[{label, kind, roles?, enabled(ctx)}]`,
  `sources(ctx)`. Câu không có số viết cứng; mọi số lấy từ `ctx`.
- `explainOrder(order, children, events, market, role, extra?)` (`explain.ts`) trả
  `{ code, title, text, short, actions, sources, context }`. Không ném lỗi; thiếu dữ kiện thì câu nói "chưa đủ dữ liệu".
- `explainChild(child, events)`: câu riêng cho từng lệnh con.

| Mã | Khi nào | Nội dung chính |
|---|---|---|
| `PRICE_OUT_OF_BAND` | PAUSED_SYSTEM vì giá ngoài biên độ | Giá nào, tham chiếu, ±7%, trần/sàn đã làm tròn theo bước giá, giá gợi ý |
| `SESSION_LOCKED` | Lệnh đang chạy trong ATO, ATC | Vì sao nút Sửa, Hủy bị khóa |
| `STALE_MARKET_DATA` | Giá trễ | Độ trễ, ngưỡng (chỉ vận hành đọc được ngưỡng) |
| `KILL_SWITCH` | Kill switch | Phạm vi, giờ kích hoạt, phải mở lại thủ công |
| `CHILD_REJECTED` | Core từ chối | Chu kỳ, số lần liên tiếp, lý do (lô 100, bước giá, vượt 500.000…) |
| `CHILD_UNKNOWN` | Lệnh con mất ACK | Đang đối soát, vì sao chưa gửi lại |
| `CONDITION_WAITING` | Stop, TP, OCO, HUNT chưa kích hoạt | Giá kích hoạt, còn cách bao nhiêu đồng và bao nhiêu bước giá |
| `POV_THROTTLED` | POV chạm % tối đa | KL thị trường, % tối đa, KL được đặt |
| `HUNT_NO_LEVEL` | HUNT chưa có mức trong giới hạn, hoặc hết mức rồi hủy phần còn lại | Giới hạn giá, giá tốt nhất, phần bị hủy |
| `PAUSED_USER` | Người dùng tạm dừng | Ai, lúc nào; nút Tiếp tục |
| `EXPIRED` | Hết hạn | Theo `persistence_mode` và mã hết hạn |
| `COMPLETED` | Hoàn tất | Giá bình quân, so với arrival theo bps (`getExecQuality`) |
| `CANCELLED` | Đã hủy, đang hủy | Ai hủy, phần còn lại |
| `RUNNING`, `NOT_ENOUGH_DATA` | Còn lại | Tiến độ; hoặc "chưa đủ dữ liệu" |

Hành động: `REPRICE` (Sửa giá, điền sẵn giá trần hoặc sàn hợp lệ), `SCROLL_LOG` (Xem nhật ký), `RESUME`,
`REOPEN` (Mở lại), `RECONCILE` (Đối soát ngay), `OPEN_OPS`. Ba hành động cuối chỉ vai trò Vận hành thấy; "Mở lại" chỉ
hiện khi lệnh đang PAUSED_SYSTEM.

### Giao diện
- **ExplainCard** ở đầu Chi tiết lệnh, viền nhấn. Thay khung "Hệ thống đang tạm dừng" cũ và có ở mọi trạng thái:
  tiêu đề ("Vì sao lệnh này đang dừng?"…), câu giải thích, nút hành động, dòng nhỏ "Dựa trên: …".
  - "Xem nhật ký" cuộn tới event liên quan, tô sáng và đưa focus vào dòng đó.
- **Lệnh con**: bấm (hoặc Enter, Space) một dòng ở bảng Lệnh con để hiện câu giải thích riêng ngay bên dưới.
- **Sổ lệnh, Trung tâm lệnh**: rê chuột hoặc Tab vào badge trạng thái để xem câu rút gọn.
  - Danh sách không có lệnh con và nhật ký. Lệnh PAUSED_SYSTEM không rõ mã lý do chỉ ghi "Mở Chi tiết lệnh để xem lý do".

## 18. Thuật ngữ (Đợt 5)

- Từ điển `src/config/glossary.ts`: `{ id, term, short, detail, formula?, example?(ctx) }`, 30 thuật ngữ.
  - `example` dùng số của lệnh đang xem (Chi tiết lệnh truyền vào qua `TermExampleContext`); thiếu số thì không có ví dụ.
- `<Term id="vwap">VWAP</Term>` (`src/components/Term.tsx`): gạch chân chấm.
  - Rê chuột hoặc Tab tới thì hiện tooltip (nghĩa, công thức, ví dụ), Esc đóng.
  - Phần tử nối với tooltip qua `aria-describedby`.
- `Tooltip` (`src/components/Tooltip.tsx`) tự viết, không dùng thư viện. Nằm trong portal, tự lật lên khi thiếu chỗ.
  Đặt lại vị trí khi trang cuộn, vì Tab tới phần tử ngoài màn hình làm trang cuộn.
- Đã gắn ở: KPI Trung tâm lệnh, tiêu đề cột và KPI báo cáo hiệu quả, nhãn ticket Đặt lệnh, các chỉ số ở Chi tiết lệnh,
  nhãn loại lệnh ở thẻ Mẫu chiến lược. Bảng mã động: `STRATEGY_TERMS`, `FIELD_TERMS`, `REPORT_COLUMN_TERMS`.
- Trang `/thuat-ngu` (liên kết ở cuối thanh bên, mọi vai trò): danh sách, ô lọc không dấu, công thức.
  Nhận `?q=` để điền sẵn ô lọc.
- Test quét mã nguồn: mọi `<Term id="…">` và mọi mã trong ba bảng động phải có trong từ điển.

## 19. Tìm nhanh Ctrl+K (Đợt 5)

- Mở bằng Ctrl+K (Cmd+K trên Mac) hoặc nút tìm ở thanh trên cùng. Hộp ở giữa màn hình, nền mờ phía sau.
  - Phím tắt bỏ qua khi đang gõ trong ô nhập khác.
  - Nút hiện đủ chữ "Tìm lệnh, mã, màn hình… Ctrl K" từ 1600px; từ 1440px chỉ còn biểu tượng và phím tắt; hẹp hơn chỉ
    còn biểu tượng, vì thanh trên của vai trò Vận hành đã đầy. Tên đọc cho trình đọc màn hình luôn đủ câu.
- Hàm thuần `src/utils/search.ts`:
  - `buildSearchIndex` lọc theo quyền: lệnh qua `canSeeOrder`, màn hình theo menu của vai trò, "Chạy Demo" theo
    `canUseDemo`, "Dùng mẫu …" theo `getVisibleTemplates`.
  - `normalizeVi` (`src/utils/text.ts`) bỏ dấu, gồm cả đ → d.
  - Điểm: khớp cả chuỗi 100, đầu chuỗi 80, đầu từ 60, giữa chuỗi 30. Câu nhiều từ thì mọi từ phải khớp.
- Nhóm kết quả: LỆNH, MÃ CHỨNG KHOÁN (mở Đặt lệnh với mã; mở Sổ lệnh 3 mức), MÀN HÌNH, THAO TÁC, THUẬT NGỮ.
- ↑ ↓ chọn, Enter mở, Esc đóng; vai trò ARIA combobox/listbox.
- Ô trống hiện 5 mục mở gần nhất (`src/utils/recentItems.ts`, localStorage bọc try/catch).
  Chỉ hiện mục mà vai trò hiện tại còn thấy được.

## 20. Tour lần đầu (Đợt 5)

- 5 bước (`src/tour/tourSteps.ts`), tô sáng theo `data-demo-id`:
  1. Thanh bên (`sidebar`).
  2. Đồng hồ phiên và nút tua (`session-status`).
  3. "Lệnh cần chú ý" (`attention-card`, mở `/trung-tam`).
  4. Đặt lệnh và Mẫu chiến lược (`nav-dat-lenh`, `nav-mau-chien-luoc`).
  5. Chuông thông báo (`notification-bell`).
- Mỗi bước 1–2 câu, nút Tiếp / Bỏ qua. Esc là Bỏ qua; Tab chỉ đi giữa hai nút.
- Tự chạy một lần mỗi vai trò. Đã xem hoặc bỏ qua thì lưu `oms-tour-<role>` trong localStorage (try/catch).
  - localStorage bị chặn thì không tự hiện, để không lặp lại ở mỗi lần đăng nhập.
- Không tự chạy khi đang Demo, và đóng nếu Demo bắt đầu. Xem lại từ menu tài khoản: "Xem hướng dẫn".
- Logic ở `src/tour/tourState.ts` (hàm thuần, có test).

## 21. Lịch sử và đối soát (Đợt 7)

Màn `/bao-cao/lich-su` (lazy), nhóm Báo cáo trên thanh bên, mọi vai trò. Ba tab, tab đang mở nằm trên URL
(`?tab=lich-su|nhat-ky|doi-soat`). Tab Đối soát chỉ có với quyền `reconciliation` (DEALER, OPS); khách hàng gõ
`?tab=doi-soat` thì về tab Lịch sử lệnh.

### Dữ liệu

- `GET /api/history`: lệnh, lệnh con, khớp, arrival và **toàn bộ** event của các lệnh người dùng được xem (`canSeeOrder`).
  Với khách hàng, `user_id` không phải của chính họ (trừ `SYSTEM`, `seed`) đổi thành `KHAC`, hiện "Người dùng khác"
  (`maskAuditEvents`, `src/utils/audit.ts`).
- Lệnh mẫu có đủ 5 phiên gần nhất (`src/mocks/seedOrders.ts`, mục `past`): hủy, hết hạn DAY_END, GTD hết hạn sau 2
  phiên, MULTI_SESSION hủy ở phiên 2; lệnh nhiều phiên có event `DECISION SESSION:<ngày> → CARRY_OVER:<KL còn lại>`
  (như `closeDay` của engine). Lệnh "hôm qua" là phiên giao dịch liền trước, không phải ngày lịch.
- **Sổ phía Core** trong engine (`CoreLedgerEntry`, `src/types/recon.ts`): mỗi lệnh con Core đang giữ, kèm trạng thái
  và KL khớp Core ghi nhận. Ghi ở ACK, timeout sau khi Core tạo lệnh (Core có lệnh dù OMS chưa có ACK), khớp (đúng
  một lần, báo khớp trùng không cộng), hủy, hết hạn. Lưu cùng trạng thái engine; bản lưu cũ thì dựng lại từ lệnh con.

### Tab Lịch sử lệnh (`src/utils/history.ts`)

- Dòng: lệnh COMPLETED, CANCELLED, EXPIRED và lệnh GTD/MULTI_SESSION còn chạy. Cột Ngày (ngày kết thúc, lệnh còn chạy là
  hôm nay, dòng phụ "từ <ngày bắt đầu>"), Mã lệnh, Mã CK, Chiều, Chiến lược, Mẫu, KL đặt, KL khớp, Giá BQ, So arrival,
  Trạng thái cuối, Số phiên (= 1 + số event CARRY_OVER).
- Lọc khoảng ngày Hôm nay / 5 phiên / Tùy chọn (`src/utils/dateRange.ts`). Lệnh nhiều phiên thuộc khoảng nếu
  [ngày bắt đầu, ngày kết thúc] giao với khoảng. Lọc thêm mã CK, chiến lược, chiều, trạng thái (có "Đang chạy nhiều
  phiên"), tài khoản (DEALER, OPS).
- Sắp xếp theo mọi cột; 50 dòng mỗi trang; bấm dòng hoặc Enter mở `/so-lenh/:id`.
- Dòng tổng theo bộ lọc (mọi trang): số lệnh, tổng KL đặt, tổng KL khớp, tỷ lệ hoàn tất = COMPLETED / lệnh đã kết thúc.
- Xuất CSV (UTF-8 BOM, `;`) đúng các dòng đã lọc và sắp xếp, thêm cột Tài khoản.

### Tab Nhật ký kiểm toán (`src/utils/audit.ts`)

- Mọi OrderEvent, mới nhất trước: Thời gian, Mã lệnh cha, Mã lệnh con, Hành động (nhãn + mã), Người thực hiện · Kênh
  (HỆ THỐNG khi `SYSTEM`), Giá trị cũ → mới (`formatEventChange`), `reason_code` kèm câu rút gọn
  (`src/explain/reasonText.ts`).
- Lọc khoảng ngày, hành động (13 loại), người thực hiện, mã lệnh (cha hoặc con, khớp một phần); tìm không dấu trên mọi
  cột. Chỉ đọc. 50 dòng mỗi trang; xuất CSV.

### Tab Đối soát (`src/utils/reconcile.ts`, hàm thuần)

`reconcile(input)` so từng lệnh con tạo trong khoảng (cộng mọi lệnh con chưa kết thúc) với sổ phía Core, cộng kiểm
tra trên lệnh cha. Mỗi dòng một loại:

| Loại | Khi nào | Trạng thái |
|---|---|---|
| `STATUS_MISMATCH` | Trạng thái OMS khác Core; hoặc OMS có lệnh trên sàn mà Core không có. OMS đang chờ hủy mà Core còn sống là bình thường | Mở |
| `QTY_MISMATCH` | `filled_qty` OMS khác KL khớp Core ghi nhận | Mở |
| `UNKNOWN_OPEN` | Lệnh con UNKNOWN quá `UNKNOWN_OPEN_AFTER_SECONDS` (2 giây giả lập, `src/config/reconcile.ts`) | Mở |
| `UNKNOWN_RESOLVED` | UNKNOWN rồi RECOVERY `RECONCILED_KEPT` ("Core có lệnh") hoặc `RECONCILED_CANCELLED` ("Core không có lệnh" / "Core có lệnh, đã hủy") | Đã xử lý (hệ thống) |
| `DUP_FILL_IGNORED` | Mỗi event `DUPLICATE_FILL:<mã khớp>` → IGNORED | Đã xử lý (hệ thống) |
| `PARENT_SUM_MISMATCH` | `executed_qty` lệnh cha khác tổng Execution của lệnh vào | Mở |
| `OVERFILL` | Tổng khớp (OMS hoặc Core) vượt `total_qty`. Phải luôn bằng 0; có thì tô đỏ, "Lỗi nghiêm trọng" | Mở |

- 4 thẻ: Lệnh con đã so, Khớp đúng, Chênh lệch đang mở (Mở + Chờ duyệt; viền đỏ khi > 0), Đã xử lý.
- "Đối soát ngay" (DEALER, OPS): tra Core cho mọi lệnh con UNKNOWN (`reconcileChildNow`, kết cục theo Core), rồi so lại;
  hiện lần chạy gần nhất và người chạy. Màn tự làm mới mỗi giây, nên lỗi vừa bơm ở màn Vận hành hiện ngay.
- OPS "Đánh dấu đã xử lý": bắt buộc ghi chú, ghi OrderEvent `DECISION` với `old_value = RECON:<mã dòng>`,
  `new_value = RESOLVE_REQUESTED`. Maker-checker như màn Cấu hình: một người vận hành khác Duyệt (`RESOLVED`) hoặc
  Từ chối có lý do (`RESOLVE_REJECTED`, về Mở). Người đánh dấu không tự duyệt. DEALER chỉ xem.
- API giả lập: `GET /api/reconciliation?from&to`, `POST /api/reconciliation/run`, `POST /api/reconciliation/decisions`
  (`src/mocks/historyApi.ts`). CUSTOMER nhận 403; DEALER gửi quyết định nhận 403.

### Liên kết

- Trung tâm lệnh: thẻ "Lệnh cần chú ý" có "Xem đối soát (n đang mở)" khi DEALER/OPS có chênh lệch đang mở trong 5 phiên
  (`open_recon_count` của dashboard).
- Ctrl+K: màn "Lịch sử và đối soát" (từ khóa đối soát, kiểm toán, nhật ký); "Mở nhật ký kiểm toán"; "Đối soát ngay" và
  "Xem chênh lệch đang mở" chỉ với quyền `reconciliation` (`?tab=doi-soat&run=1` chạy một lần).
- Thuật ngữ mới: Đối soát (mở rộng), STATUS_MISMATCH, QTY_MISMATCH, DUP_FILL_IGNORED, PARENT_SUM_MISMATCH, OVERFILL,
  Nhật ký kiểm toán.

## 22. Bàn làm việc (Đợt 10A)

Màn `/ban-lam-viec` ("Bàn làm việc", thanh bên nhóm Giao dịch, quyền `place_order` nên mọi vai trò đều thấy) cho dealer
và vận hành: nhiều panel dock được trên một màn, ghép từ component có sẵn, không viết lại. Tách cửa sổ / màn hình thứ hai
để sang Đợt 10B.

### Khung (dockview-react 8.10.0, MIT; xem [licenses.md](licenses.md))
- Kéo tab để dock trái / phải / trên / dưới hoặc gộp vào nhóm tab khác; kéo viền để đổi kích thước; "Thả nổi" một panel.
- Tab mỗi panel:
  - chấm màu nhóm kèm nhãn "Nhóm 1–4" / "Không nhóm", tiêu đề, nút đóng;
  - menu "⋯": đổi nhóm liên kết, Thả nổi, "Tách cửa sổ (Đợt 10B)" bị khóa, Đóng.
- Nút "+" trên thanh tab của mỗi nhóm thêm một panel bất kỳ; một loại panel mở được nhiều lần (ví dụ 2 sổ lệnh 3 mức cho 2
  mã).
- Theme `dockview-theme-oms` (`src/styles/workspace.css`): mọi biến `--dv-*` trỏ về token Đợt 9, nên đủ 4 theme và bảng
  màu mù màu, không có mã màu.

### Panel (`src/workspace/panels.tsx`)

| Panel | Component có sẵn |
|---|---|
| Danh mục theo dõi | `PriceBoardTable` (bảng giá thu gọn) |
| Phiếu lệnh | `OrderTicket` (`embedded`) + `ConfirmDialog` |
| Sổ lệnh 3 mức | `OrderBook3` |
| Sổ lệnh | `OrderBlotter` (tách từ màn Sổ lệnh), mặc định lọc theo mã của nhóm |
| Chi tiết lệnh | `OrderDetailView({ id })` (tách từ màn Chi tiết; gồm ExplainCard, HUNT, lệnh con, nhật ký) |
| Thuật toán đang chạy | `OrderBlotter` lọc `isRunningStatus` |
| Thông báo | `NotificationList` (dùng chung phần hiển thị với chuông) |

- **Mã đang chọn:** component đọc qua `useSymbolScope()` (`src/workspace/symbolScope.ts`).
  - Trong Bàn làm việc, mỗi panel có Provider theo nhóm liên kết.
  - Ở các màn cũ không có Provider, nên dùng `useUiStore.selectedSymbol` như trước; Đặt lệnh, Sổ lệnh không đổi hành vi.
- **Mở lệnh:** bấm mã lệnh trong panel thì mở ở panel Chi tiết lệnh cùng nhóm (chưa có thì mở thêm), không chuyển trang.

### Bố cục mẫu và lưu (`src/workspace/layouts.ts`, `presets.ts`)
- **Hai bố cục mẫu:**
  - "Cơ bản": Danh mục + Phiếu lệnh + Sổ lệnh; mặc định cho khách hàng.
  - "Chuyên nghiệp": thêm Sổ lệnh 3 mức, Thuật toán đang chạy, Chi tiết, Thông báo; mặc định cho dealer, vận hành.
  - Nút "Về mặc định".
- **Lưu trữ:** `localStorage['oms-workspace:<username>']`, bọc try/catch, dạng
  `{ schemaVersion: 2, active, layouts: { <tên>: { dock, groups } } }`.
  - `dock` là `toJSON()` của dockview; `groups` là mã và lệnh của từng nhóm.
  - Tự lưu sau 0,5 giây yên lặng và khi rời trang.
- **Nhiều bố cục có tên** ("Phiên sáng", "Theo dõi HUNT"…): đổi nhanh trong menu Bố cục, lưu thành bố cục mới, xóa,
  xuất / nhập file JSON.
- **`migrateWorkspace()`:**
  - v1 (một bố cục, ID panel cũ `priceBoard`, `book3`, `detail`…) đổi sang loại panel v2;
  - panel lạ và nhóm tách cửa sổ bị bỏ;
  - một bố cục hỏng chỉ bỏ riêng bố cục đó.
- **JSON hỏng hoặc dockview không đọc được:** dùng bố cục mặc định, kèm băng báo nhẹ đóng được; không trắng trang.

### Nhóm liên kết theo màu
- 4 nhóm (token `link-1..4`, đạt tương phản như chữ) và "Không nhóm".
- Panel cùng nhóm dùng chung mã đang chọn và lệnh đang xem (`src/store/workspace.store.ts`, selector hẹp theo nhóm):
  - chọn mã ở Danh mục thì Phiếu lệnh, Sổ lệnh 3 mức, Sổ lệnh cùng nhóm đổi theo;
  - bấm một mức giá ở Sổ lệnh 3 mức thì giá điền vào Phiếu lệnh cùng nhóm;
  - bấm một lệnh thì Chi tiết lệnh cùng nhóm mở lệnh đó.
- Panel "Không nhóm" giữ mã riêng (lưu trong params của panel).
- **Giữ bản nháp:** Phiếu lệnh đang có ô người dùng đã sửa (`dirtyFields`) hoặc vừa điền theo mẫu mà nhóm đổi mã thì
  không xóa trắng.
  - Hỏi "Giữ bản nháp cho <mã cũ> / Chuyển sang <mã mới>".
  - Panel đang ẩn sau tab khác thì tự giữ bản nháp kèm nhãn "Bản nháp FPT · nhóm đang ở HPG".
  - "Khóa mã" trên phiếu: bỏ qua thay đổi của nhóm.
  - Quyết định do hàm thuần `resolveTicketSymbolChange()` (`src/workspace/ticketSymbol.ts`).

### Bàn phím và a11y
- Mỗi panel là một `section` có `aria-label`; Alt+1…9 đưa focus tới panel thứ n (trái → phải, trên → dưới).
- **Bảng trong các panel dạng danh sách** (Danh mục, Sổ lệnh, Thuật toán, Sổ lệnh 3 mức, Thông báo) theo mẫu Grid
  WAI-ARIA (`useGridKeyboard`, `moveInGrid`):
  - mỗi bảng một điểm dừng Tab;
  - mũi tên, Home / End, Ctrl+Home / Ctrl+End, PageUp / PageDown;
  - Enter / Space kích hoạt nút của ô hoặc hàng.
- Focus rõ ràng theo token `--focus-ring`.

### Hiệu năng
- Panel đọc store bằng selector hẹp: hàng bảng giá `memo` theo mã; phiếu lệnh chỉ đọc quote của mã đang chọn; nhóm đọc
  theo khóa nhóm.
- Tick giá không làm vẽ lại cả bàn làm việc.
- Số đo ở [quality-report.md](quality-report.md) mục 5 (`npm run perf:workspace`).

### Demo và tour
- Kịch bản 13 "Dealer dùng bàn làm việc":
  - bố cục Chuyên nghiệp → chọn FPT ở Danh mục, nhóm đổi theo → B mở phiếu Mua (không tạo lệnh) → điền LO → Đặt lệnh +
    Xác nhận → mở lệnh ở Chi tiết.
  - Phần giao diện qua cầu nối `src/workspace/demoBridge.ts`, phần đặt lệnh qua engine; chạy headless vẫn đạt.
- Tour 1 bước giới thiệu Bàn làm việc lần đầu mở màn (mỗi vai trò, khóa `oms-tour-workspace-<role>`).

## 23. Phím tắt (Đợt 10A)

`react-hotkeys-hook` 5.4.0 (MIT), có scope. Danh sách duy nhất ở `src/hotkeys/shortcuts.ts`, dùng cho bảng phím tắt,
Ctrl+K và tooltip.

| Phím | Ở đâu | Tác dụng |
|---|---|---|
| B / S | Bàn làm việc | Mở phiếu Mua / Bán với mã của panel đang chọn (hoặc nhóm của nó), con trỏ vào ô Khối lượng |
| O | Bàn làm việc | Tới panel Sổ lệnh (mở thêm nếu chưa có) |
| D | Bàn làm việc | Tới panel Sổ lệnh 3 mức |
| N | Bàn làm việc | Tới panel Thông báo |
| Alt+1…9 | Bàn làm việc | Tới panel thứ 1–9 |
| ? hoặc / | Mọi màn | Bảng phím tắt (theo nhóm) |
| Ctrl+K | Mọi màn | Tìm nhanh; mục có phím tắt hiện phím bên phải; có "Mở phiếu Mua/Bán trên Bàn làm việc" |
| Esc | Mọi màn | Đóng hộp thoại, hủy nhập |

- **Không phím nào gửi lệnh:** B / S chỉ mở phiếu; gửi lệnh luôn qua Đặt lệnh → Xác nhận như bấm chuột.
- **Phím bị loại:** không dùng F1 (trợ giúp của trình duyệt), không chặn Ctrl+W / Ctrl+T / Ctrl+R.
- **Không kích hoạt khi:**
  - đang gõ trong ô nhập, textarea, select, contenteditable, combobox, menu;
  - có hộp thoại đang mở;
  - đang chạy Demo (Demo có phím riêng: Space, →, Esc);
  - đã tắt ở `/cai-dat` mục "Phím tắt" (`shortcuts` trong cài đặt giao diện).
