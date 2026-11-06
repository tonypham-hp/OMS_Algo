import {
  MARKET_CLOSE_SECONDS,
  MARKET_OPEN_SECONDS,
  MAX_ORDER_QTY,
  PRICE_BAND_PCT,
  QTY_LOT_SIZE,
  TICK_SIZE_RULES,
  TRADING_SESSIONS,
} from '@/config/hose'
import { formatNumber } from '@/lib/format'
import type { SessionCode, SymbolQuote } from '@/types'

export function getTickSize(price: number): number {
  const rule = TICK_SIZE_RULES.find((item) => price < item.below)
  return rule ? rule.tick : TICK_SIZE_RULES[TICK_SIZE_RULES.length - 1].tick
}

export function isValidTick(price: number): boolean {
  return Number.isInteger(price) && price > 0 && price % getTickSize(price) === 0
}

/** Giá trần: +7% rồi làm tròn xuống theo bước giá, để không vượt biên độ. */
export function getCeilingPrice(refPrice: number): number {
  const raw = Math.floor((refPrice * (100 + PRICE_BAND_PCT)) / 100)
  const tick = getTickSize(raw)
  return Math.floor(raw / tick) * tick
}

/** Giá sàn: -7% rồi làm tròn lên theo bước giá, để không vượt biên độ. */
export function getFloorPrice(refPrice: number): number {
  const raw = Math.ceil((refPrice * (100 - PRICE_BAND_PCT)) / 100)
  const tick = getTickSize(raw)
  return Math.ceil(raw / tick) * tick
}

export function getSessionAt(secondsOfDay: number): SessionCode {
  if (secondsOfDay < MARKET_OPEN_SECONDS) return 'PRE_OPEN'
  if (secondsOfDay >= MARKET_CLOSE_SECONDS) return 'CLOSED'
  const session = TRADING_SESSIONS.find(
    (item) => secondsOfDay >= item.start && secondsOfDay < item.end,
  )
  return session ? session.code : 'CLOSED'
}

/** Phiên khớp lệnh định kỳ: chỉ có giá dự kiến, khớp một lần lúc hết phiên. */
export function isAuctionSession(session: SessionCode): boolean {
  return session === 'ATO' || session === 'ATC'
}

/** Giá hiển thị trên bảng giá: giá dự kiến nếu đang có, không thì giá khớp. */
export function getDisplayPrice(quote: SymbolQuote): number {
  return quote.indicative_price ?? quote.last_price
}

/** Lệnh MTL chỉ hợp lệ trong phiên khớp lệnh liên tục. */
export function isMtlAllowed(session: SessionCode): boolean {
  return session === 'CONTINUOUS'
}

/** Không được sửa, hủy lệnh trong phiên ATO và ATC. */
export function isModifyCancelAllowed(session: SessionCode): boolean {
  return session !== 'ATO' && session !== 'ATC'
}

/** Trả về câu báo lỗi tiếng Việt, hoặc null nếu giá hợp lệ. */
export function validatePrice(price: number, refPrice: number): string | null {
  if (!Number.isInteger(price) || price <= 0) return 'Giá phải là số nguyên đồng lớn hơn 0'
  const ceiling = getCeilingPrice(refPrice)
  const floor = getFloorPrice(refPrice)
  if (price > ceiling) return `Giá không được vượt giá trần ${formatNumber(ceiling)}`
  if (price < floor) return `Giá không được thấp hơn giá sàn ${formatNumber(floor)}`
  const tick = getTickSize(price)
  if (price % tick !== 0) return `Giá phải theo bước ${formatNumber(tick)}đ ở mức giá này`
  return null
}

/** Trả về câu báo lỗi tiếng Việt, hoặc null nếu khối lượng hợp lệ. */
export function validateQuantity(qty: number): string | null {
  if (!Number.isInteger(qty) || qty <= 0) return 'Khối lượng phải là số nguyên lớn hơn 0'
  if (qty % QTY_LOT_SIZE !== 0) return `Khối lượng phải là bội số của ${QTY_LOT_SIZE}`
  if (qty > MAX_ORDER_QTY) return `Khối lượng tối đa ${formatNumber(MAX_ORDER_QTY)} cổ phiếu/lệnh`
  return null
}

/** "09:15" → 33300. Trả về null nếu sai định dạng. */
export function parseTimeToSeconds(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 3600 + minute * 60
}
