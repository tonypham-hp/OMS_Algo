import type { SessionCode } from '@/types'

const hhmm = (hour: number, minute: number) => hour * 3600 + minute * 60

/** Các phiên trong ngày, tính bằng giây kể từ 00:00. Mỗi khoảng gồm giờ bắt đầu, không gồm giờ kết thúc. */
export const TRADING_SESSIONS: ReadonlyArray<{ code: SessionCode; start: number; end: number }> = [
  { code: 'ATO', start: hhmm(9, 0), end: hhmm(9, 15) },
  { code: 'CONTINUOUS', start: hhmm(9, 15), end: hhmm(11, 30) },
  { code: 'LUNCH', start: hhmm(11, 30), end: hhmm(13, 0) },
  { code: 'CONTINUOUS', start: hhmm(13, 0), end: hhmm(14, 30) },
  { code: 'ATC', start: hhmm(14, 30), end: hhmm(14, 45) },
]

export const MARKET_OPEN_SECONDS = hhmm(9, 0)
export const MARKET_CLOSE_SECONDS = hhmm(14, 45)

export const SESSION_LABELS: Record<SessionCode, string> = {
  PRE_OPEN: 'Chưa mở cửa',
  ATO: 'Phiên ATO',
  CONTINUOUS: 'Khớp lệnh liên tục',
  LUNCH: 'Nghỉ trưa',
  ATC: 'Phiên ATC',
  CLOSED: 'Đã đóng cửa',
}

/** Biên độ dao động so với giá tham chiếu, tính theo %. */
export const PRICE_BAND_PCT = 7

/** Bước giá theo mức giá. Tìm dòng đầu tiên có giá nhỏ hơn `below`. */
export const TICK_SIZE_RULES: ReadonlyArray<{ below: number; tick: number }> = [
  { below: 10_000, tick: 10 },
  { below: 50_000, tick: 50 },
  { below: Number.POSITIVE_INFINITY, tick: 100 },
]

export const QTY_LOT_SIZE = 100
export const MAX_ORDER_QTY = 500_000
