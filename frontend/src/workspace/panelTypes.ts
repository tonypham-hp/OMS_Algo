// Loại panel của Bàn làm việc (Đợt 10A). Thuần dữ liệu (không React) để dùng chung cho registry, bố cục mẫu,
// migrate bố cục đã lưu, phím tắt và test.

export type PanelKind = 'watchlist' | 'ticket' | 'depth' | 'blotter' | 'order-detail' | 'algos' | 'notifications'

/** Nhóm liên kết theo màu: các panel cùng nhóm dùng chung mã đang chọn và lệnh đang xem. */
export type LinkGroup = 'none' | '1' | '2' | '3' | '4'
export const LINK_GROUPS: ReadonlyArray<Exclude<LinkGroup, 'none'>> = ['1', '2', '3', '4']

export interface PanelKindInfo {
  title: string
  /** Giải thích ngắn trong danh sách "+ Thêm panel". */
  description: string
  /** data-demo-id của khung panel (khác id của component bên trong, tránh trùng khi mở nhiều panel). */
  demoId: string
  /** Panel có dùng mã đang chọn của nhóm không (để menu nhóm liên kết có ý nghĩa). */
  linkable: boolean
  /** Phím tắt tới panel này trên Bàn làm việc (hiện trong menu "+ Thêm panel"). */
  hotkey?: string
}

export const PANEL_KINDS: Record<PanelKind, PanelKindInfo> = {
  watchlist: { title: 'Danh mục theo dõi', description: 'Bảng giá thu gọn, chọn mã cho cả nhóm', demoId: 'ws-watchlist', linkable: true },
  ticket: { title: 'Phiếu lệnh', description: 'Đặt lệnh, luôn qua bước xác nhận', demoId: 'ws-ticket', linkable: true, hotkey: 'B / S' },
  depth: { title: 'Sổ lệnh 3 mức', description: '3 mức giá mua, bán tốt nhất của mã', demoId: 'ws-depth', linkable: true, hotkey: 'D' },
  blotter: { title: 'Sổ lệnh', description: 'Lệnh cha, tiến độ, thao tác Sửa/Hủy/Tạm dừng', demoId: 'ws-blotter', linkable: true, hotkey: 'O' },
  'order-detail': { title: 'Chi tiết lệnh', description: 'Lệnh con, khớp, giải thích, HUNT', demoId: 'ws-order-detail', linkable: true },
  algos: { title: 'Thuật toán đang chạy', description: 'Lệnh thuật toán đang hoạt động', demoId: 'ws-algos', linkable: true },
  notifications: { title: 'Thông báo', description: 'Thông báo lệnh, bấm để mở chi tiết', demoId: 'ws-notifications', linkable: true, hotkey: 'N' },
}

export const PANEL_KIND_ORDER: ReadonlyArray<PanelKind> = ['watchlist', 'ticket', 'depth', 'blotter', 'order-detail', 'algos', 'notifications']

export const isPanelKind = (value: unknown): value is PanelKind => typeof value === 'string' && value in PANEL_KINDS

/** Tham số lưu trong mỗi panel dockview (đi theo bố cục khi lưu/khôi phục). */
export interface PanelParams {
  group: LinkGroup
  /** Mã riêng của panel "Không nhóm". */
  symbol?: string
  /** Lệnh riêng của panel Chi tiết "Không nhóm". */
  orderId?: string | null
  /** Phiếu lệnh: "Khóa mã" – không đổi theo nhóm liên kết. */
  locked?: boolean
}

/** Id panel mới, không trùng với panel đang có: `<loại>-<n>`. */
export function nextPanelId(kind: PanelKind, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds)
  for (let index = 1; ; index += 1) {
    const id = `${kind}-${index}`
    if (!taken.has(id)) return id
  }
}
