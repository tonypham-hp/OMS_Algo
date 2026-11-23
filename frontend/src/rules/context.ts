// Dựng đầu vào cho bộ kiểm tra từ dữ liệu của app (dòng bảng giá, tài khoản).
import type { SessionCode, SymbolQuote } from '@/types'
import { defaultRules, rulesFor } from './registry'
import type { RulePack, SecType, SymbolInfo } from './types'

export function symbolInfoFromQuote(quote: SymbolQuote): SymbolInfo {
  return {
    symbol: quote.symbol,
    secType: quote.sec_type ?? 'STOCK',
    ref: quote.ref_price,
    ceiling: quote.ceiling_price,
    floor: quote.floor_price,
    halted: quote.board === null,
    ...(quote.foreign_room !== undefined ? { foreignRoom: quote.foreign_room } : {}),
    ...(quote.trading_status === 'RESTRICTED' ? { restricted: true } : {}),
    ...(quote.phase?.call_end != null ? { callEnd: quote.phase.call_end } : {}),
  }
}

export interface RuleContext {
  rules: RulePack
  secType: SecType
  symbol: SymbolInfo
}

/**
 * Luật, loại chứng khoán và thông tin mã của một dòng bảng giá vào ngày `date`.
 * Không có ngày thì lấy pack mới nhất của bảng (chỉ khác khi có pack hết hiệu lực).
 */
export function buildRuleContext(quote: SymbolQuote, date?: string): RuleContext {
  const board = quote.board ?? 'STO'
  const rules = date ? rulesFor(board, date) : board === 'STO' ? defaultRules() : rulesFor(board, '9999-12-31')
  return { rules, secType: quote.sec_type ?? 'STOCK', symbol: symbolInfoFromQuote(quote) }
}

/** Phiên của bảng giao dịch của mã, từ trạng thái thị trường. Mã ngừng giao dịch coi như đóng cửa. */
export function sessionForQuote(
  quote: Pick<SymbolQuote, 'board' | 'phase'> | undefined,
  market: { session: SessionCode; board_sessions?: Partial<Record<'STO' | 'STX' | 'UPX', SessionCode>> },
): SessionCode {
  if (quote?.board === null) return 'CLOSED'
  if (quote?.phase) return quote.phase.session
  return market.board_sessions?.[quote?.board ?? 'STO'] ?? market.session
}
