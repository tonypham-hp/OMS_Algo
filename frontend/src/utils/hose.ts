// Lớp mỏng giữ tên hàm cũ. Mọi luật lấy từ gói luật (src/rules): mặc định là pack HOSE đang hiệu lực,
// truyền `rules` và `secType` khi biết mã (xem rulesForQuote).
import * as price from '@/rules/price'
import { defaultRules, rulesFor } from '@/rules/registry'
import * as session from '@/rules/session'
import type { RulePack, SecType } from '@/rules/types'
import type { SessionCode, SymbolQuote } from '@/types'

export { isAuctionSession, isMatchingOver, parseTimeToSeconds } from '@/rules/session'

export function getTickSize(value: number, secType: SecType = 'STOCK', rules: RulePack = defaultRules()): number {
  return price.getTickSize(value, secType, rules)
}

export function isValidTick(value: number, secType: SecType = 'STOCK', rules: RulePack = defaultRules()): boolean {
  return price.isValidTick(value, secType, rules)
}

export function stepPrice(value: number, steps: number, secType: SecType = 'STOCK', rules: RulePack = defaultRules()): number {
  return price.stepPrice(value, steps, secType, rules)
}

export function roundToTick(
  value: number,
  direction: 'down' | 'up' = 'down',
  secType: SecType = 'STOCK',
  rules: RulePack = defaultRules(),
): number {
  return price.roundToTick(value, direction, secType, rules)
}

export function countTicks(from: number, to: number, secType: SecType = 'STOCK', rules: RulePack = defaultRules()): number {
  return price.countTicks(from, to, secType, rules)
}

/** Giá trần: tham chiếu × (1 + biên) rồi làm tròn xuống theo bước giá. */
export function getCeilingPrice(refPrice: number, rules: RulePack = defaultRules()): number {
  return price.priceLimits(refPrice, 'STOCK', rules).ceiling
}

/** Giá sàn: tham chiếu × (1 − biên) rồi làm tròn lên theo bước giá. */
export function getFloorPrice(refPrice: number, rules: RulePack = defaultRules()): number {
  return price.priceLimits(refPrice, 'STOCK', rules).floor
}

export function getSessionAt(secondsOfDay: number, rules: RulePack = defaultRules()): SessionCode {
  return session.getSessionAt(secondsOfDay, rules)
}

/** Giá hiển thị trên bảng giá: giá dự kiến nếu đang có, không thì giá khớp. */
export function getDisplayPrice(quote: SymbolQuote): number {
  return quote.indicative_price ?? quote.last_price
}

/** MTL chỉ hợp lệ trong phiên khớp lệnh liên tục (theo loại lệnh của pack). */
export function isMtlAllowed(current: SessionCode, rules: RulePack = defaultRules()): boolean {
  return session.isMtlAllowed(rules, current)
}

/** Sửa, hủy lệnh có bị khóa trong phiên này không (HOSE: khóa trong ATO, ATC – chưa kiểm chứng với KRX). */
export function isModifyCancelAllowed(current: SessionCode, rules: RulePack = defaultRules()): boolean {
  return session.isAmendAllowed(rules, current) && session.isCancelAllowed(rules, current)
}

/** Luật và loại chứng khoán của một dòng bảng giá. Thiếu thông tin bảng thì coi là cổ phiếu HOSE. */
export function rulesForQuote(quote: Pick<SymbolQuote, 'board' | 'sec_type'> | undefined, date?: string) {
  const board = quote?.board ?? 'STO'
  const rules = date ? rulesFor(board, date) : board === 'STO' ? defaultRules() : rulesFor(board, '9999-12-31')
  return { rules, secType: quote?.sec_type ?? ('STOCK' as SecType) }
}

