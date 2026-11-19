import { describe, expect, it } from 'vitest'
import { ruleMessage } from '@/explain/reasons'
import type { SessionCode } from '@/types'
import { getTickSize, priceLimits, roundToTick } from './price'
import { rulesFor } from './registry'
import { allowedOrderTypes } from './session'
import type { Board, LotKind, OrderType, RuleCode, RulePack, SecType, SymbolInfo } from './types'
import { blocking, checkPrice, classifyAmend, validateAmend, validateCancel, validateOrder } from './validate'

// Ma trận bảng × phiên × loại lệnh × loại lô × loại chứng khoán. Mỗi ô được phép có ít nhất 1 ca hợp lệ và
// 1 ca không hợp lệ; ô bị cấm có ca bị từ chối đúng mã lỗi.

const DATE = '2026-11-16'
const BOARDS: Board[] = ['STO', 'STX', 'UPX']
const SESSIONS: SessionCode[] = ['PRE_OPEN', 'ATO', 'CONTINUOUS', 'LUNCH', 'ATC', 'PUT_THROUGH', 'CLOSED']
const ORDER_TYPES: OrderType[] = ['LO', 'MTL', 'ATO', 'ATC', 'MOK', 'MAK']
const LOTS: LotKind[] = ['ROUND', 'ODD']
const SEC_TYPES: SecType[] = ['STOCK', 'CLOSED_FUND', 'ETF', 'CW']
const DOMESTIC = { isForeign: false }

function symbolOf(rules: RulePack, secType: SecType): SymbolInfo {
  const ref = roundToTick(25_050, 'down', secType, rules)
  const limits = priceLimits(ref, secType, rules)
  return { symbol: 'TEST', secType, ref, ceiling: limits.ceiling, floor: limits.floor, halted: false }
}

/** Ô được phép theo pack: loại lệnh có trong phiên, lô lẻ chỉ LO, MOK/MAK theo cờ. */
function isAllowed(rules: RulePack, session: SessionCode, type: OrderType, lot: LotKind) {
  return allowedOrderTypes(rules, session, lot).includes(type) && (lot === 'ROUND' || type === 'LO')
}

const FORBIDDEN_CODES: RuleCode[] = ['BOARD_CLOSED', 'ORDER_TYPE_NOT_IN_SESSION', 'MTL_CONTINUOUS_ONLY', 'ODD_LOT_LO_ONLY', 'ORDER_TYPE_DISABLED']

const CELLS = BOARDS.flatMap((board) =>
  SESSIONS.flatMap((session) =>
    ORDER_TYPES.flatMap((type) => LOTS.flatMap((lot) => SEC_TYPES.map((secType) => [board, session, type, lot, secType] as const))),
  ),
)

describe('validateOrder: ma trận bảng × phiên × loại lệnh × lô × loại chứng khoán', () => {
  it('phủ đủ 3 × 7 × 6 × 2 × 4 ô, có cả ô được phép và ô bị cấm ở mỗi bảng', () => {
    expect(CELLS).toHaveLength(3 * 7 * 6 * 2 * 4)
    for (const board of BOARDS) {
      const rules = rulesFor(board, DATE)
      const allowed = CELLS.filter((cell) => cell[0] === board && isAllowed(rules, cell[1], cell[2], cell[3]))
      expect(allowed.length).toBeGreaterThan(0)
      expect(allowed.length).toBeLessThan(CELLS.length / 3)
    }
  })

  it.each(CELLS)('%s · %s · %s · %s · %s', (board, session, type, lot, secType) => {
    const rules = rulesFor(board, DATE)
    const symbol = symbolOf(rules, secType)
    const price = type === 'LO' ? symbol.ref : null
    const qty = lot === 'ROUND' ? 1_000 : 50
    const run = (input: Partial<Parameters<typeof validateOrder>[0]>) =>
      validateOrder({ side: 'BUY', orderType: type, price, qty, lot, immediate: true, ...input }, rules, session, symbol, DOMESTIC)

    if (isAllowed(rules, session, type, lot)) {
      // Ca hợp lệ: không có lỗi.
      expect(run({})).toEqual([])
      // Ca không hợp lệ: sai lô (lô chẵn không bội số 100; lô lẻ ngoài 1–99).
      const badLot = run({ qty: 150 })
      expect(badLot.map((item) => item.code)).toEqual([lot === 'ROUND' ? 'LOT_ROUND_MULTIPLE' : 'LOT_ODD_RANGE'])
      // Ca không hợp lệ: LO sai bước giá (khi bước giá > 1 đ) hoặc lệnh thị trường có giá.
      const tick = getTickSize(symbol.ref, secType, rules)
      if (type === 'LO' && tick > 1) expect(run({ price: symbol.ref + 1 }).map((item) => item.code)).toEqual(['PRICE_TICK'])
      if (type !== 'LO') expect(run({ price: symbol.ref }).map((item) => item.code)).toEqual(['PRICE_NOT_ALLOWED'])
    } else {
      // Ô bị cấm: bị từ chối đúng nhóm mã lỗi phiên/loại lệnh/lô, câu tiếng Việt có nội dung.
      const errors = blocking(run({}))
      expect(errors.length).toBeGreaterThan(0)
      expect(FORBIDDEN_CODES).toContain(errors[0].code)
      expect(ruleMessage(errors[0]).length).toBeGreaterThan(10)
      // Lệnh thuật toán (không gửi ngay): luật phiên chỉ là cảnh báo; lô lẻ, MOK/MAK tắt vẫn là lỗi.
      const algo = validateOrder({ side: 'BUY', orderType: type, price, qty, lot, immediate: false }, rules, session, symbol, DOMESTIC)
      const sessionOnly = ['BOARD_CLOSED', 'ORDER_TYPE_NOT_IN_SESSION', 'MTL_CONTINUOUS_ONLY'].includes(errors[0].code)
      expect(blocking(algo).length === 0).toBe(sessionOnly)
    }
  })
})

describe('validateOrder: các luật khác', () => {
  const STO = rulesFor('STO', DATE)
  const FPT: SymbolInfo = { symbol: 'FPT', secType: 'STOCK', ref: 128_500, ceiling: 137_400, floor: 119_600, halted: false, foreignRoom: 5_000 }
  const order = (input: Partial<Parameters<typeof validateOrder>[0]> = {}) => ({
    side: 'BUY' as const,
    orderType: 'LO' as const,
    price: 128_500,
    qty: 1_000,
    lot: 'ROUND' as const,
    immediate: true,
    ...input,
  })

  it('trần, sàn: câu báo lỗi có số cụ thể', () => {
    const [ceiling] = validateOrder(order({ price: 137_500 }), STO, 'CONTINUOUS', FPT, DOMESTIC)
    expect(ruleMessage(ceiling)).toBe('Giá không được vượt giá trần 137.400 (tham chiếu 128.500, biên ±7%).')
    const [floor] = validateOrder(order({ price: 119_500 }), STO, 'CONTINUOUS', FPT, DOMESTIC)
    expect(ruleMessage(floor)).toContain('thấp hơn giá sàn 119.600')
  })

  it('KL tối đa 500.000 CP/lệnh lô chẵn', () => {
    expect(validateOrder(order({ qty: 500_000 }), STO, 'CONTINUOUS', { ...FPT, foreignRoom: undefined }, DOMESTIC)).toEqual([])
    expect(validateOrder(order({ qty: 500_100 }), STO, 'CONTINUOUS', FPT, DOMESTIC).map((item) => item.code)).toEqual(['MAX_QTY'])
  })

  it('room ngoại: chỉ chặn lệnh MUA của nhà đầu tư nước ngoài vượt room còn lại', () => {
    const foreign = { isForeign: true }
    const [room] = validateOrder(order({ qty: 6_000 }), STO, 'CONTINUOUS', FPT, foreign)
    expect(room.code).toBe('FOREIGN_ROOM_EXCEEDED')
    expect(ruleMessage(room)).toContain('chỉ còn 5.000 CP, không mua được 6.000 CP')
    expect(validateOrder(order({ qty: 5_000 }), STO, 'CONTINUOUS', FPT, foreign)).toEqual([])
    expect(validateOrder(order({ qty: 6_000, side: 'SELL' }), STO, 'CONTINUOUS', FPT, foreign)).toEqual([])
    expect(validateOrder(order({ qty: 6_000 }), STO, 'CONTINUOUS', FPT, DOMESTIC)).toEqual([])
  })

  it('mã ngừng giao dịch (chuyển sàn) bị từ chối trước mọi luật khác', () => {
    const [halt] = validateOrder(order(), STO, 'CONTINUOUS', { ...FPT, symbol: 'XHA', halted: true }, DOMESTIC)
    expect(halt.code).toBe('SYMBOL_TRANSFER_HALT')
    expect(ruleMessage(halt)).toContain('28/12/2026')
  })

  it('chứng quyền: sàn hiển thị 0 nhưng giá đặt phải từ 10 đ', () => {
    const cw: SymbolInfo = { symbol: 'CW', secType: 'CW', ref: 300, ceiling: 1_120, floor: 0, halted: false }
    expect(checkPrice(10, STO, cw)).toEqual([])
    expect(checkPrice(5, STO, cw).map((item) => item.code)).toEqual(['PRICE_BELOW_MIN'])
  })

  it('sửa lệnh: mỗi lần chỉ giá HOẶC KL; khóa trong ATO/ATC; tăng KL kiểm room', () => {
    const from = { price: 128_500, qty: 1_000 }
    expect(classifyAmend(from, { price: 128_600, qty: 1_000 })).toBe('PRICE')
    expect(classifyAmend(from, { price: 128_500, qty: 1_500 })).toBe('QTY_UP')
    expect(classifyAmend(from, { price: 128_500, qty: 500 })).toBe('QTY_DOWN')
    expect(classifyAmend(from, { price: 128_600, qty: 500 })).toBe('BOTH')
    const amend = (to: typeof from, session: SessionCode = 'CONTINUOUS', foreign = false) =>
      validateAmend({ from, to }, 'BUY', 'ROUND', STO, session, FPT, { isForeign: foreign }).map((item) => item.code)
    expect(amend({ price: 128_600, qty: 500 })).toEqual(['AMEND_ONE_FIELD'])
    expect(amend(from)).toEqual(['AMEND_NO_CHANGE'])
    expect(amend({ price: 128_600, qty: 1_000 }, 'ATC')).toEqual(['AMEND_LOCKED_SESSION'])
    expect(amend({ price: 128_550, qty: 1_000 })).toEqual(['PRICE_TICK'])
    expect(amend({ price: 128_500, qty: 7_000 }, 'CONTINUOUS', true)).toEqual(['FOREIGN_ROOM_EXCEEDED'])
    expect(amend({ price: 128_500, qty: 5_500 }, 'CONTINUOUS', true)).toEqual([])
    expect(validateCancel(STO, 'ATO').map((item) => item.code)).toEqual(['CANCEL_LOCKED_SESSION'])
    expect(validateCancel(STO, 'CONTINUOUS')).toEqual([])
  })
})
