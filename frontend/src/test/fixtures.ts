// Dữ liệu mẫu cho test các hàm thuần (Trung tâm lệnh, thông báo). Không dùng trong app.
import type { ChildOrder, ChildOrderStatus, Execution, OrderEvent, ParentOrder, Side } from '@/types'

export const TODAY = '2026-11-10'
export const YESTERDAY = '2026-11-09'
export const iso = (date: string, clock: string) => `${date}T${clock}`

export function makeOrder(id: string, overrides: Partial<ParentOrder> = {}): ParentOrder {
  return {
    parent_order_id: id,
    client_request_id: `c-${id}`,
    account_no: 'A',
    symbol: 'FPT',
    side: 'BUY',
    total_qty: 1_000,
    executed_qty: 0,
    limit_price: 100_000,
    strategy_type: 'ICEBERG',
    status: 'ACTIVE',
    reason_code: null,
    valid_from: iso(TODAY, '09:00:00'),
    valid_to: TODAY,
    persistence_mode: 'DAY',
    version: 1,
    created_at: iso(TODAY, '09:00:00'),
    updated_at: iso(TODAY, '09:00:00'),
    ...overrides,
  }
}

export function makeChild(
  id: string,
  parentOrderId: string,
  status: ChildOrderStatus = 'ACKNOWLEDGED',
  side: Side = 'BUY',
): ChildOrder {
  return {
    child_order_id: id,
    parent_order_id: parentOrderId,
    cycle_no: 1,
    side,
    order_type: 'LO',
    price: 100_000,
    quantity: 500,
    filled_qty: 0,
    status,
    client_order_id: `CL-${id}`,
    idempotency_key: `IDEM-${id}`,
    core_order_id: null,
    created_at: iso(TODAY, '09:00:00'),
    sent_at: null,
  }
}

export function makeExecution(
  id: string,
  childOrderId: string,
  parentOrderId: string,
  qty: number,
  price: number,
  matchTime = iso(TODAY, '09:30:00'),
): Execution {
  return {
    execution_id: id,
    child_order_id: childOrderId,
    parent_order_id: parentOrderId,
    exchange_match_id: `M-${id}`,
    price,
    qty,
    match_time: matchTime,
  }
}

let eventSequence = 0

export function makeEvent(overrides: Partial<OrderEvent> & Pick<OrderEvent, 'action'>): OrderEvent {
  eventSequence += 1
  return {
    event_id: `E-${String(eventSequence).padStart(6, '0')}`,
    parent_order_id: 'PO-1',
    child_order_id: null,
    user_id: 'SYSTEM',
    channel: 'ENGINE',
    old_value: null,
    new_value: null,
    event_time: iso(TODAY, '09:15:00'),
    ...overrides,
  }
}
