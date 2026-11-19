// Lớp mỏng giữ tên cũ cho những chỗ chỉ cần số của HOSE: mọi số đọc từ gói luật (src/rules), không viết cứng ở đây.
import { defaultRules } from '@/rules/registry'
import type { SessionCode } from '@/types'

export const SESSION_LABELS: Record<SessionCode, string> = {
  PRE_OPEN: 'Chưa mở cửa',
  ATO: 'Phiên ATO',
  CONTINUOUS: 'Khớp lệnh liên tục',
  LUNCH: 'Nghỉ trưa',
  ATC: 'Phiên ATC',
  PUT_THROUGH: 'Thỏa thuận sau giờ',
  CLOSED: 'Đã đóng cửa',
}

const STO = defaultRules()

/** Biên độ dao động ngày thường của HOSE, %. Theo mã cụ thể thì dùng rulesFor(board, ngày).priceBand. */
export const PRICE_BAND_PCT = STO.priceBand.normal
export const QTY_LOT_SIZE = STO.lots.round
export const MAX_ORDER_QTY = STO.maxQty.round
