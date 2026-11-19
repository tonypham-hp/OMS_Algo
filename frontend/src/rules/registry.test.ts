import { afterEach, describe, expect, it } from 'vitest'
import { isTradingDay, nextTradingDate, sessionDates, tradingDaysAgo } from './calendar'
import { STO_EXPERIMENTAL_NO_LUNCH } from './packs/experimental-no-lunch'
import { STO_KRX_2025 } from './packs/sto-krx-2025'
import { STX_KRX_2025 } from './packs/stx-krx-2025'
import { UPX_KRX_2025 } from './packs/upx-krx-2025'
import { defaultRules, listPacks, resolveRules, setExperimentalPack } from './registry'
import { getSessionAt, parseTimeToSeconds } from './session'
import { symbolBoard, symbolBoardStatus } from './symbols'

const at = (time: string) => parseTimeToSeconds(time) as number

afterEach(() => {
  setExperimentalPack(null)
})

describe('resolveRules: chọn pack theo bảng và ngày hiệu lực', () => {
  it.each([
    ['2026-12-23', STX_KRX_2025.id],
    ['2026-12-24', null],
    ['2026-12-25', null],
    ['2026-12-28', null],
  ])('STX ngày %s → %s', (date, id) => {
    expect(resolveRules('STX', date)?.id ?? null).toBe(id)
  })

  it.each(['2026-12-23', '2026-12-24', '2026-12-25', '2026-12-28'])('STO, UPX ngày %s vẫn có pack', (date) => {
    expect(resolveRules('STO', date)).toBe(STO_KRX_2025)
    expect(resolveRules('UPX', date)).toBe(UPX_KRX_2025)
  })

  it('trước khi chạy KRX (5/5/2025) không có pack nào', () => {
    expect(resolveRules('STO', '2025-05-02')).toBeNull()
  })

  it('pack chừa sẵn trường cho Đợt 8B và chỉ ghi tên nguồn công khai', () => {
    for (const pack of listPacks()) {
      expect(pack.sourceNote.length).toBeGreaterThan(10)
      expect(pack.sourceNote.length).toBeLessThan(200)
    }
    expect(STO_KRX_2025.putThrough?.window).toEqual({ start: '14:45', end: '15:00' })
    expect(STO_KRX_2025.verified).toBe(true)
    expect(STX_KRX_2025.verified).toBe(false)
    expect(UPX_KRX_2025.verified).toBe(false)
    expect(STO_KRX_2025.flags.MOK_MAK).toMatchObject({ enabled: false, verified: false })
  })
})

describe('symbolBoard: mã niêm yết HNX chuyển sang HOSE', () => {
  it.each([
    ['2026-12-23', 'STX', false],
    ['2026-12-24', null, true],
    ['2026-12-25', null, true],
    ['2026-12-28', 'STO', false],
  ] as const)('XHA ngày %s → %s', (date, board, halted) => {
    expect(symbolBoard('XHA', date)).toBe(board)
    expect(symbolBoardStatus('XHA', date)).toMatchObject({ halted, transferred: board === 'STO' })
  })

  it('mã HOSE luôn là STO, mã UPCoM là UPX, kể cả sau 28/12/2026', () => {
    for (const date of ['2026-11-16', '2026-12-24', '2026-12-28']) {
      expect(symbolBoard('FPT', date)).toBe('STO')
      expect(symbolBoard('XETF30', date)).toBe('STO')
      expect(symbolBoard('XUA', date)).toBe('UPX')
    }
  })
})

describe('lịch ngày giao dịch', () => {
  it('bỏ thứ Bảy, Chủ nhật và ngày nghỉ trong cấu hình', () => {
    expect(isTradingDay('2026-12-24')).toBe(true)
    expect(isTradingDay('2026-12-26')).toBe(false)
    expect(isTradingDay('2027-01-01')).toBe(false)
    expect(nextTradingDate('2026-12-25')).toBe('2026-12-28')
    expect(nextTradingDate('2026-12-31')).toBe('2027-01-04')
    expect(tradingDaysAgo('2026-11-16', 1)).toBe('2026-11-13')
    expect(sessionDates('2026-11-16', 3)).toEqual(['2026-11-16', '2026-11-13', '2026-11-12'])
  })
})

describe('pack thử nghiệm "bỏ nghỉ trưa": đổi lịch phiên không cần sửa code', () => {
  it('nạp pack thì 12:00 là phiên liên tục; bỏ pack thì quay về nghỉ trưa', () => {
    expect(getSessionAt(at('12:00'), defaultRules())).toBe('LUNCH')
    setExperimentalPack(STO_EXPERIMENTAL_NO_LUNCH.id)
    expect(resolveRules('STO', '2026-11-16')).toBe(STO_EXPERIMENTAL_NO_LUNCH)
    expect(getSessionAt(at('12:00'), defaultRules())).toBe('CONTINUOUS')
    expect(getSessionAt(at('14:35'), defaultRules())).toBe('ATC')
    // Pack thử nghiệm chỉ đè bảng của nó.
    expect(resolveRules('UPX', '2026-11-16')).toBe(UPX_KRX_2025)
    setExperimentalPack(null)
    expect(getSessionAt(at('12:00'), defaultRules())).toBe('LUNCH')
  })

  it('không nạp được pack không có trong danh sách thử nghiệm', () => {
    expect(() => setExperimentalPack('sto-krx-2025')).toThrow()
  })
})
