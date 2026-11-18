import { describe, expect, it } from 'vitest'
import type { OrderEvent } from '@/types'
import {
  buildAuditCsv,
  DEFAULT_AUDIT_FILTERS,
  filterAuditEvents,
  formatAuditActor,
  getAuditActors,
  maskAuditEvents,
  MASKED_ACTOR,
  type AuditFilters,
} from './audit'
import { CSV_BOM } from './csv'

const TODAY = '2026-11-16'
let seq = 0
const event = (overrides: Partial<OrderEvent>): OrderEvent => {
  seq += 1
  return {
    event_id: `E-${seq}`,
    parent_order_id: 'PO-1',
    child_order_id: null,
    action: 'CREATE',
    user_id: 'khachhang',
    channel: 'WEB',
    old_value: null,
    new_value: 'ACTIVE',
    event_time: `${TODAY}T09:15:00`,
    ...overrides,
  }
}

const EVENTS: OrderEvent[] = [
  event({}),
  event({ action: 'PAUSE', user_id: 'dealer', old_value: 'ACTIVE', new_value: 'PAUSED_USER', event_time: `${TODAY}T09:20:00`, reason_code: 'USER_PAUSE' }),
  event({ parent_order_id: 'PO-2', child_order_id: 'PO-2-CH001', action: 'RECOVERY', user_id: 'SYSTEM', channel: 'ENGINE', old_value: 'UNKNOWN', new_value: 'ACKNOWLEDGED', event_time: '2026-11-13T10:00:00', reason_code: 'RECONCILED_KEPT' }),
  event({ parent_order_id: 'PO-2', action: 'RESUME', user_id: 'vanhanh', old_value: 'PAUSED_SYSTEM', new_value: 'ACTIVE', event_time: '2026-11-02T10:00:00', reason: 'Đã kiểm tra' }),
]

const filters = (patch: Partial<AuditFilters>) => ({ ...DEFAULT_AUDIT_FILTERS, ...patch })
const idsOf = (events: OrderEvent[]) => events.map((item) => item.event_id)

describe('Nhật ký kiểm toán', () => {
  it('khách hàng không thấy user_id người khác; dealer, vận hành thấy nguyên', () => {
    const masked = maskAuditEvents(EVENTS, { username: 'khachhang', role: 'CUSTOMER' })
    expect(masked.map((item) => item.user_id)).toEqual(['khachhang', MASKED_ACTOR, 'SYSTEM', MASKED_ACTOR])
    expect(formatAuditActor(MASKED_ACTOR)).toBe('Người dùng khác')
    expect(formatAuditActor('SYSTEM')).toBe('HỆ THỐNG')
    expect(maskAuditEvents(EVENTS, { username: 'dealer', role: 'DEALER' })).toBe(EVENTS)
  })

  it('lọc theo khoảng thời gian, mới nhất trước', () => {
    expect(idsOf(filterAuditEvents(EVENTS, filters({}), TODAY))).toEqual([EVENTS[1], EVENTS[0], EVENTS[2]].map((item) => item.event_id))
    expect(idsOf(filterAuditEvents(EVENTS, filters({ range: { preset: 'TODAY', from: '', to: '' } }), TODAY))).toHaveLength(2)
    expect(idsOf(filterAuditEvents(EVENTS, filters({ range: { preset: 'CUSTOM', from: '2026-11-01', to: '2026-11-05' } }), TODAY))).toEqual([EVENTS[3].event_id])
  })

  it('lọc theo hành động, người thực hiện, mã lệnh (cả lệnh con)', () => {
    expect(idsOf(filterAuditEvents(EVENTS, filters({ action: 'PAUSE' }), TODAY))).toEqual([EVENTS[1].event_id])
    expect(idsOf(filterAuditEvents(EVENTS, filters({ actor: 'SYSTEM' }), TODAY))).toEqual([EVENTS[2].event_id])
    expect(idsOf(filterAuditEvents(EVENTS, filters({ orderId: 'ch001' }), TODAY))).toEqual([EVENTS[2].event_id])
    expect(idsOf(filterAuditEvents(EVENTS, filters({ orderId: 'PO-2', range: { preset: 'CUSTOM', from: '2026-11-01', to: TODAY } }), TODAY))).toHaveLength(2)
  })

  it('tìm không dấu trên nhãn hành động, giá trị, lý do', () => {
    expect(idsOf(filterAuditEvents(EVENTS, filters({ query: 'doi soat' }), TODAY))).toEqual([EVENTS[2].event_id])
    expect(idsOf(filterAuditEvents(EVENTS, filters({ query: 'TAM DUNG' }), TODAY))).toEqual([EVENTS[1].event_id])
    expect(idsOf(filterAuditEvents(EVENTS, filters({ query: 'core co lenh' }), TODAY))).toEqual([EVENTS[2].event_id])
    expect(filterAuditEvents(EVENTS, filters({ query: 'khong co tu nay' }), TODAY)).toEqual([])
  })

  it('người thực hiện để lọc: HỆ THỐNG đứng đầu', () => {
    expect(getAuditActors(EVENTS)[0]).toBe('SYSTEM')
  })

  it('CSV có BOM, mỗi event một dòng, có mã lý do và câu giải thích', () => {
    const csv = buildAuditCsv(EVENTS)
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines).toHaveLength(EVENTS.length + 1)
    expect(lines[0]).toContain('Mã lý do')
    expect(lines[3]).toContain('RECONCILED_KEPT')
  })
})
