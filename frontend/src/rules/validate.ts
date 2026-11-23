// Bộ kiểm tra lệnh theo gói luật: hàm thuần, đứng trước engine. Form Đặt lệnh, Sửa lệnh, Sửa giá, mẫu chiến lược,
// HUNT, Demo và API giả lập đều đi qua đây. Câu tiếng Việt cho từng mã lỗi ở src/explain/reasons.ts (RULE_REASONS).
import type { SessionCode, Side } from '@/types'
import { getTickSize } from './price'
import { allowedOrderTypes, isAmendAllowed, isCancelAllowed } from './session'
import type {
  AccountInfo,
  AmendInput,
  AmendKind,
  LotKind,
  OrderInput,
  OrderType,
  RuleCode,
  RuleField,
  RulePack,
  RuleViolation,
  SymbolInfo,
} from './types'

const MARKET_ORDER_TYPES: readonly OrderType[] = ['MTL', 'ATO', 'ATC', 'MOK', 'MAK']

function violation(
  code: RuleCode,
  field: RuleField,
  params: RuleViolation['params'] = {},
  severity: RuleViolation['severity'] = 'error',
): RuleViolation {
  return { code, field, severity, params }
}

/** Giá của một lệnh giới hạn: số nguyên dương, trong trần – sàn, đúng bước giá theo loại chứng khoán. */
export function checkPrice(price: number, rules: RulePack, symbol: SymbolInfo): RuleViolation[] {
  if (!Number.isInteger(price) || price <= 0) return [violation('PRICE_INVALID', 'price', { price })]
  const band = { ref: symbol.ref, ceiling: symbol.ceiling, floor: symbol.floor, band: rules.priceBand.normal, secType: symbol.secType }
  if (price > symbol.ceiling) return [violation('PRICE_OUT_OF_BAND', 'price', { ...band, price, limit: 'ceiling' })]
  if (price < rules.minPrice) return [violation('PRICE_BELOW_MIN', 'price', { price, min: rules.minPrice, floor: symbol.floor })]
  if (price < symbol.floor) return [violation('PRICE_OUT_OF_BAND', 'price', { ...band, price, limit: 'floor' })]
  const tick = getTickSize(price, symbol.secType, rules)
  if (price % tick !== 0) return [violation('PRICE_TICK', 'price', { price, tick, secType: symbol.secType })]
  return []
}

/** Khối lượng: lô chẵn là bội số của lô và không vượt tối đa; lô lẻ trong khoảng 1–99. */
export function checkQty(qty: number, lot: LotKind, rules: RulePack): RuleViolation[] {
  if (!Number.isInteger(qty) || qty <= 0) return [violation('QTY_INVALID', 'qty', { qty })]
  if (lot === 'ODD') {
    const { min, max } = rules.lots.odd
    return qty < min || qty > max ? [violation('LOT_ODD_RANGE', 'qty', { qty, min, max })] : []
  }
  if (qty % rules.lots.round !== 0) return [violation('LOT_ROUND_MULTIPLE', 'qty', { qty, lot: rules.lots.round })]
  if (qty > rules.maxQty.round) return [violation('MAX_QTY', 'qty', { qty, max: rules.maxQty.round })]
  return []
}

/** Lệnh mua của nhà đầu tư nước ngoài không được vượt room còn lại. */
export function checkForeignRoom(side: Side, qty: number, symbol: SymbolInfo, account: AccountInfo): RuleViolation[] {
  if (!account.isForeign || side !== 'BUY' || symbol.foreignRoom === undefined) return []
  return qty > symbol.foreignRoom
    ? [violation('FOREIGN_ROOM_EXCEEDED', 'qty', { symbol: symbol.symbol, qty, room: symbol.foreignRoom })]
    : []
}

/** Loại lệnh có được đặt trong phiên không. Lệnh thuật toán (immediate=false) chỉ nhận cảnh báo. */
export function checkSession(
  orderType: OrderType,
  lot: LotKind,
  rules: RulePack,
  session: SessionCode,
  immediate: boolean,
  restricted = false,
): RuleViolation[] {
  const allowed = allowedOrderTypes(rules, session, lot, restricted)
  if (allowed.includes(orderType)) return []
  const severity = immediate ? 'error' : 'warn'
  const params = { orderType, session, board: rules.board, allowed: allowed.join(', ') }
  if (allowed.length === 0) return [violation('BOARD_CLOSED', 'session', params, severity)]
  if (orderType === 'MTL') return [violation('MTL_CONTINUOUS_ONLY', 'orderType', params, severity)]
  return [violation('ORDER_TYPE_NOT_IN_SESSION', 'orderType', params, severity)]
}

/**
 * Kiểm một lệnh theo ma trận bảng × phiên × loại lệnh × loại lô × loại chứng khoán.
 * Trả về mọi vi phạm (rỗng là hợp lệ); `severity: 'warn'` không chặn lệnh.
 */
export function validateOrder(
  input: OrderInput,
  rules: RulePack,
  sessionNow: SessionCode,
  symbolInfo: SymbolInfo,
  account: AccountInfo,
): RuleViolation[] {
  if (symbolInfo.halted) return [violation('SYMBOL_TRANSFER_HALT', 'symbol', { symbol: symbolInfo.symbol })]
  if (symbolInfo.tradingHalted) return [violation('SYMBOL_TRADING_HALTED', 'symbol', { symbol: symbolInfo.symbol })]
  const errors: RuleViolation[] = []
  const { orderType, lot } = input
  // Mã hạn chế giao dịch: chỉ lô chẵn, không MTL (kể cả lệnh thuật toán sẽ sinh MTL), lượt định kỳ chỉ nhận LO.
  if (symbolInfo.restricted && rules.restricted) {
    if (lot === 'ODD') errors.push(violation('RESTRICTED_ROUND_LOT_ONLY', 'qty', { symbol: symbolInfo.symbol, lot: rules.lots.round }))
    else if (orderType === 'MTL') errors.push(violation('RESTRICTED_NO_MTL', 'orderType', { symbol: symbolInfo.symbol, orderType }))
    else errors.push(...checkSession(orderType, lot, rules, sessionNow, input.immediate ?? false, true))
    errors.push(...priceAndQty(input, rules, symbolInfo, account, lot === 'ODD'))
    return errors
  }
  const mokMak = rules.flags.MOK_MAK
  if ((orderType === 'MOK' || orderType === 'MAK') && mokMak && !mokMak.enabled) {
    errors.push(violation('ORDER_TYPE_DISABLED', 'orderType', { orderType, board: rules.board, label: mokMak.label }))
  } else if (lot === 'ODD' && orderType !== 'LO') {
    errors.push(violation('ODD_LOT_LO_ONLY', 'orderType', { orderType }))
  } else {
    errors.push(...checkSession(orderType, lot, rules, sessionNow, input.immediate ?? false))
  }

  errors.push(...priceAndQty(input, rules, symbolInfo, account))
  return errors
}

/** Giá theo loại lệnh, KL theo lô, room ngoại. `skipQty`: KL đã có lỗi riêng (lô lẻ trên mã hạn chế). */
function priceAndQty(input: OrderInput, rules: RulePack, symbolInfo: SymbolInfo, account: AccountInfo, skipQty = false) {
  const errors: RuleViolation[] = []
  const { orderType, lot } = input
  if (MARKET_ORDER_TYPES.includes(orderType)) {
    if (input.price !== null) errors.push(violation('PRICE_NOT_ALLOWED', 'price', { orderType }))
  } else if (input.price === null) {
    errors.push(violation('PRICE_REQUIRED', 'price', { orderType }))
  } else {
    errors.push(...checkPrice(input.price, rules, symbolInfo))
  }
  if (skipQty) return errors
  const qtyErrors = checkQty(input.qty, lot, rules)
  errors.push(...qtyErrors)
  if (qtyErrors.length === 0) errors.push(...checkForeignRoom(input.side, input.qty, symbolInfo, account))
  return errors
}

/** Câu lỗi khóa sửa, hủy của mã hạn chế: kèm giờ khớp của lượt. */
function restrictedLock(symbolInfo: SymbolInfo, rules: RulePack): RuleViolation {
  const end = symbolInfo.callEnd ?? 0
  const pad = (value: number) => String(value).padStart(2, '0')
  return violation('RESTRICTED_LOCKED', 'session', {
    symbol: symbolInfo.symbol,
    lockMinutes: Math.round((rules.restricted?.lockSecondsBeforeCall ?? 0) / 60),
    callEnd: `${pad(Math.floor(end / 3600))}:${pad(Math.floor((end % 3600) / 60))}`,
    session: 'PERIODIC_LOCK',
  })
}

export type AmendClass = AmendKind | 'BOTH' | 'NONE'

/** Loại một lần sửa: chỉ giá, tăng KL, giảm KL; đổi cả hai hoặc không đổi gì là không hợp lệ. */
export function classifyAmend(from: AmendInput['from'], to: AmendInput['to']): AmendClass {
  const priceChanged = from.price !== to.price
  const qtyChanged = from.qty !== to.qty
  if (priceChanged && qtyChanged) return 'BOTH'
  if (priceChanged) return 'PRICE'
  if (to.qty > from.qty) return 'QTY_UP'
  if (to.qty < from.qty) return 'QTY_DOWN'
  return 'NONE'
}

/** Sửa giá hoặc tăng KL thì mất ưu tiên thời gian, giảm KL thì giữ (theo pack). */
export function losesPriority(kind: AmendKind, rules: RulePack): boolean {
  return rules.amendPolicy.losesPriority.includes(kind)
}

/**
 * Kiểm một lần sửa lệnh LO tại chỗ: mỗi lần chỉ giá HOẶC KL, phiên không khóa sửa, giá/KL mới hợp lệ,
 * tăng KL của nhà đầu tư nước ngoài không vượt room.
 */
export function validateAmend(
  amend: AmendInput,
  side: Side,
  lot: LotKind,
  rules: RulePack,
  sessionNow: SessionCode,
  symbolInfo: SymbolInfo,
  account: AccountInfo,
): RuleViolation[] {
  const kind = classifyAmend(amend.from, amend.to)
  if (kind === 'BOTH' && rules.amendPolicy.oneFieldPerAmend) return [violation('AMEND_ONE_FIELD', 'price')]
  if (kind === 'NONE') return [violation('AMEND_NO_CHANGE', 'qty')]
  if (sessionNow === 'PERIODIC_LOCK') return [restrictedLock(symbolInfo, rules)]
  if (!isAmendAllowed(rules, sessionNow)) return [violation('AMEND_LOCKED_SESSION', 'session', { session: sessionNow })]
  const errors: RuleViolation[] = []
  if (amend.to.price !== amend.from.price && amend.to.price !== null) errors.push(...checkPrice(amend.to.price, rules, symbolInfo))
  if (amend.to.qty !== amend.from.qty) {
    const qtyErrors = checkQty(amend.to.qty, lot, rules)
    errors.push(...qtyErrors)
    if (qtyErrors.length === 0 && amend.to.qty > amend.from.qty) {
      errors.push(...checkForeignRoom(side, amend.to.qty - amend.from.qty, symbolInfo, account))
    }
  }
  return errors
}

export function validateCancel(rules: RulePack, sessionNow: SessionCode, symbolInfo?: SymbolInfo): RuleViolation[] {
  if (sessionNow === 'PERIODIC_LOCK' && symbolInfo) return [restrictedLock(symbolInfo, rules)]
  return isCancelAllowed(rules, sessionNow) ? [] : [violation('CANCEL_LOCKED_SESSION', 'session', { session: sessionNow })]
}

export const blocking = (violations: RuleViolation[]) => violations.filter((item) => item.severity === 'error')
