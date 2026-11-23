// Kiểm tra lệnh thỏa thuận theo gói luật (hàm thuần). Câu tiếng Việt cho từng mã lỗi ở src/explain/reasons.ts.
import type { SessionCode, Side } from '@/types'
import type { RuleCode, RulePack, RuleViolation, SymbolInfo } from './types'

export interface PutThroughInput {
  side: Side
  qty: number
  price: number
  accountNo: string
  counterparty: string
}

const v = (code: RuleCode, field: RuleViolation['field'], params: RuleViolation['params'] = {}): RuleViolation => ({
  code,
  field,
  severity: 'error',
  params,
})

/**
 * Lệnh thỏa thuận: KL tối thiểu theo bảng (HOSE 20.000, HNX/UPCoM 5.000 CP), bước giá 1 đ, giá trong trần – sàn của mã,
 * chỉ trong các phiên pack cho phép (HOSE: giờ giao dịch và thỏa thuận sau giờ 14:45–15:00), có tài khoản đối ứng.
 * `boardSession`: phiên của bảng giao dịch (không phải lượt định kỳ riêng của mã hạn chế).
 */
export function validatePutThrough(
  input: PutThroughInput,
  rules: RulePack,
  boardSession: SessionCode,
  symbol: SymbolInfo,
): RuleViolation[] {
  if (symbol.halted) return [v('SYMBOL_TRANSFER_HALT', 'symbol', { symbol: symbol.symbol })]
  if (symbol.tradingHalted) return [v('SYMBOL_TRADING_HALTED', 'symbol', { symbol: symbol.symbol })]
  const spec = rules.putThrough
  if (!spec) return [v('PT_SESSION_CLOSED', 'session', { session: boardSession, board: rules.board })]
  const errors: RuleViolation[] = []
  if (!spec.sessions.includes(boardSession)) {
    errors.push(v('PT_SESSION_CLOSED', 'session', { session: boardSession, board: rules.board }))
  }
  if (!Number.isInteger(input.qty) || input.qty < spec.minQty) {
    errors.push(v('PT_MIN_QTY', 'qty', { qty: input.qty, min: spec.minQty, board: rules.board }))
  }
  if (!Number.isInteger(input.price) || input.price <= 0 || input.price % spec.tick !== 0) {
    errors.push(v('PT_PRICE_TICK', 'price', { price: input.price, tick: spec.tick }))
  } else if (input.price > symbol.ceiling || input.price < Math.max(symbol.floor, rules.minPrice)) {
    errors.push(
      v('PRICE_OUT_OF_BAND', 'price', {
        price: input.price,
        ceiling: symbol.ceiling,
        floor: symbol.floor,
        ref: symbol.ref,
        band: rules.priceBand.normal,
        secType: symbol.secType,
        limit: input.price > symbol.ceiling ? 'ceiling' : 'floor',
      }),
    )
  }
  const counterparty = input.counterparty.trim()
  if (!counterparty || counterparty === input.accountNo) {
    errors.push(v('PT_COUNTERPARTY_REQUIRED', 'account', { account: input.accountNo }))
  }
  return errors
}
