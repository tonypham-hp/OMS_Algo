import { describe, expect, it } from 'vitest'
import { ruleMessage } from '@/explain/reasons'
import { rulesFor } from './registry'
import { parseTimeToSeconds, restrictedPhaseAt } from './session'
import type { SymbolInfo } from './types'
import { blocking, validateAmend, validateCancel, validateOrder } from './validate'

const at = (time: string) => parseTimeToSeconds(time) as number
const STO = rulesFor('STO', '2026-11-16')
const XRS: SymbolInfo = { symbol: 'XRS', secType: 'STOCK', ref: 14_250, ceiling: 15_200, floor: 13_300, halted: false, restricted: true }
const order = (input: Partial<Parameters<typeof validateOrder>[0]> = {}) => ({
  side: 'BUY' as const,
  orderType: 'LO' as const,
  price: 14_250,
  qty: 1_000,
  lot: 'ROUND' as const,
  immediate: true,
  ...input,
})

describe('mã hạn chế giao dịch: lượt khớp định kỳ 15 phút', () => {
  it('lượt kết thúc đúng mốc 15 phút: sáng 09:30 … 11:30 (9 lượt), chiều 13:15 … 14:30 (6 lượt)', () => {
    const ends = new Set<number>()
    for (let seconds = at('09:15'); seconds < at('14:30'); seconds += 30) {
      const phase = restrictedPhaseAt(seconds, STO)
      if (phase.callEnd !== null && phase.session.startsWith('PERIODIC')) ends.add(phase.callEnd)
    }
    const expected = ['09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30']
    expect([...ends].sort((a, b) => a - b)).toEqual(expected.map(at))
  })

  it('khóa sửa, hủy đúng 5 phút cuối mỗi lượt', () => {
    expect(restrictedPhaseAt(at('09:24') + 59, STO)).toMatchObject({ session: 'PERIODIC', callEnd: at('09:30') })
    expect(restrictedPhaseAt(at('09:25'), STO)).toMatchObject({ session: 'PERIODIC_LOCK', callEnd: at('09:30') })
    expect(restrictedPhaseAt(at('09:29') + 59, STO).session).toBe('PERIODIC_LOCK')
    expect(restrictedPhaseAt(at('09:30'), STO)).toMatchObject({ session: 'PERIODIC', callEnd: at('09:45') })
    expect(restrictedPhaseAt(at('14:25'), STO)).toMatchObject({ session: 'PERIODIC_LOCK', callEnd: at('14:30') })
  })

  it('ATO, ATC giữ nguyên; nghỉ trưa không có lượt', () => {
    expect(restrictedPhaseAt(at('09:05'), STO)).toMatchObject({ session: 'ATO', callEnd: at('09:15') })
    expect(restrictedPhaseAt(at('14:35'), STO)).toMatchObject({ session: 'ATC', callEnd: at('14:45') })
    expect(restrictedPhaseAt(at('12:00'), STO)).toMatchObject({ session: 'LUNCH', callEnd: null, callId: null })
  })

  it('trong lượt chỉ nhận LO lô chẵn; lô lẻ, MTL bị chặn với mã lý do riêng', () => {
    expect(validateOrder(order(), STO, 'PERIODIC', XRS, { isForeign: false })).toEqual([])
    expect(validateOrder(order(), STO, 'PERIODIC_LOCK', XRS, { isForeign: false })).toEqual([])
    const [odd] = validateOrder(order({ qty: 50, lot: 'ODD' }), STO, 'PERIODIC', XRS, { isForeign: false })
    expect(odd.code).toBe('RESTRICTED_ROUND_LOT_ONLY')
    const [mtl] = validateOrder(order({ orderType: 'MTL', price: null }), STO, 'PERIODIC', XRS, { isForeign: false })
    expect(mtl.code).toBe('RESTRICTED_NO_MTL')
    // Lệnh thuật toán sẽ sinh MTL cũng bị chặn (không chỉ cảnh báo).
    expect(blocking(validateOrder(order({ orderType: 'MTL', price: null, immediate: false }), STO, 'PERIODIC', XRS, { isForeign: false }))).toHaveLength(1)
    // ATO, ATC của mã hạn chế: LO và ATO/ATC.
    expect(validateOrder(order({ orderType: 'ATC', price: null }), STO, 'ATC', XRS, { isForeign: false })).toEqual([])
    expect(validateOrder(order({ orderType: 'ATC', price: null }), STO, 'PERIODIC', XRS, { isForeign: false }).map((item) => item.code)).toEqual([
      'ORDER_TYPE_NOT_IN_SESSION',
    ])
  })

  it('sửa, hủy trong 5 phút cuối lượt bị chặn, câu lý do nêu giờ khớp', () => {
    const locked = { ...XRS, callEnd: at('09:45') }
    const [amend] = validateAmend({ from: { price: 14_250, qty: 1_000 }, to: { price: 14_300, qty: 1_000 } }, 'BUY', 'ROUND', STO, 'PERIODIC_LOCK', locked, { isForeign: false })
    expect(amend.code).toBe('RESTRICTED_LOCKED')
    expect(ruleMessage(amend)).toBe('Mã XRS bị hạn chế giao dịch: khóa sửa, hủy 5 phút cuối lượt, lượt này khớp lúc 09:45.')
    expect(validateCancel(STO, 'PERIODIC_LOCK', locked).map((item) => item.code)).toEqual(['RESTRICTED_LOCKED'])
    expect(validateCancel(STO, 'PERIODIC', locked)).toEqual([])
  })
})
