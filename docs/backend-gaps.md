# Khoảng trống giữa frontend và backend

Danh sách những gì frontend đang dùng (qua API giả lập MSW trong `frontend/src/mocks`) mà backend FastAPI cần bổ sung,
vì ERD chưa có.

> **Cơ sở đối chiếu:** tài liệu ERD 14 bảng chưa có trong repo. Bộ TestCase đã có ở `docs/test-cases/TC-E2E.md`,
> bảng phủ test ở `docs/test-cases/coverage.md`.
> File này được đối chiếu với mô hình dữ liệu ở `docs/frontend-spec.md` mục 6, nên cần rà lại với ERD 14 bảng thật:
> mục nào ERD đã có thì bỏ khỏi danh sách.
> Cột "Luồng E2E" chỉ ghi các mã đã được nêu trong yêu cầu làm Màn 4. "Chưa có mã" nghĩa là chưa biết mã TestCase tương ứng.

Tên kiểu dữ liệu nằm ở `frontend/src/types`, logic mẫu nằm ở `frontend/src/mocks/engine.ts`.

## 1. Giá trị `reason_code` của ParentOrder

Spec có trường `reason_code` nhưng chỉ mô tả một giá trị. Trường này quyết định lệnh `PAUSED_SYSTEM` được xử lý thế nào.

| Giá trị | Lý do cần | Luồng E2E |
|---|---|---|
| `PRICE_OUT_OF_BAND` | Giá lệnh mang sang nằm ngoài biên độ mới. Chỉ được sửa giá, vận hành không được mở lại trực tiếp | Chưa có mã (spec mục 5) |
| `CHILD_REJECTED_REPEAT` | Core từ chối 2 lệnh con liên tiếp | TC-E2E-130 |
| `MARKET_DATA_STALE` | Dữ liệu giá trễ. Là lý do duy nhất tự chạy lại khi có giá mới | TC-E2E-180 |
| `KILL_SWITCH` | Vận hành dừng khẩn cấp. Gỡ kill switch không làm lệnh tự chạy lại | Chưa có mã (kill switch) |

## 2. Loại `notification_type` mới

Spec mục 6 có 7 loại. Các loại dưới đây là thêm mới.

| Giá trị | Lý do cần | Luồng E2E |
|---|---|---|
| `PARENT_RESUMED` | Báo lệnh chạy lại, do có giá mới hoặc do vận hành mở lại | TC-E2E-180; mở lại lệnh: chưa có mã |
| `CHILD_UNKNOWN` | Báo mất phản hồi từ Core, lệnh con đang chờ đối soát | TC-E2E-140, TC-E2E-141 |
| `CHILD_RECOVERED` | Báo kết quả đối soát lệnh con | TC-E2E-140, TC-E2E-141 |
| `DUPLICATE_FILL_IGNORED` | Báo đã bỏ qua báo khớp trùng, KL không đổi | TC-E2E-150 |

## 3. Trường mới

| Bảng | Trường | Kiểu | Lý do cần | Luồng E2E |
|---|---|---|---|---|
| Notification | `parent_order_id` | chuỗi | Hiển thị thông báo theo từng lệnh ở Màn 3, Màn 4 | Mọi kịch bản lỗi |
| Notification | `message` | chuỗi | Nội dung lý do hiển thị cho người dùng | Mọi kịch bản lỗi |
| OrderEvent | `fill_detail` | `{qty, price, exchange_match_id}`, chỉ có ở event FILL | Nhật ký ghi "Khớp 300 CP @ 61.000 · M-0000047". `new_value` vẫn phải là trạng thái lệnh con. `qty` là KL thực ghi nhận, có thể nhỏ hơn KL trong báo khớp nếu bị cắt bớt | Chưa có mã (nhật ký khớp); liên quan TC-E2E-150 |
| OrderEvent | `reason` | chuỗi, chỉ có khi vận hành mở lại lệnh | Lưu lý do vận hành nhập, kèm `user_id` | Chưa có mã (mở lại lệnh) |

Giá trị `old_value`, `new_value` có quy ước riêng mà frontend đang đọc (xem `pages/OrderDetail/eventFormat.ts`):
`DUPLICATE_FILL:<mã khớp>` → `IGNORED`, và `KILL_SWITCH:ALL` hoặc `KILL_SWITCH:ACCOUNT:<tài khoản>`.
Hai bên cần thống nhất nếu backend đổi cách ghi.

## 4. Trạng thái hệ thống chưa có bảng

| Dữ liệu | Hình dạng | Lý do cần | Luồng E2E |
|---|---|---|---|
| Kill switch | `{global: boolean, accounts: string[]}` | Phải lưu bền: còn bật thì chặn đặt lệnh mới và chặn mở lại lệnh, khởi động lại dịch vụ cũng không được mất | Chưa có mã (kill switch) |
| Tuổi dữ liệu giá | `quote_age_seconds` (số giây **thật**) | Ngưỡng `MAX_DATA_DELAY` = 5 giây thật, không phụ thuộc tốc độ tua. Backend tính từ thời điểm nhận giá cuối | TC-E2E-180 |

Phần `pendingFaults` trong engine chỉ phục vụ nút bơm lỗi demo. Backend thật không cần lưu; nếu cần thử lỗi thì nên làm ở simulator Core riêng.

## 5. API ngoài CRUD lệnh

Mọi API `/api/ops/*` chỉ role OPS được gọi, sai role trả 403. Lỗi nghiệp vụ trả `{ "message": "..." }` bằng tiếng Việt.

### Dùng thật khi vận hành

| API | Dữ liệu gửi | Lý do cần | Luồng E2E |
|---|---|---|---|
| `GET /api/ops/overview` | | Số lệnh theo trạng thái, số Child UNKNOWN / REJECTED, tuổi dữ liệu giá, cảnh báo, kill switch. Frontend hỏi lại mỗi giây | Mọi kịch bản lỗi |
| `POST /api/ops/kill-switch` | `{scope: "ALL"}` hoặc `{scope: "ACCOUNT", account_no}` | Dừng khẩn cấp: hủy Child chưa khớp, giữ Child UNKNOWN, lệnh chuyển `PAUSED_SYSTEM`. Có hiệu lực cả trong ATO, ATC | Chưa có mã (kill switch) |
| `POST /api/ops/kill-switch/release` | như trên | Gỡ chặn đặt lệnh mới, không tự chạy lại lệnh | Chưa có mã (kill switch) |
| `POST /api/ops/orders/:id/reopen` | `{reason}` | Mở lại lệnh `PAUSED_SYSTEM`. Từ chối khi kill switch còn bật, dữ liệu giá còn trễ, hoặc lý do dừng là `PRICE_OUT_OF_BAND`. Ghi OrderEvent `RESUME` kèm `user_id`, `reason` | Chưa có mã (mở lại lệnh) |
| `POST /api/ops/children/:id/reconcile` | | Đối soát ngay Child UNKNOWN với Core, ghi OrderEvent `RECOVERY` | TC-E2E-140, TC-E2E-141 |

### Chỉ phục vụ bơm lỗi demo

Backend thật không cần các API này nếu lỗi được tạo từ simulator Core. Nếu giữ lại, phải tắt ở môi trường thật.

| API | Dữ liệu gửi | Luồng E2E |
|---|---|---|
| `POST /api/ops/faults/reject` | `{parent_order_id}` | TC-E2E-130 |
| `POST /api/ops/faults/timeout-before-core` | `{parent_order_id}` | TC-E2E-140 |
| `POST /api/ops/faults/timeout-after-core` | `{parent_order_id}` | TC-E2E-141 |
| `POST /api/ops/faults/duplicate-fill` | `{parent_order_id}` | TC-E2E-150 |
| `POST /api/ops/faults/market-data` | `{stale: boolean}` | TC-E2E-180 |

### API lệnh cho Màn 3 và lệnh giá ngoài biên độ

| API | Lý do cần | Luồng E2E |
|---|---|---|
| `GET /api/orders/:id/detail` | Gộp tham số, lệnh con, khớp, arrival snapshot, nhật ký cho trang Chi tiết lệnh | Chưa có mã (Màn 3) |
| `GET /api/orders/:id/notifications` | Lý do tạm dừng ở trang Chi tiết lệnh | Chưa có mã (Màn 3) |
| `GET /api/orders/:id/price-fields` | Các giá còn dùng tới cần sửa của lệnh `PRICE_OUT_OF_BAND` | Chưa có mã (spec mục 5) |
| `POST /api/orders/:id/reprice` | Sửa giá, hợp lệ thì lệnh tự chạy lại | Chưa có mã (spec mục 5) |

## 6. Hành vi backend phải khớp với frontend

- **Mở lại lệnh:** khách hàng không được gọi API này. Frontend chỉ hiện nút ở Màn 4, nhưng backend vẫn phải tự kiểm tra role.
- **TC-E2E-140:** Core chưa tạo lệnh → hủy Child UNKNOWN, sinh đúng 1 Child mới.
- **TC-E2E-141:** Core đã tạo lệnh → giữ Child, về `ACKNOWLEDGED`, không sinh Child mới. Nếu lệnh cha đã ngừng chạy lúc đối soát xong thì hủy Child đó.
- **Từ chối lặp lại:** `MAX_CONSECUTIVE_REJECTS` lần liên tiếp (mặc định 2) trên cùng lệnh cha thì tạm dừng.
  Một Child được Core nhận thì đếm lại từ đầu.
- **Đặt lệnh khi kill switch bật:** `POST /api/orders` trả lỗi nghiệp vụ, kèm `message`.
- **Chờ ACK:** Child đã gửi mà chưa có phản hồi nằm ở `SENDING`; quá `ACK_TIMEOUT_SECONDS` giây thật mới sang `UNKNOWN`
  và bắt đầu đối soát. `SENDING` tính là working như `UNKNOWN`, và giống `UNKNOWN` không bị hủy khi tạm dừng, kill switch
  hay hết phiên (chưa biết Core có giữ lệnh không). Thời gian đối soát sau `UNKNOWN` (5 giây) là của giả lập, không phải tham số.

## 7. Cấu hình hệ thống (Màn 5, maker-checker)

Frontend giả lập ở `frontend/src/mocks/systemConfig.ts`; định nghĩa tham số (mô tả, kiểu, min/max, mặc định) ở
`frontend/src/config/systemParams.ts`. ERD chưa có hai bảng dưới đây.

### Bảng `SystemParameter`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `parameter_code` | chuỗi, khóa chính | Xem danh sách tham số bên dưới |
| `value` | JSON | Số nguyên, hoặc mảng `strategy_type` với `ENABLED_STRATEGIES` |
| `data_type` | `INTEGER` \| `STRATEGY_LIST` | |
| `min`, `max`, `step` | số, có thể null | Backend phải tự kiểm tra lại, không tin frontend |
| `updated_by`, `approved_by`, `updated_at` | | Người tạo, người duyệt và thời điểm của lần đổi gần nhất |

### Bảng `ParameterChangeRequest`

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `request_id` | chuỗi, khóa chính | |
| `parameter_code` | chuỗi | |
| `old_value`, `new_value` | JSON | `old_value` ghi lại lúc duyệt, là giá trị thật sự bị thay |
| `reason` | chuỗi, bắt buộc | Lý do của người tạo |
| `maker`, `checker` | chuỗi | `checker` null khi chưa xử lý |
| `note` | chuỗi | Ghi chú của người duyệt; bắt buộc khi từ chối |
| `status` | `PENDING` \| `APPROVED` \| `REJECTED` | |
| `created_at`, `decided_at` | thời điểm | |

Ràng buộc:
- **Một yêu cầu chờ cho mỗi tham số:** unique partial index trên `parameter_code` với `status = 'PENDING'`. Trùng thì 409.
- **Maker ≠ checker:** người tạo duyệt hoặc từ chối yêu cầu của chính mình thì 403. Kiểm ở backend, không chỉ ẩn nút.
- **Kiểm lại lúc duyệt** theo giá trị đang áp dụng (ví dụ `ICEBERG_MIN_SLICE` ≤ `ICEBERG_MAX_SLICE`), sai thì 422.
- **Không sửa ngược:** tham số `ENGINE` áp cho quyết định mới của engine ngay sau khi duyệt; tham số `ORDER_ENTRY`
  chỉ áp khi tạo lệnh mới. Lệnh đang chạy giữ tham số lúc đặt, kể cả khi loại lệnh bị tắt.

### Tham số

| Mã | Mặc định | Giới hạn | Áp ở |
|---|---|---|---|
| `MAX_CONSECUTIVE_REJECTS` | 2 | 1–10 | Engine: số lần Core từ chối liên tiếp trước khi `PAUSED_SYSTEM` |
| `MAX_DATA_DELAY_SECONDS` | 5 | 1–60 giây thật | Engine: ngưỡng dữ liệu giá trễ (TC-E2E-180), chặn mở lại lệnh |
| `ACK_TIMEOUT_SECONDS` | 3 | 1–60 giây thật | Engine: `SENDING` → `UNKNOWN` |
| `POV_MAX_PARTICIPATION_PCT` | 50 | 1–100 % | Tạo lệnh: trần cho `participation_pct`, `max_pct` |
| `ICEBERG_MIN_SLICE` | 100 | 100–500.000, bội 100 | Tạo lệnh: `slice_qty` tối thiểu |
| `ICEBERG_MAX_SLICE` | 500.000 | 100–500.000, bội 100 | Tạo lệnh: `slice_qty` tối đa |
| `ENABLED_STRATEGIES` | cả 11 loại | ít nhất 1 | Tạo lệnh: loại lệnh được đặt mới |

### API

Mọi API dưới đây chỉ role OPS, trừ `order-rules`. Lỗi nghiệp vụ trả `{ "message": "..." }` bằng tiếng Việt.

| API | Dữ liệu gửi | Lý do cần |
|---|---|---|
| `GET /api/config/parameters` | | Bảng tham số: giá trị, mô tả, giới hạn, người sửa gần nhất, yêu cầu đang chờ |
| `GET /api/config/requests` | query `parameter_code`, `user` (người tạo hoặc người duyệt), `status` | Tab Lịch sử thay đổi, mới nhất trước |
| `POST /api/config/requests` | `{parameter_code, new_value, reason}` | Tạo yêu cầu (`PENDING`) |
| `POST /api/config/requests/:id/approve` | `{note}` | Duyệt: áp giá trị ngay |
| `POST /api/config/requests/:id/reject` | `{note}` (bắt buộc) | Từ chối: giá trị không đổi |
| `GET /api/config/order-rules` | | Mọi người dùng đã đăng nhập: form đặt lệnh cần loại lệnh đang bật, khoảng slice, trần POV |
| `POST /api/orders` (đã có) | | Phải kiểm thêm luật đặt lệnh ở trên, sai thì 422 |

### Tài khoản demo

Thêm `vanhanh2` (OPS) để demo maker-checker: một người tạo, người kia duyệt.

## 8. Tồn đọng kỹ thuật

### `npm audit` của frontend (09/11/2026)

Chạy `npm audit` trong `frontend/` trên `package-lock.json` hiện tại: **15 lỗ hổng, 2 low, 13 moderate, không có high hay critical**.
`npm audit --omit=dev` (chỉ tính `dependencies`): 6 lỗ hổng (2 low, 4 moderate), đều thuộc nhánh `shadcn`.

Chỉ có **2 lỗ hổng gốc**; 13 dòng còn lại là các gói bị kéo theo vì phụ thuộc vào 2 gói này:

| Gói gốc | Phiên bản | Mức độ | Lỗi | Advisory |
|---|---|---|---|---|
| `minimatch` | 10.2.6 | moderate | Có thể bị từ chối dịch vụ khi xử lý glob pattern (globparts amplification) | GHSA-g3hv-75wg-m249 |
| `deepmerge` | 4.3.1 | low | `mergeObject()` cho phép prototype poisoning | GHSA-gcqx-w48m-w2h4 |

| Gói báo lỗi | Mức độ | Khai báo ở | Đường đi phụ thuộc |
|---|---|---|---|
| `eslint` | moderate | devDependencies, trực tiếp | `eslint` → `minimatch`; `eslint` → `@eslint/config-array` → `minimatch` |
| `@eslint/js` | moderate | devDependencies, trực tiếp | `@eslint/js` → `eslint` |
| `@eslint/config-array` | moderate | dev, gián tiếp | `eslint` → `@eslint/config-array` → `minimatch` |
| `typescript-eslint` | moderate | devDependencies, trực tiếp | `typescript-eslint` → `@typescript-eslint/*` |
| `@typescript-eslint/eslint-plugin`, `parser`, `type-utils`, `utils`, `typescript-estree` | moderate | dev, gián tiếp | `typescript-eslint` → … → `@typescript-eslint/typescript-estree` → `minimatch` |
| `shadcn` | moderate | **dependencies**, trực tiếp | `shadcn` → `deepmerge`; `shadcn` → `@shadcn/registry` → `deepmerge`; `shadcn` → `ts-morph` → `@ts-morph/common` → `minimatch` |
| `@shadcn/registry` | low | gián tiếp qua `shadcn` | `shadcn` → `@shadcn/registry` → `deepmerge` |
| `ts-morph`, `@ts-morph/common` | moderate | gián tiếp qua `shadcn` | `shadcn` → `ts-morph` → `@ts-morph/common` → `minimatch` |
| `minimatch` | moderate | gián tiếp | Như trên (eslint, typescript-eslint, shadcn) |
| `deepmerge` | low | gián tiếp | Như trên (shadcn) |

Đánh giá:
- **Không có gì lọt vào bản build chạy trên trình duyệt.** Nhóm `eslint` / `typescript-eslint` chỉ dùng khi lint.
  `shadcn` nằm ở `dependencies` nhưng app chỉ dùng file CSS của nó (`@import "shadcn/tailwind.css"` trong `src/index.css`);
  phần JS (`ts-morph`, `deepmerge`, registry) là của CLI `npx shadcn add`, chỉ chạy trên máy dev.
- Rủi ro thực tế thấp: `minimatch` chỉ nhận glob do chính dự án khai báo, `deepmerge` chỉ gộp cấu hình registry của shadcn.

Chưa sửa, và **không chạy `npm audit fix --force`**: "bản sửa" npm đề xuất đều là **hạ phiên bản major**
(`eslint` 10 → 9.39.5, `@eslint/js` → 9.39.5, `typescript-eslint` 8.72 → 8.36.0, `shadcn` 4 → 1.0.0),
sẽ làm hỏng cấu hình lint và lệnh thêm component. Việc nên làm:
1. Chờ `minimatch` / `deepmerge` có bản vá rồi `npm update` (không dùng `--force`), chạy lại lint, build, test.
2. Cân nhắc chuyển `shadcn` sang `devDependencies` nếu chỉ cần file CSS lúc build, để `npm audit --omit=dev` sạch.
3. Chạy lại `npm audit` trước mỗi lần phát hành và cập nhật mục này.

## 9. Báo cáo hiệu quả thực hiện (Đợt 2)

Công thức ở [frontend-spec.md](frontend-spec.md) mục 12. Bản demo tự sinh dữ liệu thị trường trong `src/mocks`; backend
thật phải cung cấp các dữ liệu dưới đây.

| Dữ liệu | Hình dạng | Lý do cần |
|---|---|---|
| Tick khớp toàn thị trường theo mã | `{symbol, time, price, qty}`, giữ tối thiểu 5 phiên | Tính VWAP thị trường và tỷ lệ tham gia trong khoảng [kích hoạt, hoàn tất]. Phải gồm cả lần khớp của chính OMS, nếu không tỷ lệ tham gia có thể vượt 100% |
| Arrival snapshot | `MarketSnapshot` (đã có trong ERD), ghi đúng lúc lệnh cha kích hoạt | Mốc so sánh "So arrival". Lệnh đặt lúc chưa có giá thì không có snapshot, báo cáo hiện "—" |
| Thời điểm hoàn tất | `completed_at` của ParentOrder, hoặc đảm bảo `updated_at` không đổi sau khi lệnh sang trạng thái kết thúc | Mốc cuối của khoảng tính VWAP và tỷ lệ tham gia |

### API
| API | Trả về | Ghi chú |
|---|---|---|
| `GET /api/reports/execution-quality` | `{trading_date, now, orders, children, executions, snapshots, market}`; `market` là `Record<parent_order_id, {volume, value}>` | Lọc theo quyền xem như `GET /api/orders`. `volume` là tổng KL, `value` là Σ(giá × KL) của tick trong khoảng của từng lệnh |
| `GET /api/orders/:id/detail` | Thêm trường `market: {volume, value}` hoặc `null` | Cho thẻ "Hiệu quả" ở chi tiết lệnh |

- Có thể trả tick thô theo mã và khoảng thời gian thay vì tổng hợp sẵn; khi đó frontend tự tính bằng `summarizeTicks`.
  Tổng hợp sẵn nhẹ hơn nhiều khi có nhiều lệnh.
- Khi có nhiều lệnh, báo cáo nên lọc và phân trang ở backend, không gửi toàn bộ lệnh như bản demo.

## 10. Chế độ Demo (Đợt 3)

Chế độ Demo chạy hoàn toàn trên engine giả lập trong trình duyệt, không cần API mới. Những gì nó bổ sung vào engine mà
backend cũng phải có, nếu muốn hành vi giống:

| Hành vi / dữ liệu | Hình dạng | Lý do cần | Luồng E2E |
|---|---|---|---|
| Tham số `slice_qty` của STOP_LIMIT (tùy chọn) | INTEGER, bội số lô | Stop kích hoạt rồi chia lệnh con như Iceberg | Scenario 2 |
| Tham số `max_levels`, `remainder_passive` của HUNT (tùy chọn) | INTEGER; `remainder_passive` = 1 đặt bị động phần còn lại, 0 kết thúc lệnh | HUNT quét thanh khoản theo mức giá, không vượt giá tối đa | TC-E2E-090, 091, 092; Scenario 4 |
| Sổ lệnh nhiều mức theo mã | `{bids: {price, qty}[], asks: {price, qty}[]}` | HUNT cần biết KL ở từng mức giá. Hiện dữ liệu giá chỉ có Bid/Ask tốt nhất | TC-E2E-090, 091, 092 |
| Core hủy phần chưa khớp của lệnh con | Sự kiện từ Core: lệnh con CANCELLED, giữ `filled_qty` | Lệnh cha phải sinh lệnh con kế tiếp theo KL đã khớp thật | TC-E2E-051; Scenario 1 |
| Khôi phục sau khi OMS khởi động lại | Trạng thái lệnh cha, lệnh con, Execution ghi vào CSDL trước khi gửi lệnh; lúc khởi động tra Core các lệnh con chưa kết thúc và nhận báo khớp bị lỡ | Không mất phần khớp trong lúc OMS tắt, không gửi lại lệnh con | TC-E2E-200, 202; Scenario 6 |

Hai tham số mới lưu trong `StrategyParameter` như các tham số khác. Từ Đợt 4, ticket đặt lệnh có ô nhập cho
`max_levels` (1–3) và `remainder_passive` (Chờ / Hủy); `slice_qty` vẫn chỉ dùng qua API.

## 11. Sổ lệnh 3 mức, HUNT quét mức, mẫu chiến lược (Đợt 4)

### Sổ lệnh 3 mức realtime
Frontend đang tự sinh sổ lệnh trong bộ giả lập. Khi chạy với backend, backend phải đẩy sổ lệnh thật theo từng mã.

| Dữ liệu | Hình dạng | Ghi chú |
|---|---|---|
| Sổ lệnh theo mã | `{symbol, bids: {price, qty}[3], asks: {price, qty}[3], session, indicative_price, updated_at}` | Đẩy qua kênh realtime (WebSocket/SSE) cùng nhịp với giá, không gọi API theo chu kỳ. Giá đúng bước giá HOSE, trong trần – sàn, KL bội 100, bán 1 > mua 1 |
| Phiên định kỳ | `session` = ATO/ATC, `indicative_price` | Màn hình hiện giá dự kiến khớp và ghi "Phiên khớp lệnh định kỳ", không coi là sổ lệnh liên tục |
| KL của chính OMS đã lấy | Không cần trường riêng | Frontend tự tính phần `own_taken` từ báo khớp của lệnh con quét; backend chỉ cần sổ lệnh sau khớp phản ánh đúng KL còn lại |

HUNT quét mức cần sổ lệnh **tại thời điểm quyết định**. Backend phải dùng cùng một bản sổ lệnh để lập kế hoạch quét và
để ghi `sweep_plan`.

### HUNT quét mức
| Hành vi / dữ liệu | Hình dạng | Lý do cần |
|---|---|---|
| Lệnh con quét khớp theo KL của mức | Lệnh con LO tại giá mức, KL ≤ KL đang có ở mức lúc quét | Không lấy quá thanh khoản đang có; giá BQ đúng như kế hoạch |
| `OrderEvent.sweep_plan` (ngoài ERD, tùy chọn, ở event DECISION HUNT_SWEEP) | JSON: `side, qty, limit_price, steps[{price, available, take, short_after, status, child_order_id}], take_qty, avg_price, remainder, remainder_policy, book{bids, asks}` | Màn "HUNT quét từng mức" và nút Xem lại đọc từ đây. Có thể lưu cột JSON hoặc bảng con `HuntSweepStep` |
| Tùy chọn "chuyển phần còn lại sang chiến lược khác" | Chưa có | Hiện chỉ có Chờ (LO bị động) và Hủy. Nếu cần, backend phải định nghĩa tham số (ví dụ `remainder_strategy`, tham số kèm theo) và luồng sinh lệnh con mới; frontend sẽ thêm lựa chọn khi có |

### Mẫu chiến lược
| Câu hỏi | Hiện tại (frontend) | Đề xuất cho backend |
|---|---|---|
| Mẫu lưu ở đâu | Cấu hình tĩnh `src/config/strategyTemplates.ts`, đóng gói cùng frontend | Bảng `StrategyTemplate` (`template_id`, `name`, `description`, `strategy_type`, `side`, `default_qty`, `params` JSON tương đối, `roles`, `hint`, `suitable_when`, `is_active`, `version`), quản lý ở màn Cấu hình chiến lược theo maker-checker như tham số hệ thống |
| API | Không có | `GET /strategy-templates` trả mẫu theo vai trò người gọi và loại lệnh đang bật |
| Mẫu riêng của người dùng | Chưa có | Nếu cần "lưu mẫu của tôi", thêm `owner_user_id`; mẫu hệ thống có `owner_user_id = null` |
| Ghi nhận mẫu đã dùng | `CreateOrderRequest.template_id`, `ParentOrder.template_id`, `OrderEvent.template_id` (event CREATE), đều tùy chọn | Thêm cột `template_id` (nullable) vào ParentOrder; lưu thêm `template_version` nếu mẫu đổi được |
| Kiểm tra | Mẫu chỉ điền sẵn; lệnh vẫn qua toàn bộ luật HOSE và luật đặt lệnh | Backend không cần tin `template_id`: vẫn kiểm tra đầy đủ tham số như lệnh đặt tay |
