// Tab Nhật ký kiểm toán: hàm thuần che người thực hiện, lọc, tìm không dấu, CSV. Chỉ đọc.
import { REASON_TEXT } from '@/explain/reasonText'
import { EVENT_ACTION_LABELS, formatEventChange } from '@/pages/OrderDetail/eventFormat'
import type { DemoUser, OrderEvent, OrderEventAction } from '@/types'
import { toCsv } from './csv'
import { resolveDateRange, isInRange, defaultDateRange, type DateRangeValue } from './dateRange'
import { ALL } from './execQuality'
import { normalizeVi } from './text'

export const SYSTEM_ACTOR = 'SYSTEM'
/** user_id thay cho người khác khi khách hàng xem nhật ký lệnh của mình. */
export const MASKED_ACTOR = 'KHAC'

const PUBLIC_ACTORS = new Set([SYSTEM_ACTOR, 'seed'])

/**
 * Khách hàng không được thấy user_id của người khác (dealer, vận hành) thao tác trên lệnh của mình:
 * đổi thành MASKED_ACTOR. Dealer và vận hành thấy nguyên.
 */
export function maskAuditEvents(events: OrderEvent[], user: Pick<DemoUser, 'username' | 'role'>): OrderEvent[] {
  if (user.role !== 'CUSTOMER') return events
  return events.map((event) =>
    event.user_id === user.username || PUBLIC_ACTORS.has(event.user_id) ? event : { ...event, user_id: MASKED_ACTOR },
  )
}

export function formatAuditActor(userId: string): string {
  if (userId === SYSTEM_ACTOR) return 'HỆ THỐNG'
  if (userId === MASKED_ACTOR) return 'Người dùng khác'
  if (userId === 'seed') return 'Dữ liệu mẫu'
  return userId
}

/** Kênh: ENGINE là hệ thống tự chạy, WEB là thao tác trên màn hình. */
export function formatAuditChannel(channel: string): string {
  if (channel === 'ENGINE') return 'Hệ thống'
  if (channel === 'WEB') return 'Web'
  return channel
}

export const AUDIT_ACTIONS = Object.keys(EVENT_ACTION_LABELS) as OrderEventAction[]

export interface AuditFilters {
  range: DateRangeValue
  action: typeof ALL | OrderEventAction
  actor: string
  /** Mã lệnh cha hoặc lệnh con, khớp một phần. */
  orderId: string
  /** Tìm không dấu trên mọi cột. */
  query: string
}

export const DEFAULT_AUDIT_FILTERS: AuditFilters = {
  range: defaultDateRange('FIVE_SESSIONS'),
  action: ALL,
  actor: ALL,
  orderId: '',
  query: '',
}

export function formatReason(event: Pick<OrderEvent, 'reason_code'>): string | null {
  return event.reason_code ? `${event.reason_code}: ${REASON_TEXT[event.reason_code]}` : null
}

/** Chuỗi để tìm: mọi thứ người xem thấy trên dòng, đã bỏ dấu. */
function searchText(event: OrderEvent): string {
  return normalizeVi(
    [
      event.event_id,
      event.parent_order_id,
      event.child_order_id ?? '',
      event.action,
      EVENT_ACTION_LABELS[event.action],
      event.user_id,
      formatAuditActor(event.user_id),
      formatEventChange(event),
      formatReason(event) ?? '',
    ].join(' '),
  )
}

/** Lọc rồi xếp mới nhất trước. Cùng thời điểm thì event ghi sau đứng trước. */
export function filterAuditEvents(events: OrderEvent[], filters: AuditFilters, tradingDate: string): OrderEvent[] {
  const range = resolveDateRange(filters.range, tradingDate)
  const orderId = filters.orderId.trim().toUpperCase()
  const words = normalizeVi(filters.query).split(/\s+/).filter(Boolean)
  return events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => {
      if (!isInRange(event.event_time, range)) return false
      if (filters.action !== ALL && event.action !== filters.action) return false
      if (filters.actor !== ALL && event.user_id !== filters.actor) return false
      if (orderId && !event.parent_order_id.toUpperCase().includes(orderId) && !(event.child_order_id ?? '').toUpperCase().includes(orderId)) {
        return false
      }
      if (words.length === 0) return true
      const text = searchText(event)
      return words.every((word) => text.includes(word))
    })
    .sort((a, b) => b.event.event_time.localeCompare(a.event.event_time) || b.index - a.index)
    .map(({ event }) => event)
}

/** Người thực hiện có trong nhật ký, để chọn lọc. HỆ THỐNG đứng đầu. */
export function getAuditActors(events: OrderEvent[]): string[] {
  const actors = [...new Set(events.map((event) => event.user_id))].sort()
  return actors.includes(SYSTEM_ACTOR) ? [SYSTEM_ACTOR, ...actors.filter((actor) => actor !== SYSTEM_ACTOR)] : actors
}

export function buildAuditCsv(events: OrderEvent[]): string {
  return toCsv(
    ['Thời gian', 'Mã lệnh cha', 'Mã lệnh con', 'Hành động', 'Người thực hiện', 'Kênh', 'Giá trị cũ → mới', 'Mã lý do', 'Giải thích'],
    events.map((event) => [
      event.event_time.replace('T', ' '),
      event.parent_order_id,
      event.child_order_id,
      EVENT_ACTION_LABELS[event.action],
      formatAuditActor(event.user_id),
      formatAuditChannel(event.channel),
      formatEventChange(event),
      event.reason_code ?? null,
      event.reason_code ? REASON_TEXT[event.reason_code] : null,
    ]),
  )
}

export function getAuditFilename(tradingDate: string): string {
  return `nhat-ky-kiem-toan-${tradingDate}.csv`
}
