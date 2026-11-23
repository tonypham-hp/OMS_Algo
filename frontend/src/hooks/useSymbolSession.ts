import { buildRuleContext, sessionForQuote } from '@/rules/context'
import { useMarketStore } from '@/store/market.store'
import type { SessionCode, SymbolPhase } from '@/types'

/**
 * Phiên của một mã theo bảng giao dịch của nó: mã hạn chế có lượt khớp định kỳ riêng (phase), mã HNX/UPCoM theo bảng.
 * Dùng cho khóa sửa, hủy và câu lý do trên Sổ lệnh, Chi tiết lệnh.
 */
export function useSymbolSession(symbol: string) {
  const session = useMarketStore((state) =>
    sessionForQuote(
      state.quotes.find((quote) => quote.symbol === symbol),
      state,
    ),
  ) as SessionCode
  const callEnd = useMarketStore((state) => state.quotes.find((quote) => quote.symbol === symbol)?.phase?.call_end ?? null)
  const board = useMarketStore((state) => state.quotes.find((quote) => quote.symbol === symbol)?.board)
  const tradingStatus = useMarketStore((state) => state.quotes.find((quote) => quote.symbol === symbol)?.trading_status)
  const quote = useMarketStore.getState().quotes.find((item) => item.symbol === symbol)
  const rules = quote ? buildRuleContext(quote).rules : undefined
  const phase: SymbolPhase | undefined = callEnd !== null ? { session, call_end: callEnd, call_id: null } : undefined
  return { session, phase, rules, board, tradingStatus }
}
