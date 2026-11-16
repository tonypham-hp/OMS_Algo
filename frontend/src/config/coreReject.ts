import { formatNumber } from '@/lib/format'
import type { CoreRejectCode } from '@/types'
import { MAX_ORDER_QTY, PRICE_BAND_PCT, QTY_LOT_SIZE } from './hose'

/** Nhãn ngắn của lý do Core từ chối, dùng ở nút bơm lỗi và phần giải thích lệnh. */
export const CORE_REJECT_LABELS: Record<CoreRejectCode, string> = {
  LOT_SIZE: `Sai lô ${QTY_LOT_SIZE}`,
  TICK_SIZE: 'Sai bước giá',
  MAX_QTY: `Vượt ${formatNumber(MAX_ORDER_QTY)} cổ phiếu/lệnh`,
  PRICE_BAND: `Ngoài biên độ ±${PRICE_BAND_PCT}%`,
  OTHER: 'Lý do khác',
}

export const CORE_REJECT_CODES = Object.keys(CORE_REJECT_LABELS) as CoreRejectCode[]
