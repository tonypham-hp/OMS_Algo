import { CHILD_STATUS_STYLES, PARENT_STATUS_STYLES } from '@/config/orderStatus'
import { formatDate, formatNumber } from '@/lib/format'
import type { ChildOrderStatus, OrderEvent, OrderEventAction, ParentOrderStatus } from '@/types'

export const EVENT_ACTION_LABELS: Record<OrderEventAction, string> = {
  CREATE: 'Tạo lệnh',
  MODIFY: 'Sửa lệnh',
  PAUSE: 'Tạm dừng',
  RESUME: 'Tiếp tục',
  CANCEL: 'Hủy',
  TRIGGER: 'Kích hoạt điều kiện',
  CHILD_CREATE: 'Tạo lệnh con',
  CHILD_SEND: 'Gửi lệnh con',
  FILL: 'Khớp lệnh',
  REJECT: 'Bị từ chối',
  RECOVERY: 'Đối soát',
  DECISION: 'Hệ thống xử lý',
  CHILD_UNKNOWN: 'Mất phản hồi từ Core',
}

const ACTOR_LABELS: Record<string, string> = { SYSTEM: 'Hệ thống', seed: 'Dữ liệu mẫu' }

const VALUE_LABELS: Record<string, string> = {
  total_qty: 'KL',
  limit_price: 'Giá giới hạn',
  trigger_price: 'Giá kích hoạt',
  tp_price: 'Giá TP',
  sl_price: 'Giá SL',
  hunt_price: 'Giá săn',
}

const CONDITION_LABELS: Record<string, string> = {
  STOP: 'Stop',
  TAKE_PROFIT: 'Take Profit',
  TRAILING_STOP: 'Trailing Stop',
  HUNT: 'Săn giá',
}

const CONDITION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang chờ',
  TRIGGERED: 'Đã kích hoạt',
  CANCELLED: 'Đã hủy',
}

export function formatEventActor(userId: string): string {
  return ACTOR_LABELS[userId] ?? userId
}

function formatFields(entries: Array<[string, unknown]>) {
  return entries
    .map(([name, value]) => `${VALUE_LABELS[name] ?? name} ${value === null ? '—' : formatNumber(Number(value))}`)
    .join(', ')
}

/** Nội dung một dòng nhật ký: lần khớp ghi KL, giá, mã khớp; các event khác ghi giá trị cũ → mới. */
export function formatEventChange(
  event: Pick<OrderEvent, 'child_order_id' | 'old_value' | 'new_value' | 'fill_detail'>,
): string {
  const fill = event.fill_detail
  if (fill) return `Khớp ${formatNumber(fill.qty)} CP @ ${formatNumber(fill.price)} · ${fill.exchange_match_id}`
  return `${formatEventValue(event.old_value, event)} → ${formatEventValue(event.new_value, event)}`
}

/** Đổi giá trị thô trong nhật ký (mã trạng thái, JSON, chuỗi của engine) thành tiếng Việt. */
export function formatEventValue(value: string | null, event: Pick<OrderEvent, 'child_order_id'>): string {
  if (value === null) return '—'

  const [prefix, ...rest] = value.split(':')
  const detail = rest.join(':')
  if (prefix === 'CONDITION') {
    const [type, status] = detail.split(':')
    return `Điều kiện ${CONDITION_LABELS[type] ?? type}: ${CONDITION_STATUS_LABELS[status] ?? status}`
  }
  if (prefix === 'DUPLICATE_FILL') return `Báo khớp trùng ${detail}`
  if (prefix === 'KILL_SWITCH') {
    return detail === 'ALL' ? 'Kill switch toàn hệ thống' : `Kill switch tài khoản ${detail.replace('ACCOUNT:', '')}`
  }
  if (prefix === 'SESSION') return `Phiên ${formatDate(detail)}`
  if (prefix === 'CARRY_OVER') return `Mang sang phiên sau ${formatNumber(Number(detail))} CP`
  if (prefix === 'PRICE_OUT_OF_BAND') {
    const band = Object.fromEntries(detail.split(',').map((part) => part.split('=')))
    return `Ngoài biên độ (sàn ${formatNumber(Number(band.floor))}, trần ${formatNumber(Number(band.ceiling))})`
  }

  if (value.startsWith('{')) return formatFields(Object.entries(JSON.parse(value) as Record<string, unknown>))
  if (value.includes('=')) return formatFields(value.split(',').map((part) => part.split('=') as [string, string]))

  if (value === 'TRIGGERED') return CONDITION_STATUS_LABELS.TRIGGERED
  if (value === 'IGNORED') return 'Đã bỏ qua, KL không đổi'
  const label = event.child_order_id
    ? CHILD_STATUS_STYLES[value as ChildOrderStatus]?.label
    : PARENT_STATUS_STYLES[value as ParentOrderStatus]?.label
  return label ?? value
}
