import { describe, expect, it } from 'vitest'
import { formatNumber } from '@/lib/format'
import type { SymbolQuote } from '@/types'
import {
  getCeilingPrice,
  getDisplayPrice,
  getFloorPrice,
  getSessionAt,
  getTickSize,
  isAuctionSession,
  isModifyCancelAllowed,
  isMtlAllowed,
  isValidTick,
  parseTimeToSeconds,
  validatePrice,
  validateQuantity,
} from './hose'

const at = (hour: number, minute: number, second = 0) => hour * 3600 + minute * 60 + second

describe('bước giá', () => {
  it.each([
    [10, 10],
    [9_990, 10],
    [10_000, 50],
    [49_950, 50],
    [50_000, 100],
    [120_000, 100],
  ])('giá %i có bước %i', (price, tick) => {
    expect(getTickSize(price)).toBe(tick)
  })

  it.each([
    [9_990, true],
    [9_995, false],
    [10_050, true],
    [10_010, false],
    [49_950, true],
    [50_050, false],
    [50_100, true],
    [0, false],
    [25_000.5, false],
  ])('isValidTick(%d) = %s', (price, expected) => {
    expect(isValidTick(price)).toBe(expected)
  })
})

describe('giá trần, giá sàn', () => {
  it('tính đúng khi không cần làm tròn', () => {
    expect(getCeilingPrice(100_000)).toBe(107_000)
    expect(getFloorPrice(100_000)).toBe(93_000)
  })

  it('trần làm tròn xuống, sàn làm tròn lên theo bước giá', () => {
    // 24.350 x 1,07 = 26.054,5 → 26.050. 24.350 x 0,93 = 22.645,5 → 22.650.
    expect(getCeilingPrice(24_350)).toBe(26_050)
    expect(getFloorPrice(24_350)).toBe(22_650)
  })

  it('bước giá lấy theo mức giá sau khi tính biên độ', () => {
    // 47.000 x 1,07 = 50.290 → vùng bước 100 → 50.200.
    expect(getCeilingPrice(47_000)).toBe(50_200)
    // 10.500 x 0,93 = 9.765 → vùng bước 10 → 9.770.
    expect(getFloorPrice(10_500)).toBe(9_770)
  })

  it('trần và sàn luôn đúng bước giá, không vượt biên độ', () => {
    for (let ref = 5_000; ref <= 150_000; ref += 50) {
      const ceiling = getCeilingPrice(ref)
      const floor = getFloorPrice(ref)
      expect(isValidTick(ceiling)).toBe(true)
      expect(isValidTick(floor)).toBe(true)
      expect(ceiling * 100).toBeLessThanOrEqual(ref * 107)
      expect(floor * 100).toBeGreaterThanOrEqual(ref * 93)
    }
  })
})

describe('phiên giao dịch', () => {
  it.each([
    [at(8, 59, 59), 'PRE_OPEN'],
    [at(9, 0), 'ATO'],
    [at(9, 14, 59), 'ATO'],
    [at(9, 15), 'CONTINUOUS'],
    [at(11, 29, 59), 'CONTINUOUS'],
    [at(11, 30), 'LUNCH'],
    [at(12, 59, 59), 'LUNCH'],
    [at(13, 0), 'CONTINUOUS'],
    [at(14, 29, 59), 'CONTINUOUS'],
    [at(14, 30), 'ATC'],
    [at(14, 44, 59), 'ATC'],
    [at(14, 45), 'CLOSED'],
  ])('giây %i thuộc phiên %s', (seconds, session) => {
    expect(getSessionAt(seconds)).toBe(session)
  })

  it('chỉ ATO và ATC là phiên khớp định kỳ', () => {
    expect(isAuctionSession('ATO')).toBe(true)
    expect(isAuctionSession('ATC')).toBe(true)
    for (const session of ['PRE_OPEN', 'CONTINUOUS', 'LUNCH', 'CLOSED'] as const) {
      expect(isAuctionSession(session)).toBe(false)
    }
  })

  it('giá hiển thị ưu tiên giá dự kiến', () => {
    const quote = { last_price: 100_000, indicative_price: null } as SymbolQuote
    expect(getDisplayPrice(quote)).toBe(100_000)
    expect(getDisplayPrice({ ...quote, indicative_price: 100_500 })).toBe(100_500)
  })

  it('MTL chỉ được dùng trong phiên liên tục', () => {
    expect(isMtlAllowed('CONTINUOUS')).toBe(true)
    for (const session of ['PRE_OPEN', 'ATO', 'LUNCH', 'ATC', 'CLOSED'] as const) {
      expect(isMtlAllowed(session)).toBe(false)
    }
  })

  it('không được sửa, hủy trong ATO và ATC', () => {
    expect(isModifyCancelAllowed('ATO')).toBe(false)
    expect(isModifyCancelAllowed('ATC')).toBe(false)
    expect(isModifyCancelAllowed('CONTINUOUS')).toBe(true)
    expect(isModifyCancelAllowed('LUNCH')).toBe(true)
  })
})

describe('validatePrice', () => {
  // Tham chiếu 100.000: trần 107.000, sàn 93.000, bước 100.
  it('chấp nhận giá hợp lệ, gồm cả đúng trần và đúng sàn', () => {
    expect(validatePrice(100_000, 100_000)).toBeNull()
    expect(validatePrice(107_000, 100_000)).toBeNull()
    expect(validatePrice(93_000, 100_000)).toBeNull()
  })

  it('từ chối giá vượt trần hoặc dưới sàn', () => {
    expect(validatePrice(107_100, 100_000)).toContain('trần 107.000')
    expect(validatePrice(92_900, 100_000)).toContain('sàn 93.000')
  })

  it('từ chối giá sai bước', () => {
    expect(validatePrice(100_050, 100_000)).toContain('bước 100đ')
  })

  it('từ chối giá không nguyên hoặc không dương', () => {
    expect(validatePrice(100_000.5, 100_000)).toContain('số nguyên')
    expect(validatePrice(0, 100_000)).toContain('số nguyên')
    expect(validatePrice(-100, 100_000)).toContain('số nguyên')
  })
})

describe('validateQuantity', () => {
  it('chấp nhận bội số 100 đến tối đa 500.000', () => {
    expect(validateQuantity(100)).toBeNull()
    expect(validateQuantity(500_000)).toBeNull()
  })

  it('từ chối khối lượng sai', () => {
    expect(validateQuantity(150)).toContain('bội số')
    expect(validateQuantity(500_100)).toContain('tối đa 500.000')
    expect(validateQuantity(0)).not.toBeNull()
    expect(validateQuantity(-100)).not.toBeNull()
    expect(validateQuantity(100.5)).not.toBeNull()
  })
})

describe('tiện ích', () => {
  it('định dạng số kiểu Việt Nam', () => {
    expect(formatNumber(1_000_000)).toBe('1.000.000')
  })

  it('đọc giờ HH:mm', () => {
    expect(parseTimeToSeconds('09:15')).toBe(at(9, 15))
    expect(parseTimeToSeconds('25:00')).toBeNull()
    expect(parseTimeToSeconds('')).toBeNull()
  })
})
