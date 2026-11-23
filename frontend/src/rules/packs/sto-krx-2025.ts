import type { RulePack } from '../types'

/**
 * Cổ phiếu, chứng chỉ quỹ, ETF, chứng quyền trên HOSE từ khi chạy hệ thống KRX (5/5/2025).
 * Điểm chưa rõ để thành cờ, có nhãn trên giao diện thay vì đoán.
 */
export const STO_KRX_2025: RulePack = {
  id: 'sto-krx-2025',
  board: 'STO',
  effectiveFrom: '2025-05-05',
  title: 'HOSE (KRX) – cổ phiếu, CCQ, ETF, chứng quyền',
  sessions: [
    { code: 'ATO', start: '09:00', end: '09:15' },
    { code: 'CONTINUOUS', start: '09:15', end: '11:30' },
    { code: 'LUNCH', start: '11:30', end: '13:00' },
    { code: 'CONTINUOUS', start: '13:00', end: '14:30' },
    { code: 'ATC', start: '14:30', end: '14:45' },
    { code: 'PUT_THROUGH', start: '14:45', end: '15:00' },
  ],
  orderTypesBySession: {
    ATO: { round: ['LO', 'ATO'], odd: ['LO'] },
    CONTINUOUS: { round: ['LO', 'MTL', 'MOK', 'MAK'], odd: ['LO'] },
    ATC: { round: ['LO', 'ATC'], odd: ['LO'] },
  },
  priceBand: { normal: 7, firstDay: 20 },
  tickTable: {
    STOCK: [
      { below: 10_000, tick: 10 },
      { below: 50_000, tick: 50 },
      { below: null, tick: 100 },
    ],
    CLOSED_FUND: [
      { below: 10_000, tick: 10 },
      { below: 50_000, tick: 50 },
      { below: null, tick: 100 },
    ],
    ETF: [{ below: null, tick: 10 }],
    CW: [{ below: null, tick: 10 }],
  },
  minPrice: 10,
  lots: { round: 100, odd: { min: 1, max: 99 } },
  maxQty: { round: 500_000, odd: 99 },
  amendPolicy: { oneFieldPerAmend: true, lockedSessions: ['ATO', 'ATC', 'PERIODIC_LOCK', 'REOPEN'], losesPriority: ['PRICE', 'QTY_UP'] },
  cancelPolicy: { lockedSessions: ['ATO', 'ATC', 'PERIODIC_LOCK', 'REOPEN'] },
  expiryTime: '14:45',
  mtlRemainder: 'LO_LAST_PLUS_TICK',
  auctionPriorityOverLimit: false,
  referencePrice: 'CLOSE',
  flags: {
    MOK_MAK: {
      enabled: false,
      verified: false,
      label: 'Chưa kiểm chứng',
      note: 'Lệnh MOK/MAK (FOK/FAK) trên HOSE chưa xác nhận được: mặc định tắt.',
    },
    AMEND_CANCEL_IN_AUCTION_LOCK: {
      enabled: true,
      verified: false,
      label: 'Chưa kiểm chứng',
      note: 'Khóa sửa, hủy lệnh trong ATO/ATC: giữ quy tắc đang dùng, chưa kiểm chứng với KRX.',
    },
    TRANSFERRED_SYMBOL_RULES: {
      enabled: true,
      verified: false,
      label: 'Giả định',
      note: 'Mã niêm yết HNX chuyển sang HOSE từ 28/12/2026: giả định dùng biên độ và bước giá của bảng STO.',
    },
  },
  verified: true,
  sourceNote: 'Quy chế giao dịch của HOSE theo hệ thống KRX (công bố công khai, áp dụng từ 05/05/2025).',
  putThrough: {
    window: { start: '14:45', end: '15:00' },
    duringContinuous: true,
    minQty: 20_000,
    tick: 1,
    sessions: ['ATO', 'CONTINUOUS', 'ATC', 'PUT_THROUGH'],
    expiryTime: '15:00',
  },
  haltResume: { reopenAuctionMinutes: 15, orderTypes: { round: ['LO'], odd: ['LO'] } },
  restricted: {
    callIntervalMinutes: 15,
    lockSecondsBeforeCall: 300,
    orderTypes: { ATO: ['LO', 'ATO'], PERIODIC: ['LO'], PERIODIC_LOCK: ['LO'], ATC: ['LO', 'ATC'] },
  },
}
