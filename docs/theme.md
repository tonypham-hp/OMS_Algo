# Theme và màu giao diện (Đợt 9, v0.3.0)

Tài liệu cho người sửa giao diện: các theme, token màu, ngưỡng tương phản, cách thêm một màu, và những gì test đang kiểm.

> **Quy ước màu bảng giá Việt Nam là thông lệ thị trường, không phải quy định của Sở.** Trần tím, tăng xanh lá, tham
> chiếu vàng, giảm đỏ, sàn xanh lam là cách các bảng giá và công ty chứng khoán trong nước thường dùng; Sở giao dịch không
> quy định màu hiển thị. Vì vậy app có thêm bảng màu cho người mù màu và luôn kèm ký hiệu, không chỉ dựa vào màu.

## 1. Bốn theme và bảng màu mù màu

| Theme | `data-theme` | Khi nào dùng | Ngưỡng chữ |
|---|---|---|---|
| Tối (mặc định) | `dark` | Mặc định khi chưa lưu lựa chọn hoặc localStorage lỗi | 4,5:1 |
| Sáng | `light` | Phòng sáng, in, chụp tài liệu | 4,5:1 |
| Tương phản cao tối | `hc-dark` | Tối + "Tương phản cao" (hoặc hệ điều hành bật `prefers-contrast: more`) | 7:1 |
| Tương phản cao sáng | `hc-light` | Sáng + "Tương phản cao" | 7:1 |

- **Mù màu xanh–cam** (`data-palette="cvd"`) chồng lên theme bất kỳ: tăng xanh lam, giảm cam. Áp cho màu giá, nút
  Mua/Bán, nhãn trạng thái thành công/lỗi và nền phía mua/bán của sổ lệnh 3 mức.
- Trần, tham chiếu, sàn giữ nguyên trong bảng màu mù màu. Ở bảng này "tăng" (lam) gần màu sàn (lam lục), nên hai loại
  được phân biệt bằng ký hiệu: sàn có chữ **S**, tăng có **▲**.
- **Không chỉ dựa vào màu:**
  - giá so tham chiếu có **▲ / ▼**; trần **T**, sàn **S**, kèm tên đọc "Giá trần" / "Giá sàn";
  - cột +/− có dấu;
  - nhãn trạng thái luôn có chữ.
- **Nhấp nháy khi giá đổi:**
  - nền nhạt `--price-flash-*` cộng mũi tên **↑ / ↓** theo chiều bước giá vừa đổi, mờ dần trong 600ms;
  - ↑/↓ là chiều của lần đổi giá vừa rồi, ▲/▼ là so với tham chiếu, nên một giá có thể hiện "↓25.100▲" (vừa giảm một
    bước nhưng vẫn trên tham chiếu);
  - tắt khi hệ điều hành bật giảm chuyển động (`prefers-reduced-motion`) hoặc người dùng tắt trong Cài đặt;
  - ở hai theme tương phản cao, nền không đổi (chỉ có mũi tên), để chữ luôn giữ ≥ 7:1.
- **Giá tham chiếu:** chữ đậm. Ở theme sáng thêm chip vàng nhạt `--price-ref-chip-bg` đặt trên chính con số, không tô cả
  ô; theme tối không có chip (token `transparent`).

## 2. Nguồn màu duy nhất

```
src/config/theme.ts  ──npm run tokens──▶  src/styles/tokens.css  ──@theme inline (index.css)──▶  lớp Tailwind
(PALETTES, CVD_OVERRIDES)                 (biến CSS theo data-theme)                              text-price-up, bg-surface…
```

- `src/config/theme.ts` là **nơi duy nhất có mã màu**. `renderTokensCss()` sinh `src/styles/tokens.css`.
  - Selector của tokens.css: `:root, [data-theme="light"]`, `[data-theme="dark"]`…
  - Bảng màu mù màu dùng selector `[data-theme="…"][data-palette="cvd"]`.
  - Selector không gắn với `:root`, nên một khung con đặt `data-theme` riêng cũng nhận đủ token. Trang Cài đặt dùng cách
    này cho phần xem trước.
- `src/index.css` ánh xạ token sang Tailwind trong `@theme inline`:
  - `--color-price-up: var(--price-up)`, `--color-status-danger-bg: var(--status-danger-bg)`…
  - các biến của shadcn/ui cũng trỏ về token: `--color-primary` là `--accent`, `--color-accent` là `--surface-hover` (nền
    hover). Mọi component `ui/` tự đổi theo theme.
- **Biểu đồ Recharts** nhận `fill`/`stroke` là `var(--token)` (`src/config/chartColors.ts`). Đổi theme thì SVG đổi màu
  ngay, không cần vẽ lại hay tải lại trang.
- **Bị chặn khi `npm run lint`:**
  - ESLint `no-restricted-syntax`: hex, `rgb()`/`hsl()`/`oklch()`, lớp màu bảng Tailwind (`bg-red-500`…),
    `bg-black`/`text-white` trong `src/**/*.{ts,tsx}`, trừ `theme.ts` và test;
  - `scripts/check-colors.mjs`: cùng các mẫu đó trong file `.css`, `components/ui` (code shadcn) và `index.html`, và báo
    lỗi nếu `tokens.css` không khớp `theme.ts`.

## 3. Chọn theme lúc chạy

1. **Script khởi động** (`src/theme/bootstrap.ts`), chèn nội tuyến vào đầu `<head>` qua plugin trong `vite.config.ts`.
   - Chạy trước CSS và trước khi app tải.
   - Đọc `localStorage['oms-appearance:last']` trong try/catch, cùng `prefers-color-scheme` và `prefers-contrast`.
   - Đặt `data-theme`, `data-palette`, `data-density`, `data-font-scale`, `data-flash`, `color-scheme` lên `<html>`.
   - Nhờ vậy tải lại ở theme sáng không có khung hình tối nào.
   - Mọi lỗi (bị chặn lưu trữ, JSON hỏng) đều rơi về Tối.
2. **`resolveAppearance()`** (`src/theme/appearance.ts`) là cùng phép tính, viết dạng hàm thuần. Test chạy chính chuỗi
   script khởi động trên DOM giả và so kết quả với hàm này.
3. **`ThemeProvider` và store `appearance.store.ts`** (Zustand, không dùng next-themes):
   - lưu theo tài khoản demo (`oms-appearance:<username>`), kèm bản `:last` cho script khởi động;
   - đổi tài khoản thì nạp cài đặt của tài khoản đó;
   - nghe `matchMedia` của `prefers-color-scheme`, `prefers-contrast: more`, `forced-colors`;
   - bật `forced-colors` (Windows High Contrast) thì để hệ điều hành quyết định màu, chỉ giữ viền và focus.
4. **Đổi nhanh Sáng ↔ Tối:**
   - nút Mặt trời/Mặt trăng trên thanh trên (tên đọc "Đổi sang giao diện sáng/tối");
   - Ctrl+K: "Đổi giao diện sáng/tối", "Mở Cài đặt giao diện".
5. **Trang `/cai-dat`** (mọi vai trò, mục "Cài đặt" trong menu tài khoản):
   - giao diện; tương phản cao (theo hệ thống / bật / tắt); bảng màu; mật độ Thoáng/Gọn; cỡ chữ 90/100/110%; nhấp nháy giá;
   - ẩn số tiền và bps khi trình chiếu: bps/slippage thành `•••`, số tài khoản thành `058C•••456`;
   - mỗi lựa chọn có hàng xem trước đủ 5 màu giá.

## 4. Token

Giá trị từ `src/config/theme.ts` (in lại từ code). Nhãn trạng thái dùng 6 cặp `--status-{neutral,info,progress,success,warning,danger}-{fg,bg}`:
nền là màu chữ trộn vào `--surface` (tối 16%, sáng 7%, tương phản cao tối 10%, tương phản cao sáng 0%).

| Token | Tối | Sáng | TP cao tối | TP cao sáng |
|---|---|---|---|---|
| `--bg` | #0B1220 | #F8FAFC | #000000 | #FFFFFF |
| `--surface` | #111A2B | #FFFFFF | #0A0A0A | #FFFFFF |
| `--surface-panel` | #0D1626 | #F1F5F9 | #000000 | #FFFFFF |
| `--surface-2` | #131D31 | #F1F5F9 | #141414 | #FFFFFF |
| `--surface-hover` | #131D31 | #F1F5F9 | #141414 | #FFFFFF |
| `--nav-active` | #16243D | #E0E7FF | #1F1F1F | #E0E7FF |
| `--border` | #1E2B44 | #E2E8F0 | #737373 | #52525B |
| `--border-strong` | #5B6B86 | #7C8BA1 | #A3A3A3 | #3F3F46 |
| `--text` | #E6EDF7 | #0F172A | #FFFFFF | #000000 |
| `--text-muted` | #9FB0C9 | #475569 | #D4D4D8 | #27272A |
| `--accent` | #818CF8 | #4338CA | #A5B4FC | #3730A3 |
| `--accent-fg` | #0B1220 | #FFFFFF | #000000 | #FFFFFF |
| `--focus-ring` | #818CF8 | #4338CA | #FFFFFF | #000000 |
| `--danger` | #F6465D | #B91C1C | #FF7A8A | #991B1B |
| `--warning` | #F0B90B | #854D0E | #F0B90B | #713F12 |
| `--success` | #0ECB81 | #15803D | #0ECB81 | #166534 |
| `--overlay` | #0000008C | #0F172A66 | #000000B3 | #00000080 |
| `--price-ceiling` | #FF25FF | #A21CAF | #E879F9 | #86198F |
| `--price-up` | #0ECB81 | #15803D | #0ECB81 | #166534 |
| `--price-ref` | #F0B90B | #854D0E | #F0B90B | #713F12 |
| `--price-down` | #F6465D | #B91C1C | #FF7A8A | #991B1B |
| `--price-floor` | #1EB5D8 | #0369A1 | #1EB5D8 | #075985 |
| `--price-flash-up-bg` | #13251F | #F0FDF4 | #0A0A0A | #FFFFFF |
| `--price-flash-down-bg` | #26141E | #FFF5F5 | #0A0A0A | #FFFFFF |
| `--price-ref-chip-bg` | transparent | #FEF9C3 | transparent | #FEF3C7 |
| `--book-bid-bg` | #11232F | #F3F9F5 | #0A0A0A | #FFFFFF |
| `--book-ask-bg` | #1C1C2E | #FCF4F4 | #0A0A0A | #FFFFFF |
| `--buy` | #0ECB81 | #15803D | #0ECB81 | #166534 |
| `--buy-fg` | #04121F | #FFFFFF | #000000 | #FFFFFF |
| `--sell` | #F6465D | #B91C1C | #FF7A8A | #991B1B |
| `--sell-fg` | #04121F | #FFFFFF | #000000 | #FFFFFF |
| `--chart-actual` | #3987E5 | #1D4ED8 | #7DB4FF | #1E3A8A |
| `--chart-plan` | #D95926 | #C2410C | #FF9A5C | #9A3412 |

**Màu nhấn** là chàm (indigo), không phải xanh lam: màu cũ `#38BDF8` gần như trùng màu sàn. Nền tối giữ nguyên như các
đợt trước (#0B1220, panel #0D1626, thẻ #111A2B).

Bảng màu mù màu (`data-palette="cvd"`) chỉ đè các token sau:

| Token (cvd) | Tối | Sáng | TP cao tối | TP cao sáng |
|---|---|---|---|---|
| `--price-up`, `--buy`, `--success` | #60A5FA | #1D4ED8 | #93C5FD | #1E3A8A |
| `--price-down`, `--sell`, `--danger` | #FB923C | #C2410C | #FDBA74 | #9A3412 |
| `--buy-fg`, `--sell-fg` | #04121F | #FFFFFF | #000000 | #FFFFFF |
| `--book-bid-bg` | #152135 | #F4F6FD | #0A0A0A | #FFFFFF |
| `--book-ask-bg` | #1D202C | #FCF6F3 | #0A0A0A | #FFFFFF |
| `--status-success-*`, `--status-danger-*` | theo up/down ở trên | | | |

## 5. Tương phản đã kiểm

- **Hàm WCAG 2.x tự viết:** `src/theme/contrast.ts`.
- **Danh sách cặp chữ/nền:** `CONTRAST_PAIRS`.
  - Chữ thường, chữ phụ, màu nhấn, 5 màu giá trên mọi bề mặt (gồm nền hover và nền phía mua/bán).
  - Màu giá trên nền nhấp nháy và chip tham chiếu.
  - Chữ trên nút Mua/Bán và nút màu nhấn.
  - Nhãn trạng thái trên nền của nó và trên thẻ; chữ thường trên nền trạng thái.
  - Viền ô nhập và vòng focus (≥ 3:1).
- Thấp nhất ở mỗi theme (in từ `checkTheme()`):

| Theme | Số cặp | Thấp nhất | Cặp thấp nhất | Ngưỡng |
|---|---|---|---|---|
| Tối | 115 | 4,54 | giảm trên nền nhấp nháy tăng | 4,5 |
| Sáng | 116 | 4,57 | nhãn thành công trên nền nhãn | 4,5 |
| Tương phản cao tối | 115 | 7,37 | giảm trên nền hover | 7 |
| Tương phản cao sáng | 116 | 7,13 | nhãn thành công trên thẻ | 7 |
| Tối · mù màu | 115 | 5,20 | màu nhấn trên mục menu đang chọn | 4,5 |
| Sáng · mù màu | 116 | 4,69 | nhãn lỗi trên nền nhãn | 4,5 |
| TP cao tối · mù màu | 115 | 7,49 | trần trên nền hover | 7 |
| TP cao sáng · mù màu | 116 | 7,31 | nhãn lỗi trên thẻ | 7 |

Màu giá trên nền thẻ / nền trang:

| Chữ | Tối | Sáng | TP cao tối | TP cao sáng |
|---|---|---|---|---|
| `--text-muted` | 7,90 / 8,49 | 7,58 / 7,24 | 13,40 / 14,21 | 14,89 / 14,89 |
| `--price-ceiling` | 5,77 / 6,21 | 6,32 / 6,04 | 8,05 / 8,53 | 8,24 / 8,24 |
| `--price-up` | 8,19 / 8,81 | 5,02 / 4,79 | 9,31 / 9,88 | 7,13 / 7,13 |
| `--price-ref` | 9,66 / 10,39 | 6,85 / 6,55 | 10,98 / 11,65 | 8,67 / 8,67 |
| `--price-down` | 4,93 / 5,31 | 6,47 / 6,18 | 7,92 / 8,40 | 8,31 / 8,31 |
| `--price-floor` | 7,17 / 7,72 | 5,93 / 5,67 | 8,16 / 8,66 | 7,56 / 7,56 |

**Vì sao có `--surface-hover` riêng:** đỏ giảm `#F6465D` trên nền mục menu đang chọn `#16243D` chỉ đạt 4,40. Vì vậy hàng
bảng đang rê hoặc đang chọn dùng `#131D31` (≥ 4,54). Ở theme sáng, nền hover là `#F1F5F9`; `#E2E8F0` chỉ dùng làm viền, vì
xanh tăng trên đó chỉ đạt 4,07.

**Không dùng opacity cho chữ hay nền nhấn chồng lên chữ:**
- `text-muted-foreground/80`, `opacity-60`, `bg-primary/10` từng làm tụt dưới ngưỡng (axe phát hiện).
- Thay bằng token đã kiểm: `--surface-hover` cho mục đang chọn, `--nav-active` cho thông báo, chữ nghiêng cho mức giá
  tham khảo trong phiên định kỳ.

## 6. Thêm một màu mới

1. Thêm tên vào `TOKEN_NAMES` và giá trị cho **cả 4 theme** trong `PALETTES` (`src/config/theme.ts`). Nếu màu mang nghĩa
   tăng/giảm, thêm cả vào `cvd()`.
2. `npm run tokens` để sinh lại `src/styles/tokens.css`. Không sửa tay file này; lint báo lỗi nếu nó lệch.
3. Ánh xạ sang Tailwind trong `@theme inline` của `src/index.css`: `--color-<tên>: var(--<tên>);`.
4. Thêm cặp chữ/nền mới vào `CONTRAST_PAIRS` (`src/theme/contrast.ts`) rồi `npm test`. Test báo tên cặp và tỷ lệ nếu
   không đạt.
5. Dùng lớp token trong component (`text-<tên>`, `bg-<tên>`), không viết mã màu.

## 7. Test

| Loại | File | Kiểm gì |
|---|---|---|
| Vitest | `src/theme/contrast.test.ts` | Mọi cặp token ≥ 4,5 (≥ 7 ở tương phản cao), viền ≥ 3, cả bảng màu mù màu |
| Vitest | `src/theme/appearance.test.ts` | Chọn theme theo lựa chọn đã lưu / `prefers-color-scheme` / `prefers-contrast`; script khởi động cho cùng kết quả; localStorage lỗi thì về Tối |
| Vitest | `src/store/appearance.store.test.ts` | Lưu riêng theo tài khoản, `:last`, lỗi lưu trữ, nút đổi nhanh |
| Vitest | `src/components/PriceDirection.test.tsx`, `Sensitive.test.tsx` | Ký hiệu ▲ ▼ T S, che bps và số tài khoản |
| Playwright + axe | `e2e/a11y-theme.spec.ts` | Luật `color-contrast` = 0 vi phạm. Màn: Trung tâm lệnh, Đặt lệnh, Sổ lệnh, Chi tiết, Báo cáo, Lịch sử, Đối soát, Cài đặt, Demo. Theme: 4 theme và mù màu (sáng, tối) |
| Playwright | `e2e/theme.spec.ts` | Khung hình đầu đã là sáng khi tải lại; đổi bằng nút và Ctrl+K; Recharts đổi màu không tải lại; theo hệ thống |
| Playwright | `e2e/cai-dat.spec.ts` | Từng tùy chọn của trang Cài đặt, nhớ qua tải lại, lưu theo tài khoản, che số |
| Playwright | `e2e/visual.spec.ts` | Ảnh chuẩn Trung tâm lệnh và Đặt lệnh × 5 biến thể × 1440/1366 |

Ảnh chuẩn visual (`e2e/visual.spec.ts-snapshots/`):
- Đồng hồ dừng ở các mốc cố định, tắt hiệu ứng.
- Font Google được thay bằng phản hồi rỗng, nên ảnh dùng font hệ thống: chỉ so được trên cùng hệ điều hành
  (tên file có hậu tố `-win32`).
- Cố ý đổi giao diện thì cập nhật bằng `npx playwright test e2e/visual.spec.ts --update-snapshots` và xem lại ảnh trước
  khi commit.

Ảnh nghiệm thu: [docs/screenshots/dot9/](screenshots/dot9/) (`npm run screenshots:dot9`).
