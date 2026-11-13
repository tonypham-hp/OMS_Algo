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

### 6 kịch bản
| # | Kịch bản | TC | Ghi chú |
|---|---|---|---|
| 1 | Iceberg thành công | 050, 051, 052, 220, 231 | Core khớp thiếu rồi hủy phần còn lại; lệnh con kế tiếp theo KL đã khớp thật |
| 2 | Stop kích hoạt → Iceberg | 010, 011, 012, 050 | Stop Limit bán có `slice_qty`. Tài liệu ghi lệnh mua "giá ≤ ngưỡng"; Stop của engine kích hoạt lệnh mua khi giá tăng, nên dùng lệnh bán |
| 3 | POV điều chỉnh theo thị trường | 070, 071, 072, 232 | Tài liệu ghép với Adaptive; engine chưa có Adaptive nên chỉ trình diễn phần POV |
| 4 | HUNT quét mức + phần còn lại | 090, 091 | Quét tối đa 3 mức trong giá tối đa, phần còn lại đặt bị động. Từ Đợt 4 tô sáng OrderBook3 và khung "HUNT quét từng mức"; kiểm thêm khớp tại giá mức (BQ 118.157) và sổ lệnh dồn mức |
| 5 | Core mất ACK → UNKNOWN → đối soát | 140, 141, 150 | Có thêm một báo khớp trùng bị bỏ qua |
| 6 | OMS sập → khôi phục | 200, 202 | "Đĩa" là bản ghi JSON trong bộ nhớ; backend thật dùng CSDL |

Test: `src/demo/scenarios.test.ts` chạy cả 6 kịch bản headless, mọi check phải ĐẠT, chạy 2 lần cho kết quả giống nhau.

## 14. Sổ lệnh 3 mức (Đợt 4)

### Dữ liệu (`src/mocks/depth.ts`, hàm thuần)
- Mỗi mã có `quote.depth = { bids, asks }`, mỗi phía 3 mức `{ price, qty, own_taken? }`.
- Luật HOSE:
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
- Cách tính này giữ mọi mẫu đúng luật HOSE ở mọi vùng giá và mọi giờ trong ngày (có test).

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
- Không tự đặt lệnh. Người dùng sửa được mọi ô, và form kiểm tra luật HOSE như cũ.
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
