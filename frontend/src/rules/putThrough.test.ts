import { describe, expect, it } from 'vitest'
import { ruleMessage } from '@/explain/reasons'
import { validatePutThrough, type PutThroughInput } from './putThrough'
import { rulesFor } from './registry'
import type { SymbolInfo } from './types'

const STO = rulesFor('STO', '2026-11-16')
const STX = rulesFor('STX', '2026-11-16')
const UPX = rulesFor('UPX', '2026-11-16')
const FPT: SymbolInfo = { symbol: 'FPT', secType: 'STOCK', ref: 118_000, ceiling: 126_200, floor: 109_800, halted: false }
const XHA: SymbolInfo = { symbol: 'XHA', secType: 'STOCK', ref: 32_400, ceiling: 35_600, floor: 29_200, halted: false }
const input = (extra: Partial<PutThroughInput> = {}): PutThroughInput => ({
  side: 'BUY',
  qty: 20_000,
  price: 118_123,
  accountNo: '058C123456',
  counterparty: '999C000001',
  ...extra,
})
const codes = (...args: Parameters<typeof validatePutThrough>) => validatePutThrough(...args).map((item) => item.code)

describe('lệnh thỏa thuận: kiểm tra theo gói luật', () => {
  it('HOSE tối thiểu 20.000 CP; HNX, UPCoM tối thiểu 5.000 CP', () => {
    expect(codes(input(), STO, 'PUT_THROUGH', FPT)).toEqual([])
    const [min] = validatePutThrough(input({ qty: 19_900 }), STO, 'PUT_THROUGH', FPT)
    expect(min.code).toBe('PT_MIN_QTY')
    expect(ruleMessage(min)).toBe('Lệnh thỏa thuận trên HOSE tối thiểu 20.000 CP (đang nhập 19.900 CP).')
    expect(codes(input({ qty: 5_000, price: 32_401 }), STX, 'PUT_THROUGH', XHA)).toEqual([])
    expect(codes(input({ qty: 4_999, price: 32_401 }), STX, 'PUT_THROUGH', XHA)).toEqual(['PT_MIN_QTY'])
    expect(codes(input({ qty: 5_000, price: 32_401 }), UPX, 'CONTINUOUS', XHA)).toEqual([])
  })

  it('bước giá 1 đ: giá lẻ đồng hợp lệ, giá không nguyên bị từ chối; giá ngoài trần/sàn bị từ chối', () => {
    expect(codes(input({ price: 118_001 }), STO, 'PUT_THROUGH', FPT)).toEqual([])
    expect(codes(input({ price: 118_000.5 }), STO, 'PUT_THROUGH', FPT)).toEqual(['PT_PRICE_TICK'])
    const [ceiling] = validatePutThrough(input({ price: 126_201 }), STO, 'PUT_THROUGH', FPT)
    expect(ceiling.code).toBe('PRICE_OUT_OF_BAND')
    expect(ruleMessage(ceiling)).toContain('vượt giá trần 126.200')
    expect(codes(input({ price: 109_799 }), STO, 'PUT_THROUGH', FPT)).toEqual(['PRICE_OUT_OF_BAND'])
  })

  it('HOSE nhận thỏa thuận trong giờ giao dịch và 14:45–15:00; không nhận lúc nghỉ trưa, sau 15:00', () => {
    for (const session of ['ATO', 'CONTINUOUS', 'ATC', 'PUT_THROUGH'] as const) {
      expect(codes(input(), STO, session, FPT), session).toEqual([])
    }
    for (const session of ['PRE_OPEN', 'LUNCH', 'CLOSED'] as const) {
      expect(codes(input(), STO, session, FPT), session).toEqual(['PT_SESSION_CLOSED'])
    }
  })

  it('cần tài khoản đối ứng khác tài khoản đặt; mã tạm ngừng hoặc ngừng giao dịch bị từ chối', () => {
    expect(codes(input({ counterparty: ' ' }), STO, 'PUT_THROUGH', FPT)).toEqual(['PT_COUNTERPARTY_REQUIRED'])
    expect(codes(input({ counterparty: '058C123456' }), STO, 'PUT_THROUGH', FPT)).toEqual(['PT_COUNTERPARTY_REQUIRED'])
    expect(codes(input(), STO, 'PUT_THROUGH', { ...FPT, tradingHalted: true })).toEqual(['SYMBOL_TRADING_HALTED'])
    expect(codes(input(), STO, 'PUT_THROUGH', { ...FPT, halted: true })).toEqual(['SYMBOL_TRANSFER_HALT'])
  })
})
