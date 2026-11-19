import { describe, expect, it } from 'vitest'
import { createLcg } from '@/demo/env'
import { checkPrice } from './validate'
import { getTickSize, isValidTick, mtlRemainderPrice, priceLimits, roundToTick, stepPrice } from './price'
import { rulesFor } from './registry'
import type { Board, SecType } from './types'

const DATE = '2026-11-16'
const STO = rulesFor('STO', DATE)

describe('ví dụ tính tay (KRX)', () => {
  it('HOSE tham chiếu 128.500 → trần 137.400, sàn 119.600', () => {
    expect(priceLimits(128_500, 'STOCK', STO)).toMatchObject({ ceiling: 137_400, floor: 119_600, bandPct: 7 })
  })

  it('ETF giá 21.350 hợp lệ (bước 10 đ mọi mức giá)', () => {
    expect(getTickSize(21_350, 'ETF', STO)).toBe(10)
    expect(isValidTick(21_350, 'ETF', STO)).toBe(true)
    const limits = priceLimits(21_350, 'ETF', STO)
    expect(checkPrice(21_350, STO, { symbol: 'XETF30', secType: 'ETF', ref: 21_350, ceiling: limits.ceiling, floor: limits.floor, halted: false })).toEqual([])
    // Giá 21.370: ETF hợp lệ (bước 10 đ), cổ phiếu thì sai bước (vùng 10.000–50.000 bước 50 đ).
    expect(isValidTick(21_370, 'ETF', STO)).toBe(true)
    expect(isValidTick(21_370, 'STOCK', STO)).toBe(false)
  })

  it('MTL mua phần còn lại, giá khớp gần nhất 27.650 → LO 27.700; bán → 27.600', () => {
    expect(mtlRemainderPrice(27_650, 'BUY', 'STOCK', STO)).toBe(27_700)
    expect(mtlRemainderPrice(27_650, 'SELL', 'STOCK', STO)).toBe(27_600)
    // Kẹp trong trần – sàn.
    expect(mtlRemainderPrice(27_650, 'BUY', 'STOCK', STO, { ceiling: 27_650, floor: 25_000 })).toBe(27_650)
  })

  it('bước giá đi qua ngưỡng 10.000 và 50.000 theo đúng vùng', () => {
    expect(stepPrice(49_950, 1, 'STOCK', STO)).toBe(50_000)
    expect(stepPrice(50_000, -1, 'STOCK', STO)).toBe(49_950)
    expect(stepPrice(9_990, 1, 'STOCK', STO)).toBe(10_000)
    expect(stepPrice(10_000, -1, 'STOCK', STO)).toBe(9_990)
  })

  it('HNX ±10% bước 100 đ; UPCoM ±15%; ngày đầu ±20/30/40%', () => {
    const stx = rulesFor('STX', DATE)
    const upx = rulesFor('UPX', DATE)
    expect(priceLimits(32_400, 'STOCK', stx)).toMatchObject({ ceiling: 35_600, floor: 29_200 })
    expect(priceLimits(12_300, 'STOCK', upx)).toMatchObject({ ceiling: 14_100, floor: 10_500 })
    expect(priceLimits(10_000, 'STOCK', STO, { firstDay: true }).bandPct).toBe(20)
    expect(priceLimits(10_000, 'STOCK', stx, { firstDay: true }).bandPct).toBe(30)
    expect(priceLimits(10_000, 'STOCK', upx, { firstDay: true }).bandPct).toBe(40)
  })

  it('chứng quyền: trần/sàn theo mã cơ sở chia tỷ lệ; sàn âm hiển thị 0, giá đặt tối thiểu 10 đ', () => {
    const fpt = priceLimits(118_000, 'STOCK', STO)
    const cw = { ratio: 10, underlyingRef: 118_000, underlyingCeiling: fpt.ceiling, underlyingFloor: fpt.floor }
    expect(priceLimits(1_230, 'CW', STO, { cw })).toMatchObject({ ceiling: 2_050, floor: 410 })
    expect(priceLimits(500, 'CW', STO, { cw })).toMatchObject({ floor: 0, minOrderPrice: 10 })
  })
})

describe('thuộc tính: với mọi giá tham chiếu và loại chứng khoán, trần/sàn đúng bước giá và nằm trong biên', () => {
  const random = createLcg(20_261_119)
  const cases: Array<[Board, SecType]> = [
    ['STO', 'STOCK'],
    ['STO', 'CLOSED_FUND'],
    ['STO', 'ETF'],
    ['STO', 'CW'],
    ['STX', 'STOCK'],
    ['STX', 'ETF'],
    ['UPX', 'STOCK'],
  ]

  it.each(cases)('%s · %s: 2.000 giá tham chiếu ngẫu nhiên', (board, secType) => {
    const rules = rulesFor(board, DATE)
    for (let index = 0; index < 2_000; index += 1) {
      const ref = roundToTick(1_000 + Math.floor(random() * 199_000), 'down', secType, rules)
      for (const firstDay of [false, true]) {
        const { ceiling, floor, bandPct } = priceLimits(ref, secType, rules, { firstDay })
        const high = ref * (100 + bandPct)
        const low = ref * (100 - bandPct)
        const where = `${board} ${secType} ref ${ref} ±${bandPct}%`
        // Đúng bước giá.
        expect(isValidTick(ceiling, secType, rules), where).toBe(true)
        expect(isValidTick(floor, secType, rules), where).toBe(true)
        // Trong biên (so bằng số nguyên để không lệch số thực).
        expect(ceiling * 100 <= high, where).toBe(true)
        expect(floor * 100 >= low, where).toBe(true)
        // Sát biên: thêm một bước nữa là vượt.
        expect(stepPrice(ceiling, 1, secType, rules) * 100 > high, where).toBe(true)
        expect(stepPrice(floor, -1, secType, rules) * 100 < low, where).toBe(true)
        expect(floor).toBeLessThanOrEqual(ref)
        expect(ceiling).toBeGreaterThanOrEqual(ref)
      }
    }
  })
})
