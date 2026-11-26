// Giữ bản nháp trên Phiếu lệnh khi mã của nhóm liên kết đổi (Đợt 10A). Hàm thuần, test ở ticketSymbol.test.ts.

export type TicketSymbolDecision =
  /** Mã không đổi. */
  | 'none'
  /** Phiếu trống (chưa nhập gì): đổi theo nhóm ngay. */
  | 'follow'
  /** Đang có bản nháp: hỏi "Giữ bản nháp cho mã cũ / Chuyển sang mã mới", không xóa trắng. */
  | 'ask'
  /** Phiếu đang khóa mã: bỏ qua thay đổi của nhóm. */
  | 'ignore'

export interface TicketSymbolChange {
  /** Mã phiếu đang đặt. */
  current: string
  /** Mã mới của nhóm. */
  next: string
  /** Phiếu có dữ liệu người dùng đã nhập (hoặc vừa điền theo mẫu). */
  dirty: boolean
  /** Người dùng bật "Khóa mã" trên phiếu. */
  locked: boolean
}

export function resolveTicketSymbolChange({ current, next, dirty, locked }: TicketSymbolChange): TicketSymbolDecision {
  if (current === next) return 'none'
  if (locked) return 'ignore'
  return dirty ? 'ask' : 'follow'
}
