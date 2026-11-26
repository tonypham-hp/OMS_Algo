// Danh sách phím tắt (Đợt 10A): một nguồn cho bảng phím tắt (?), Ctrl+K và tooltip nút.
// KHÔNG phím nào gửi lệnh: B/S chỉ mở phiếu, gửi lệnh luôn qua bước Xác nhận như bấm chuột.
// Không dùng F1 (trợ giúp của trình duyệt), không chặn Ctrl+W / Ctrl+T / Ctrl+R.

export type ShortcutScope = 'workspace' | 'global'

export interface Shortcut {
  id: string
  /** Chuỗi phím cho react-hotkeys-hook (theo phím vật lý, trừ khi `useKey`). */
  keys: string
  /** Nhãn hiển thị trong bảng phím tắt, Ctrl+K, tooltip. */
  label: string
  description: string
  group: 'Đặt lệnh' | 'Panel' | 'Chung'
  scope: ShortcutScope
  /** Khớp theo ký tự tạo ra (cho "?") thay vì phím vật lý. */
  useKey?: boolean
}

export const SHORTCUTS: ReadonlyArray<Shortcut> = [
  { id: 'buy', keys: 'b', label: 'B', description: 'Mở phiếu Mua (mã của panel đang chọn hoặc nhóm của nó)', group: 'Đặt lệnh', scope: 'workspace' },
  { id: 'sell', keys: 's', label: 'S', description: 'Mở phiếu Bán (mã của panel đang chọn hoặc nhóm của nó)', group: 'Đặt lệnh', scope: 'workspace' },
  { id: 'blotter', keys: 'o', label: 'O', description: 'Tới panel Sổ lệnh (mở thêm nếu chưa có)', group: 'Panel', scope: 'workspace' },
  { id: 'depth', keys: 'd', label: 'D', description: 'Tới panel Sổ lệnh 3 mức (mở thêm nếu chưa có)', group: 'Panel', scope: 'workspace' },
  { id: 'notifications', keys: 'n', label: 'N', description: 'Tới panel Thông báo (mở thêm nếu chưa có)', group: 'Panel', scope: 'workspace' },
  {
    id: 'focus-panel',
    keys: 'alt+1, alt+2, alt+3, alt+4, alt+5, alt+6, alt+7, alt+8, alt+9',
    label: 'Alt+1…9',
    description: 'Chuyển tới panel thứ 1–9 (trái → phải, trên → dưới)',
    group: 'Panel',
    scope: 'workspace',
  },
  { id: 'cheat-sheet', keys: '?, slash', label: '? hoặc /', description: 'Mở bảng phím tắt', group: 'Chung', scope: 'global', useKey: false },
  { id: 'palette', keys: '', label: 'Ctrl+K', description: 'Tìm nhanh lệnh, mã, màn hình, thao tác', group: 'Chung', scope: 'global' },
  { id: 'escape', keys: '', label: 'Esc', description: 'Đóng hộp thoại, hủy nhập', group: 'Chung', scope: 'global' },
]

export const SHORTCUT_GROUPS: ReadonlyArray<Shortcut['group']> = ['Đặt lệnh', 'Panel', 'Chung']

export function shortcutLabel(id: string): string | undefined {
  return SHORTCUTS.find((shortcut) => shortcut.id === id)?.label
}
