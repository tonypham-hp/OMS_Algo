// Kiểu dữ liệu theo ERD (mục 6 của docs/frontend-spec.md). Giữ đúng tên trường, kể cả snake_case,
// để khi nối backend FastAPI không phải đổi tên.
import type { OrderEvent } from './event'

export type Side = 'BUY' | 'SELL'

export type StrategyType =
  | 'STOP'
  | 'STOP_LIMIT'
  | 'TAKE_PROFIT'
  | 'TRAILING_STOP'
  | 'OCO'
  | 'BRACKET'
  | 'ICEBERG'
  | 'TWAP'
  | 'VWAP'
  | 'POV'
  | 'HUNT'

export type ParentOrderStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PARTIALLY_EXECUTED'
  | 'PAUSED_USER'
  | 'PAUSED_SYSTEM'
  | 'CANCEL_PENDING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED'

export type PersistenceMode = 'DAY' | 'GTD' | 'MULTI_SESSION'

/** Lý do hệ thống tạm dừng lệnh. */
export type OrderReasonCode = 'PRICE_OUT_OF_BAND'

/** Các loại giá của lệnh, phải nằm trong biên độ ngày hiện tại. */
export type PriceFieldName = 'limit_price' | 'trigger_price' | 'tp_price' | 'sl_price' | 'hunt_price'

export interface ParentOrder {
  parent_order_id: string
  client_request_id: string
  account_no: string
  symbol: string
  side: Side
  total_qty: number
  executed_qty: number
  /** null khi lệnh không có giá giới hạn (Stop, Trailing Stop, OCO). */
  limit_price: number | null
  strategy_type: StrategyType
  status: ParentOrderStatus
  /** Ngoài ERD: lý do của PAUSED_SYSTEM, quyết định lệnh có được sửa giá hay không. */
  reason_code: OrderReasonCode | null
  valid_from: string
  valid_to: string
  persistence_mode: PersistenceMode
  version: number
  created_at: string
  updated_at: string
}

export type StrategyParameterDataType = 'INTEGER' | 'TIME'

export interface StrategyParameter {
  parameter_code: string
  parameter_value: string
  data_type: StrategyParameterDataType
}

export type ConditionStatus = 'ACTIVE' | 'TRIGGERED' | 'CANCELLED'

export interface OrderCondition {
  condition_id: string
  parent_order_id: string
  condition_type: string
  /** null với Trailing Stop: giá kích hoạt chỉ tính được khi engine theo dõi giá. */
  trigger_price: number | null
  oco_group_id: string | null
  status: ConditionStatus
  triggered_at: string | null
}

export type ChildOrderType = 'LO' | 'MTL' | 'ATO' | 'ATC'

export type ChildOrderStatus =
  | 'CREATED'
  | 'SENDING'
  | 'ACKNOWLEDGED'
  | 'PARTIAL_FILLED'
  | 'FILLED'
  | 'CANCEL_PENDING'
  | 'CANCELLED'
  | 'REJECTED'
  | 'UNKNOWN'
  | 'EXPIRED'

export interface ChildOrder {
  child_order_id: string
  parent_order_id: string
  cycle_no: number
  side: Side
  order_type: ChildOrderType
  price: number | null
  quantity: number
  filled_qty: number
  status: ChildOrderStatus
  client_order_id: string
  idempotency_key: string
  core_order_id: string | null
  created_at: string
  sent_at: string | null
}

export interface Execution {
  execution_id: string
  child_order_id: string
  parent_order_id: string
  exchange_match_id: string
  price: number
  qty: number
  match_time: string
}

export interface MarketSnapshot {
  arrival_price: number
  arrival_bid: number
  arrival_ask: number
  arrival_timestamp: string
}

/** Phần chi tiết của một lệnh cha ở Màn 3, ngoài thông tin lệnh cha. */
export interface OrderDetailData {
  parameters: StrategyParameter[]
  children: ChildOrder[]
  executions: Execution[]
  /** null khi lúc đặt lệnh chưa có giá của mã. */
  snapshot: MarketSnapshot | null
  events: OrderEvent[]
}

/** Dữ liệu gửi lên khi đặt lệnh. Tham số riêng của từng loại lệnh nằm trong `parameters`. */
export interface CreateOrderRequest {
  client_request_id: string
  account_no: string
  symbol: string
  side: Side
  total_qty: number
  limit_price: number | null
  strategy_type: StrategyType
  persistence_mode: PersistenceMode
  valid_to: string | null
  parameters: StrategyParameter[]
}

export interface CreateOrderResponse {
  parent_order: ParentOrder
}

/** Dữ liệu gửi lên khi sửa lệnh. `version` để phát hiện lệnh đã bị đổi ở nơi khác. */
export interface UpdateOrderRequest {
  version: number
  total_qty: number
  limit_price: number | null
}

/** Một loại giá mà lệnh đang tạm dừng cần có giá hợp lệ. */
export interface OrderPriceField {
  name: PriceFieldName
  value: number
}

/** Dữ liệu gửi lên khi sửa giá lệnh PAUSED_SYSTEM do giá ngoài biên độ. */
export interface RepriceOrderRequest {
  version: number
  prices: Partial<Record<PriceFieldName, number>>
}
