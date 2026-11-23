import type { RulePack } from '../types'

/**
 * Cổ phiếu niêm yết HNX. Hết hiệu lực sau phiên 23/12/2026: cổ phiếu niêm yết HNX nghỉ 24–25/12 và
 * giao dịch trên HOSE từ 28/12/2026 (Thông tư 139/2025/TT-BTC).
 * Lịch phiên dưới KRX chưa kiểm chứng từ nguồn gốc, nên cả pack để verified=false.
 */
export const STX_KRX_2025: RulePack = {
  id: 'stx-krx-2025',
  board: 'STX',
  effectiveFrom: '2025-05-05',
  effectiveTo: '2026-12-23',
  title: 'HNX – cổ phiếu niêm yết',
  sessions: [
    { code: 'CONTINUOUS', start: '09:00', end: '11:30' },
    { code: 'LUNCH', start: '11:30', end: '13:00' },
    { code: 'CONTINUOUS', start: '13:00', end: '14:30' },
    { code: 'ATC', start: '14:30', end: '14:45' },
    { code: 'PUT_THROUGH', start: '14:45', end: '15:00' },
  ],
  orderTypesBySession: {
    CONTINUOUS: { round: ['LO', 'MTL', 'MOK', 'MAK'], odd: ['LO'] },
    ATC: { round: ['LO', 'ATC'], odd: ['LO'] },
  },
  priceBand: { normal: 10, firstDay: 30 },
  tickTable: {
    STOCK: [{ below: null, tick: 100 }],
    CLOSED_FUND: [{ below: null, tick: 100 }],
    ETF: [{ below: null, tick: 1 }],
    CW: [{ below: null, tick: 10 }],
  },
  minPrice: 100,
  lots: { round: 100, odd: { min: 1, max: 99 } },
  maxQty: { round: 500_000, odd: 99 },
  amendPolicy: { oneFieldPerAmend: true, lockedSessions: ['ATC', 'REOPEN'], losesPriority: ['PRICE', 'QTY_UP'] },
  cancelPolicy: { lockedSessions: ['ATC', 'REOPEN'] },
  expiryTime: '14:45',
  mtlRemainder: 'LO_LAST_PLUS_TICK',
  auctionPriorityOverLimit: false,
  referencePrice: 'CLOSE',
  flags: {
    MOK_MAK: { enabled: true, verified: false, label: 'Chưa kiểm chứng', note: 'HNX có MOK/MAK; chưa kiểm chứng dưới KRX.' },
  },
  verified: false,
  sourceNote: 'Quy chế giao dịch của HNX (công bố công khai); Thông tư 139/2025/TT-BTC về chuyển cổ phiếu niêm yết sang HOSE.',
  putThrough: { window: { start: '14:45', end: '15:00' } },
  haltResume: { reopenAuctionMinutes: 15, orderTypes: { round: ['LO'], odd: ['LO'] } },
}
