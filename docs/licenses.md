# Giấy phép thư viện bên thứ ba

Ghi giấy phép của các gói được thêm vào frontend từ Đợt 9. Gói có từ trước (React, Vite, Tailwind, shadcn/ui, Radix,
React Query, Zustand, Recharts, zod, MSW, Playwright, Vitest…) đều là MIT hoặc Apache-2.0, xem `frontend/package.json`.
Mỗi gói mới đều được kiểm giấy phép từ tarball trên npm **trước khi cài**, và cài đúng phiên bản đã kiểm (không dùng `^`).

## Đợt 10A – Bàn làm việc (v0.4.0)

| Gói | Phiên bản | Giấy phép | Loại | Ghi chú |
|---|---|---|---|---|
| `dockview-react` | 8.10.0 | MIT | dependency | Khung dock của Bàn làm việc: tab, dock, đổi kích thước, nhóm nổi, lưu/khôi phục JSON |
| `dockview` | 8.10.0 | MIT | kéo theo | Phụ thuộc của `dockview-react` |
| `dockview-core` | 8.10.0 | MIT | kéo theo | Phụ thuộc của `dockview`, không có phụ thuộc nào khác |
| `react-hotkeys-hook` | 5.4.0 | MIT | dependency | Phím tắt có scope; không có phụ thuộc |

**dockview có bản trả phí riêng** (`dockview-enterprise`). App **không dùng** gói đó, cũng không bật option nào cần
module của nó. Danh sách module trả phí (theo `ENTERPRISE_MODULE_NAMES` trong `dockview-core` 8.10.0):
- KeyboardNavigation, KeyboardDocking, LayoutHistory;
- PinnedTabs, MultiRowTabs, SmartGuides;
- AutoHideEdgeGroup, AutoEdgeGroup, AdvancedOverflow, DndCompass, License.

Những tính năng Bàn làm việc dùng đều là module có sẵn của bản MIT (danh sách `AllModules`, tự đăng ký):

| Tính năng | Module miễn phí |
|---|---|
| Dock, tab, đổi kích thước | lõi |
| Nhóm nổi | FloatingGroup |
| Lưu / khôi phục JSON | lõi (`toJSON` / `fromJSON`) |
| Tách cửa sổ (Đợt 10B) | PopoutWindow (`api.addPopoutGroup`) |
| Menu, nút trên thanh tab, thông báo cho trình đọc màn hình | ContextMenu, HeaderActions, LiveRegion |

Điều hướng bàn phím giữa các panel (Alt+1…9, bảng theo mẫu Grid) do app tự viết (`src/hotkeys`,
`src/hooks/useGridKeyboard.ts`), không dùng module KeyboardNavigation trả phí. Không có watermark, không cần key.

## Đợt 9 – Theme (v0.3.0)

| Gói | Phiên bản | Giấy phép | Loại | Ghi chú |
|---|---|---|---|---|
| `@axe-core/playwright` | 4.14.1 | MPL-2.0 | devDependency | Kiểm tương phản màu trong test Playwright; không vào bản build |
| `axe-core` | 4.14.1 | MPL-2.0 | kéo theo | Phụ thuộc của `@axe-core/playwright` |

MPL-2.0 là giấy phép copyleft theo từng file: chỉ ràng buộc khi sửa chính các file của axe-core và phân phối lại. App chỉ
dùng ở bước kiểm thử, không sửa, không đóng gói vào bản chạy.
