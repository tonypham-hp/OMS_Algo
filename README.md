# OMS Algo

Hệ thống quản lý lệnh nâng cao (Advanced Order Management System) cho sàn HOSE, tổ chức theo dạng monorepo.
Khách hàng và dealer đặt lệnh thuật toán (Stop, Stop Limit, Take Profit, Trailing Stop, OCO, Bracket, Iceberg, TWAP,
VWAP, POV, HUNT). OMS tự chia thành lệnh con, gửi xuống Core, theo dõi khớp, xử lý lỗi và đối soát.

> **Trạng thái:** bản demo frontend **v0.4.1** ([CHANGELOG](CHANGELOG.md)): 12 màn hình, Bàn làm việc dock được và tách cửa sổ, 4 theme, Chế độ Demo, kiểm thử Vitest và
> Playwright ([báo cáo chất lượng](docs/quality-report.md)). Chạy độc lập bằng dữ liệu giả lập (MSW và bộ giả lập thị
> trường trong trình duyệt), có ghi chú "Dữ liệu demo" trên header. Backend (FastAPI) và simulators chưa có code.

![Trung tâm lệnh, 1440×900](docs/screenshots/v0.1.0/02-trung-tam.png)

## Tính năng

- **Giới thiệu và đăng nhập** (`/`, `/login`): một màn hai cột. Bên trái giới thiệu sản phẩm, bên phải chọn tài khoản
  demo. Đã đăng nhập thì vào thẳng Trung tâm lệnh.
- **Khung ứng dụng** cho mọi trang sau đăng nhập. Thanh bên có menu theo vai trò, thu gọn được còn icon và nhớ lựa chọn
  sau khi tải lại trang.
  Thanh trên có phiên HOSE và giờ giả lập, nút tua x1/x10/x60, breadcrumb, nhãn "Dữ liệu demo · cập nhật", chuông
  thông báo và tài khoản. Màn ≤1280px thì thanh bên tự thu gọn; dưới 1600px thanh trên chỉ giữ tên màn hiện tại.
- **Trung tâm lệnh** (`/trung-tam`, trang mặc định):
  - 4 chỉ số: lệnh đang chạy (kèm số đang tạm dừng), khối lượng khớp hôm nay trên tổng đã đặt, số lệnh cần chú ý
    (chia theo UNKNOWN / REJECTED / PAUSED_SYSTEM), slippage trung bình so với giá arrival.
  - Bảng lệnh cần chú ý; bấm một dòng để mở chi tiết lệnh.
  - 10 hoạt động gần nhất.
  - Khách hàng chỉ thấy lệnh của tài khoản mình; dealer thấy các tài khoản mình quản lý; vận hành thấy tất cả.
- **Giao diện** (Đợt 9, [docs/theme.md](docs/theme.md)):
  - Theme: Tối (mặc định), Sáng, Tương phản cao tối / sáng, và bảng màu mù màu xanh–cam.
  - Đổi bằng nút Mặt trời/Mặt trăng trên thanh trên, Ctrl+K, hoặc trang **Cài đặt giao diện** (`/cai-dat`, mọi vai trò).
    Trang này còn có mật độ Thoáng/Gọn, cỡ chữ 90/100/110%, bật/tắt nhấp nháy giá, ẩn bps và số tài khoản khi trình chiếu.
    Lưu riêng theo tài khoản demo.
  - Màu giá theo thông lệ thị trường VN (không phải quy định của Sở), đạt ≥ 4,5:1 (≥ 7:1 ở tương phản cao) trên mọi nền.
  - Giá có ▲/▼ và ký hiệu trần "T"/sàn "S", không chỉ dựa vào màu. Không nháy sai theme khi tải lại.
- **Thông báo**: sinh từ nhật ký lệnh theo các loại trong spec (kích hoạt lệnh, kích hoạt điều kiện, lệnh con bị từ chối,
  hệ thống tạm dừng, hoàn tất, hủy, hết hạn).
  - Chuông có badge số chưa đọc.
  - Bấm một thông báo thì nó được đánh dấu đã đọc và mở lệnh tương ứng; có nút "Đánh dấu tất cả đã đọc".
- **Báo cáo hiệu quả thực hiện** (`/bao-cao/hieu-qua`):
  - So giá khớp bình quân của từng lệnh với giá arrival và VWAP toàn thị trường cùng khoảng thời gian; có tỷ lệ tham gia.
  - Lọc theo khoảng thời gian (Hôm nay / 5 phiên), trạng thái, chiến lược, chiều, mã; dealer và vận hành lọc thêm theo
    tài khoản.
  - 4 chỉ số, bảng sắp xếp được theo từng cột, biểu đồ bps theo chiến lược kèm một câu nhận xét.
  - Nút "Xuất Excel" tải file CSV mở được bằng Excel tiếng Việt.
  - Chi tiết lệnh có thẻ "Hiệu quả" dùng cùng công thức.
  - Công thức: [docs/frontend-spec.md](docs/frontend-spec.md), mục 12.
- **Lịch sử và đối soát** (Đợt 7, `/bao-cao/lich-su`): 3 tab, tab đang mở nằm trên URL.
  - Lịch sử lệnh: lệnh đã kết thúc và lệnh nhiều phiên đang chạy của 5 phiên gần nhất (hoặc khoảng tự chọn), số phiên đã
    chạy, dòng tổng, xuất CSV.
  - Nhật ký kiểm toán: mọi sự kiện của lệnh, chỉ đọc, tìm không dấu; khách hàng không thấy tên người khác.
  - Đối soát (dealer, vận hành): so OMS với Core theo từng lệnh con, 7 loại chênh lệch, "Đối soát ngay"; vận hành đánh
    dấu đã xử lý có ghi chú, người thứ hai duyệt. Bơm lỗi ở màn Vận hành thì chênh lệch hiện ngay ở đây.
  - Chi tiết: [docs/frontend-spec.md](docs/frontend-spec.md), mục 21.
- **Luật giao dịch theo KRX** (Đợt 8A): luật là dữ liệu cấu hình theo bảng giao dịch × ngày hiệu lực (`src/rules/`).
  - HOSE theo KRX: phiên ATO, liên tục, ATC, thỏa thuận sau giờ; lệnh trong ngày hết hiệu lực 14:45; MTL phần còn lại
    chuyển LO; sửa lệnh mỗi lần chỉ giá hoặc KL (cảnh báo mất/giữ ưu tiên); lô lẻ 1–99 CP chỉ LO; bước giá theo loại
    chứng khoán; room ngoại trừ ngay khi đặt lệnh mua.
  - HNX, UPCoM có gói luật riêng; mã niêm yết HNX sang HOSE từ 28/12/2026. Đồng hồ ngày cạnh đồng hồ phiên có nút
    "Đến 28/12/2026" để xem đổi luật mà không tải lại trang.
  - Trang `/cau-hinh/luat` (vận hành, chỉ đọc): các gói luật, trạng thái kiểm chứng, cờ; "Thử cấu hình bỏ nghỉ trưa".
  - Chi tiết: [docs/frontend-spec.md](docs/frontend-spec.md), mục 7.
- **Phiên giao dịch đặc biệt** (Đợt 8B), cùng gói luật:
  - Mã bị hạn chế giao dịch (mã mô phỏng XRS): chỉ khớp định kỳ 15 phút, chỉ lô chẵn, chỉ LO trong lượt; khóa sửa/hủy
    5 phút cuối lượt; đồng hồ đếm ngược tới lần khớp kế tiếp; lô lẻ, MTL, HUNT bị chặn.
  - Tạm ngừng và giao dịch lại (màn Vận hành, mô phỏng): lệnh cha đang chạy chuyển "Hệ thống tạm dừng"; giao dịch lại qua
    phiên khớp định kỳ 15 phút chỉ nhận LO, cấm sửa/hủy, rồi lệnh tự chạy.
  - Lệnh thỏa thuận cơ bản (Sổ lệnh, tab "Thỏa thuận"): tối thiểu 20.000 CP trên HOSE, bước giá 1 đ, trong biên; đối ứng
    (mô phỏng) xác nhận thì khớp; chỉ hủy khi chưa khớp; không đổi sổ lệnh, không tính vào VWAP.
- **Sổ lệnh 3 mức** (Đợt 4): 3 mức mua, 3 mức bán theo đúng luật HOSE.
  - Có ở màn Đặt lệnh (bấm một mức để điền giá vào lệnh) và ở Chi tiết lệnh.
  - Ô đổi giá trị nháy màu; KL lệnh của bạn vừa lấy hiện số âm màu vàng.
  - Trong ATO, ATC hiện giá dự kiến khớp và ghi rõ là phiên khớp lệnh định kỳ.
- **HUNT quét từng mức** (Đợt 4): lệnh HUNT quét lần lượt từng mức giá, không vượt giá tối đa (mua) hoặc thấp hơn giá
  tối thiểu (bán).
  - Chi tiết lệnh hiện từng bước, ví dụ "Quét mức 27.650: lấy 6.400, còn thiếu 1.600", kèm trạng thái và giá bình quân.
  - Mức đang quét được viền nhấn trên sổ lệnh; nút "Xem lại" phát lại các bước.
- **Mẫu chiến lược** (Đợt 4, `/mau-chien-luoc`): 6 mẫu một chạm, gồm Mua âm thầm, Bán êm trong 2 giờ, Theo nhịp thị
  trường, Bám VWAP cả phiên, Mua nhanh khi có thanh khoản, Cắt lỗ tự động.
  - Bấm thẻ mẫu trên ticket hoặc "Dùng mẫu này" thì form được điền sẵn; bạn vẫn sửa được mọi ô và form vẫn kiểm tra như
    cũ.
  - Báo cáo hiệu quả ghi tên mẫu của lệnh.
- **Vì sao lệnh này…** (Đợt 5): đầu Chi tiết lệnh có thẻ giải thích bằng tiếng Việt vì sao lệnh đang dừng, bị từ chối,
  chưa rõ trạng thái, chờ kích hoạt, hết hạn hay đã xong.
  - Câu sinh theo quy tắc từ dữ liệu của lệnh, không gọi AI. Mọi số trong câu đều có trong dữ liệu; thiếu thì ghi
    "chưa đủ dữ liệu".
  - Nút đi kèm: "Sửa giá" (điền sẵn giá trần hoặc sàn hợp lệ), "Xem nhật ký"; vận hành có thêm "Mở lại", "Đối soát ngay".
  - Bấm một dòng lệnh con để xem giải thích riêng. Ở Sổ lệnh và Trung tâm lệnh, rê chuột vào badge trạng thái để xem câu
    rút gọn.
- **Thuật ngữ** (Đợt 5): chữ có gạch chân chấm (VWAP, arrival, bps, giá trần…) mở giải thích khi rê chuột hoặc bấm Tab.
  - Tooltip có công thức và ví dụ bằng số của lệnh đang xem; Esc đóng.
  - Trang `/thuat-ngu` (cuối thanh bên) để tra cứu, lọc không dấu.
- **Tìm nhanh** (Đợt 5): Ctrl+K (Cmd+K trên Mac) hoặc nút tìm trên thanh trên cùng.
  - Tìm lệnh, mã chứng khoán, màn hình, thao tác (Đặt lệnh mới, Dùng mẫu…, Chạy Demo) và thuật ngữ, gõ không dấu cũng
    được.
  - Kết quả theo quyền của vai trò; nhớ 5 mục mở gần nhất.
- **Hướng dẫn lần đầu** (Đợt 5): tour 5 bước khi mỗi vai trò đăng nhập lần đầu; xem lại ở menu tài khoản
  "Xem hướng dẫn". Không chạy khi đang Demo.
- **Bàn làm việc** (`/ban-lam-viec`, Đợt 10A, [frontend-spec mục 22–23](docs/frontend-spec.md)):
  - Panel dock được: kéo tab để dock hoặc gộp tab, kéo viền đổi kích thước, thả nổi. Mỗi panel dùng lại component có
    sẵn: Danh mục, Phiếu lệnh, Sổ lệnh 3 mức, Sổ lệnh, Chi tiết lệnh, Thuật toán đang chạy, Thông báo.
  - Bố cục mẫu Cơ bản / Chuyên nghiệp; nhiều bố cục có tên lưu theo tài khoản, xuất / nhập JSON.
  - Nhóm liên kết 4 màu (kèm nhãn "Nhóm 1–4"): chọn mã ở Danh mục thì panel cùng nhóm đổi theo; phiếu đang nhập dở thì
    hỏi giữ bản nháp, không xóa trắng; có "Khóa mã".
  - Phím tắt B / S (mở phiếu, không bao giờ gửi lệnh), O / D / N, Alt+1…9; "?" mở bảng phím tắt; tắt được trong Cài đặt.
  - Bảng trong panel đi bằng mũi tên theo mẫu Grid.
  - **Đa cửa sổ** (Đợt 10B, [frontend-spec mục 24](docs/frontend-spec.md)):
    - tách panel ra cửa sổ trình duyệt riêng; theme và nhóm liên kết đồng bộ ngay; hộp thoại, menu mở trong đúng cửa sổ;
    - đặt cửa sổ lên màn hình khác (Chrome/Edge);
    - phiếu lệnh mini luôn nổi trên cùng (Document Picture-in-Picture);
    - đóng hết khi đăng xuất, khóa khi Demo.
- **Chế độ Demo**: app tự chạy 6 kịch bản E2E (Iceberg, Stop → Iceberg, POV, HUNT, Core mất ACK, OMS sập) và 3 kịch bản
  luật KRX (sửa lệnh mất/giữ ưu tiên, lô lẻ khớp trong ATC, mã HNX sang HOSE ngày 28/12/2026), 3 kịch bản phiên đặc
  biệt (mã hạn chế khớp định kỳ 15 phút, tạm ngừng và giao dịch lại, thỏa thuận sau giờ 14:45–15:00) và kịch bản 13
  "Dealer dùng bàn làm việc" (Đợt 10A).
  - Mỗi bước có chú thích, tô sáng phần tử liên quan và tự chấm điều kiện kiểm tra.
  - Chạy trên dữ liệu riêng; thoát thì dữ liệu của bạn trở về nguyên vẹn.
  - Cách bật ở mục [Chế độ Demo](#chế-độ-demo).
- **5 màn nghiệp vụ**: xem bảng [Màn hình](#màn-hình). Mọi màn dùng chung các trạng thái đang tải, trống (có câu hướng
  dẫn và nút hành động) và lỗi (có nút "Thử lại").
- **Truy cập bằng bàn phím** (Đợt 6): đặt lệnh trọn vẹn bằng Tab, Enter, Esc; mọi phần tử nhận focus có viền rõ; chữ đạt
  tương phản tối thiểu 4,5:1.

Bộ ảnh bản v0.1.0 (1440×900, mọi màn chính): [docs/screenshots/v0.1.0/](docs/screenshots/v0.1.0/), chụp lại bằng
`npm run screenshots`. Ảnh theo từng đợt: [docs/screenshots/dot1/](docs/screenshots/dot1/) (khung ứng dụng, Trung tâm lệnh),
[docs/screenshots/dot2/](docs/screenshots/dot2/) (báo cáo hiệu quả, thẻ Hiệu quả ở chi tiết lệnh),
[docs/screenshots/dot3/](docs/screenshots/dot3/) (Chế độ Demo, ảnh 1440px),
[docs/screenshots/dot4/](docs/screenshots/dot4/) (Đặt lệnh có dải mẫu và sổ lệnh 3 mức, Chi tiết lệnh HUNT có khung quét
từng mức, trang Mẫu chiến lược),
[docs/screenshots/dot5/](docs/screenshots/dot5/) (Chi tiết lệnh PAUSED_SYSTEM có thẻ giải thích, tooltip thuật ngữ,
hộp tìm nhanh Ctrl+K, một bước tour; ảnh 1440px),
[docs/screenshots/dot7/](docs/screenshots/dot7/) (3 tab Lịch sử và đối soát, tài khoản vanhanh, 1440×900).
Đợt 8A: [docs/screenshots/dot8a/](docs/screenshots/dot8a/) (phiếu lệnh lô lẻ, Sửa lệnh có cảnh báo ưu tiên, trang Luật
giao dịch, mã HNX trước và sau 28/12/2026).
Đợt 8B: [docs/screenshots/dot8b/](docs/screenshots/dot8b/) (mã hạn chế có đồng hồ đếm ngược, nút Hủy bị khóa, phiếu thỏa
thuận, tab Thỏa thuận).

## Cấu trúc thư mục

```text
OMS_Algo/
├── frontend/             # Giao diện web (Vite + React + TypeScript), chạy được với dữ liệu giả lập
│   ├── e2e/              # Test giao diện Playwright (*.spec.ts) và fixture chung
│   └── src/
│       ├── pages/        # Mỗi màn hình một thư mục
│       ├── mocks/        # API giả lập (MSW), bộ giả lập giá, engine sinh lệnh con / khớp / bơm lỗi
│       ├── services/     # Hàm gọi API: nối backend thật chỉ cần đổi ở đây
│       ├── config/       # Luật HOSE, loại lệnh, tham số hệ thống, màu trạng thái, từ điển thuật ngữ
│       ├── explain/      # Giải thích lệnh theo quy tắc (hàm thuần) và thẻ giải thích
│       ├── tour/         # Tour hướng dẫn lần đầu
│       ├── testing/      # Cờ chỉ dùng khi test e2e (seed, làm lỗi API); không có trong bản build
│       └── types/        # Kiểu dữ liệu theo ERD
├── backend/              # Dịch vụ OMS chính (Python, FastAPI): chưa có code
├── simulators/           # Giả lập hệ thống bên ngoài (Core, giá) để test: chưa có code
├── docs/
│   ├── frontend-spec.md  # Đặc tả frontend
│   ├── backend-gaps.md   # Những gì backend cần bổ sung so với ERD, và tồn đọng kỹ thuật
│   ├── quality-report.md # Số test, thời gian chạy, kích thước bundle, lỗi đã sửa ở Đợt 6
│   ├── demo-checklist.md # 10 việc trước buổi demo
│   ├── test-cases/       # Bộ test case E2E và bảng phủ test
│   ├── screenshots/      # Ảnh chụp giao diện theo từng đợt
│   └── adr/              # Architecture Decision Records
├── scripts/              # Script tiện ích: chưa có
└── .claude/              # Cấu hình Claude Code dùng chung
```

## Chạy frontend

Cần Node.js (đã chạy với Node 26) và npm.

```bash
cd frontend
npm ci
npm run dev
```

Mở địa chỉ Vite in ra (mặc định http://localhost:5173), chọn một tài khoản demo rồi bấm "Vào hệ thống". Không cần backend:
mặc định app chạy với API giả lập. Trạng thái giả lập (lệnh, giá, cấu hình) lưu trong localStorage của trình duyệt;
nút "Về đầu ngày" trên header đưa mọi thứ về dữ liệu mẫu ban đầu.

Lệnh khác trong `frontend/`:

| Lệnh | Việc |
|---|---|
| `npm run lint` | ESLint |
| `npm run build` | Kiểm tra kiểu (`tsc -b`) và build |
| `npm run test` | Vitest. Test lệch tài liệu bị bỏ qua mặc định; chạy `VITE_TC_DEVIATIONS=1 npm run test` để xem chúng |
| `npm run test:e2e` | Playwright, 2 khung 1440×900 và 1366×768 (tự bật `npm run dev` nếu chưa chạy) |
| `npm run test:e2e:ui` | Playwright ở chế độ giao diện, chạy và xem từng bước |
| `npm run test:all` | lint → Vitest → build → Playwright; dùng trước khi demo hoặc merge |
| `npm run screenshots` | Chụp lại bộ ảnh vào `docs/screenshots/v0.1.0/` |
| `npm run screenshots:dot7` | Chụp lại 3 ảnh màn Lịch sử và đối soát vào `docs/screenshots/dot7/` |
| `npm run screenshots:dot8a` | Chụp lại 5 ảnh luật KRX vào `docs/screenshots/dot8a/` |
| `npm run screenshots:dot8b` | Chụp lại 4 ảnh phiên đặc biệt vào `docs/screenshots/dot8b/` |
| `npm run screenshots:dot9` | Chụp lại 11 ảnh theme (5 biến thể × 2 màn, trang Cài đặt) vào `docs/screenshots/dot9/` |
| `npm run tokens` | Sinh lại `src/styles/tokens.css` từ `src/config/theme.ts` (sau khi sửa màu) |
| `npm run screenshots:dot10a` | Chụp lại 6 ảnh Bàn làm việc vào `docs/screenshots/dot10a/` |
| `npm run screenshots:dot10b` | Chụp lại ảnh đa cửa sổ (bàn làm việc + cửa sổ tách, phiếu mini) vào `docs/screenshots/dot10b/` |
| `npm run perf:workspace` | Build production rồi đo khung hình của Bàn làm việc (giá x60, 30 giây); ghi số đo vào `test-results/` |

Cấu hình qua biến môi trường: xem `frontend/.env.example` (`VITE_API_BASE_URL`, `VITE_USE_MOCK`, `VITE_DEMO_MODE`).

## Kiểm thử

- **Vitest** (`src/**/*.test.ts`): luật giao dịch KRX (ma trận `validateOrder`, test thuộc tính trần/sàn), engine giả
  lập, phiên đặc biệt (mã hạn chế, tạm ngừng, thỏa thuận), 13 kịch bản Demo chạy headless, bố cục Bàn làm việc (lưu, migrate, JSON hỏng), nhóm liên kết, giữ bản nháp, phím tắt không chạy trong ô nhập, định dạng, tương phản WCAG của mọi cặp token màu ở 4 theme và bảng màu mù màu.
- **Playwright** (`frontend/e2e/`): chạy trên Chrome có sẵn trong máy (không có thì Edge); **không** tải trình duyệt
  riêng, nên không cần `npx playwright install`. Không có cả hai thì cấu hình dừng và báo rõ.
  - Đồng hồ cố định (thứ Hai 16/11/2026, 09:10) qua `page.clock`, `Math.random` có seed qua `?e2e=1&seed=…`: kết quả lặp lại
    giữa các lần chạy.
  - Selector theo vai trò, nhãn và `data-demo-id`, không dựa vào class CSS.
  - Lỗi console hoặc request lỗi ở bất kỳ test nào đều làm test đó trượt.
  - Theme (Đợt 9):
    - axe (`@axe-core/playwright`, luật color-contrast) = 0 vi phạm trên các màn chính ở 4 theme và mù màu;
    - đổi theme bằng nút và Ctrl+K, không nháy khung tối khi tải lại;
    - ảnh chuẩn `toHaveScreenshot` theo theme ở 1440 và 1366 (`e2e/visual.spec.ts-snapshots/`, chụp trên Windows).
  - Báo cáo HTML ở `frontend/playwright-report/`, ảnh và trace khi lỗi ở `frontend/test-results/` (đều không commit).
- Số liệu lần chạy gần nhất: [docs/quality-report.md](docs/quality-report.md).

## Chế độ Demo

App tự chạy 6 kịch bản E2E trong [TC-E2E.md](docs/test-cases/TC-E2E.md), 3 kịch bản luật KRX (Đợt 8A) và 3 kịch bản
phiên đặc biệt (Đợt 8B) và kịch bản Bàn làm việc (Đợt 10A), để trình bày mà không phải thao tác tay.

**Bật Demo:**
- Đăng nhập `vanhanh` (vai trò Vận hành), bấm **▶ Demo** trên thanh trên cùng, chọn một kịch bản.
- Muốn mọi vai trò đều thấy nút Demo (ví dụ trình bày bằng tài khoản khách hàng): thêm `VITE_DEMO_MODE=true` vào
  `frontend/.env.local` rồi chạy lại `npm run dev`.

**Khi đang chạy:**
- Thanh trên có nhãn vàng "ĐANG CHẠY DEMO · Scenario n" và nút "Thoát Demo".
- Khung điều khiển ở đáy màn hình:
  - bước hiện tại và chú thích;
  - Phát / Tạm dừng, Bước tiếp, Làm lại, tốc độ x1 / x2 / x4;
  - kéo được, thả gần góc thì bám góc.
- Bảng "Điều kiện kiểm tra" bên phải: ĐẠT / KHÔNG ĐẠT / CHỜ.
- Phím tắt (chỉ khi đang Demo): `Space` phát / tạm dừng, `→` bước tiếp, `Esc` thoát.
- Chạy xong có hộp kết quả: chạy lại, chọn kịch bản khác, xuất kết quả ra CSV.

**Dữ liệu:**
- Trước khi chạy, app lưu nguyên trạng thái (lệnh, giá, cấu hình, localStorage của app, thông báo).
- Kịch bản chạy trên sổ lệnh trống với random có seed cố định, nên lần nào cũng ra cùng kết quả.
- Thoát Demo thì mọi thứ trở về đúng như lúc trước khi bấm.

Kịch bản trình bày 10 phút: [docs/demo-script.md](docs/demo-script.md). Việc cần làm trước buổi demo:
[docs/demo-checklist.md](docs/demo-checklist.md).

## Tài khoản demo

Không cần mật khẩu. Trang đăng nhập hiện 3 thẻ cho `khachhang`, `dealer`, `vanhanh`. `vanhanh2` ở dòng nhỏ bên dưới, dùng
khi cần người duyệt thứ hai.

| Tài khoản | Vai trò | Được dùng |
|---|---|---|
| `khachhang` | Khách hàng | Trung tâm lệnh, Màn 1, 2, 3 với tài khoản của mình; Lịch sử và nhật ký (không có tab Đối soát) |
| `dealer` | Dealer | Trung tâm lệnh, Màn 1, 2, 3, xem lệnh của nhiều tài khoản; xem Đối soát, chạy "Đối soát ngay". Tài khoản `058C345678` là nhà đầu tư nước ngoài (lệnh mua bị trừ room ngoại) |
| `vanhanh` | Vận hành | Trung tâm lệnh và cả 5 màn, trang Luật giao dịch |
| `vanhanh2` | Vận hành | Trung tâm lệnh và cả 5 màn. Người thứ hai để demo maker-checker ở Màn 5: một người tạo yêu cầu, người kia duyệt; cũng duyệt "Đánh dấu đã xử lý" ở tab Đối soát |

## Màn hình

| # | Đường dẫn | Màn hình | Nội dung chính |
|---|---|---|---|
| 0 | `/trung-tam` | Trung tâm lệnh | KPI, lệnh cần chú ý, hoạt động gần nhất. Trang mặc định sau đăng nhập |
| 1 | `/dat-lenh` | Đặt lệnh nâng cao | Bảng giá thu gọn, sổ lệnh 3 mức (room ngoại), dải mẫu một chạm, ticket đặt 12 loại lệnh (gồm LO thường), lô chẵn/lô lẻ, nhãn sàn, kiểm tra luật KRX ngay khi nhập |
| 2 | `/so-lenh` | Sổ lệnh nâng cao | Bảng lệnh cha, tiến độ, trạng thái, lọc; Sửa, Hủy, Tạm dừng, Tiếp tục; tab Thỏa thuận (`?tab=thoa-thuan`) |
| 3 | `/so-lenh/:id` | Chi tiết lệnh | Lệnh con, khớp, biểu đồ thực hiện so với kế hoạch, giá bình quân so với arrival, sổ lệnh 3 mức, khung HUNT quét từng mức, nhật ký |
| 4 | `/van-hanh` | Giám sát hệ thống | Cảnh báo, lệnh hệ thống tạm dừng, kill switch, tạm ngừng / giao dịch lại mã (mô phỏng), nút bơm lỗi demo |
| 5 | `/cau-hinh` | Cấu hình chiến lược | Tham số hệ thống, đổi theo maker-checker, lịch sử thay đổi |
| 6 | `/bao-cao/hieu-qua` | Hiệu quả thực hiện | So giá BQ với arrival và VWAP, tỷ lệ tham gia, biểu đồ theo chiến lược, tên mẫu đã dùng, xuất CSV |
| 7 | `/mau-chien-luoc` | Mẫu chiến lược | Lưới thẻ mẫu, tham số mặc định, "Phù hợp khi…", "Dùng mẫu này" mở Đặt lệnh đã điền sẵn |
| 8 | `/bao-cao/lich-su` | Lịch sử và đối soát | Lịch sử lệnh nhiều phiên, nhật ký kiểm toán, đối soát OMS với Core (`?tab=lich-su\|nhat-ky\|doi-soat`) |
| 9 | `/cau-hinh/luat` | Luật giao dịch | Gói luật theo bảng × ngày hiệu lực, trạng thái kiểm chứng, cờ; nạp thử pack bỏ nghỉ trưa (chỉ vận hành) |
| 10 | `/cai-dat` | Cài đặt giao diện | Theme, tương phản cao, bảng màu mù màu, mật độ, cỡ chữ, nhấp nháy giá, ẩn số khi trình chiếu; xem trước từng lựa chọn (mọi vai trò) |
| 11 | `/ban-lam-viec` | Bàn làm việc | Panel dock được (Danh mục, Phiếu lệnh, Sổ lệnh 3 mức, Sổ lệnh, Chi tiết, Thuật toán đang chạy, Thông báo), nhóm liên kết màu, bố cục lưu theo tài khoản, phím tắt (mọi vai trò; khách hàng mặc định bố cục Cơ bản) |

## Tài liệu

- [docs/frontend-spec.md](docs/frontend-spec.md): đặc tả frontend (màn hình, luật giao dịch theo KRX, mô hình dữ liệu, quy tắc nghiệp vụ).
- [docs/test-cases/](docs/test-cases/): [bộ test case E2E](docs/test-cases/TC-E2E.md) và
  [bảng phủ test](docs/test-cases/coverage.md), gồm danh sách chỗ engine giả lập còn lệch tài liệu.
- [docs/demo-script.md](docs/demo-script.md): kịch bản trình bày Chế độ Demo trong 10 phút.
- [docs/backend-gaps.md](docs/backend-gaps.md): bảng, trường, API backend cần thêm ngoài ERD; tồn đọng kỹ thuật.
- [docs/quality-report.md](docs/quality-report.md): kết quả kiểm thử, kích thước bundle, lỗi đã sửa và việc còn tồn của v0.1.0.
- [docs/demo-checklist.md](docs/demo-checklist.md): checklist 10 mục trước buổi demo.
- [docs/theme.md](docs/theme.md): theme, token màu, tỷ lệ tương phản đã kiểm, cách thêm màu mới.
- [docs/licenses.md](docs/licenses.md): giấy phép các gói thêm từ Đợt 9 (dockview-react, react-hotkeys-hook, @axe-core/playwright).
- [CHANGELOG.md](CHANGELOG.md): thay đổi theo phiên bản, Đợt 1–10B.
