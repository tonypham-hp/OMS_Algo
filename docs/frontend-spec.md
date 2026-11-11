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
  - Mẫu chiến lược, Lịch sử và đối soát chưa làm: bị khóa, ghi "Sắp có", không điều hướng.
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

## 7. Luật HOSE (kiểm tra ở form và trong simulator)
- Phiên: ATO 9:00–9:15 · liên tục 9:15–11:30 · nghỉ trưa · liên tục 13:00–14:30 · ATC 14:30–14:45.
- Không sửa / hủy lệnh trong ATO, ATC. Lệnh MTL chỉ trong phiên liên tục.
- Biên độ ±7% so với giá tham chiếu (giá trần / sàn).
- Bước giá: 10đ (giá < 10.000), 50đ (10.000–49.950), 100đ (≥ 50.000).
- Khối lượng: bội số 100, tối đa 500.000 cổ phiếu / lệnh.
- Giá dùng số nguyên đồng (không dùng số thực); hiển thị kiểu Việt Nam: 1.000.000.

## 8. Quy tắc nghiệp vụ lõi (simulator phải tôn trọng)
- KL được phép sinh lệnh con = total_qty − executed_qty − working (Child chưa kết thúc).
- Tổng khớp không bao giờ vượt total_qty.
- Child UNKNOWN (mất phản hồi Core) vẫn tính là working cho tới khi đối soát xong.
- Mỗi lần khớp có exchange_match_id duy nhất; báo khớp lặp lại thì bỏ qua.
- Mọi thay đổi trạng thái đều ghi một OrderEvent.

## 9. Bộ giả lập (src/mocks)
- Mã: FPT, HPG, VCB, MWG, TCB, VNM, SSI, VHM, MBB, ACB với giá tham chiếu hợp lý.
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
- Băng tick khớp toàn thị trường (`src/mocks/marketTape.ts`):
  - Mỗi nhịp ghi lần khớp của bộ giả lập và của chính OMS (thời điểm, giá, KL).
  - Giữ 5 ngày giao dịch gần nhất, tối đa 40.000 tick.
  - Lưu ở khóa localStorage riêng.

## 10. Giao diện
- Nền tối kiểu bảng giá; màu giá theo quy ước VN: trần tím, tăng xanh lá, tham chiếu vàng,
  giảm đỏ, sàn xanh lam. Số căn phải, font số đều nhau (tabular-nums).
- Trạng thái lệnh có badge màu thống nhất (khai báo trong src/config).
- Tiếng Việt toàn bộ giao diện.

## 11. Nghiệm thu mỗi màn
- `npm run lint` và `npm run build` không lỗi; có ít nhất vài test Vitest cho hàm kiểm tra luật HOSE.
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
