import type { RulePack } from '../types'

/**
 * UPCoM. Giá tham chiếu là bình quân gia quyền của phiên trước, không phải giá đóng cửa.
 * Lịch phiên dưới KRX chưa kiểm chứng từ nguồn gốc → verified=false.
 */
export const UPX_KRX_2025: RulePack = {
  id: 'upx-krx-2025',
  board: 'UPX',
  effectiveFrom: '2025-05-05',
  title: 'UPCoM',
  sessions: [
    { code: 'CONTINUOUS', start: '09:00', end: '11:30' },
    { code: 'LUNCH', start: '11:30', end: '13:00' },
    { code: 'CONTINUOUS', start: '13:00', end: '15:00' },
  ],
  orderTypesBySession: {
    CONTINUOUS: { round: ['LO'], odd: ['LO'] },
  },
  priceBand: { normal: 15, firstDay: 40 },
  tickTable: {
    STOCK: [{ below: null, tick: 100 }],
    CLOSED_FUND: [{ below: null, tick: 100 }],
    ETF: [{ below: null, tick: 100 }],
    CW: [{ below: null, tick: 100 }],
  },
  minPrice: 100,
  lots: { round: 100, odd: { min: 1, max: 99 } },
  maxQty: { round: 500_000, odd: 99 },
  amendPolicy: { oneFieldPerAmend: true, lockedSessions: ['REOPEN'], losesPriority: ['PRICE', 'QTY_UP'] },
  cancelPolicy: { lockedSessions: ['REOPEN'] },
  expiryTime: '15:00',
  mtlRemainder: 'CANCEL',
  auctionPriorityOverLimit: false,
  referencePrice: 'VWAP_PREV',
  flags: {},
  haltResume: { reopenAuctionMinutes: 15, orderTypes: { round: ['LO'], odd: ['LO'] } },
  verified: false,
  sourceNote: 'Quy chế giao dịch UPCoM của HNX (công bố công khai).',
}
