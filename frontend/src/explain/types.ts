import type {
  ChildOrderStatus,
  CoreRejectCode,
  EventReasonCode,
  Execution,
  MarketSnapshot,
  MarketWindowStats,
  OrderReasonCode,
  ParentOrderStatus,
  PriceFieldName,
  Role,
  SessionCode,
  StrategyParameter,
  SymbolQuote,
} from '@/types'

/** Mã giải thích. Mỗi mã có một mục trong `REASONS` (src/explain/reasons.ts). */
export type ExplainCode =
  | 'PRICE_OUT_OF_BAND'
  | 'SESSION_LOCKED'
  | 'STALE_MARKET_DATA'
  | 'KILL_SWITCH'
  | 'CHILD_REJECTED'
  | 'CHILD_UNKNOWN'
  | 'CONDITION_WAITING'
  | 'POV_THROTTLED'
  | 'HUNT_NO_LEVEL'
  | 'PAUSED_USER'
  | 'EXPIRED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'RUNNING'
  | 'NOT_ENOUGH_DATA'

/** Thị trường lúc giải thích. Trường nào không biết thì để null, câu giải thích sẽ nói "chưa đủ dữ liệu". */
export interface ExplainMarket {
  session: SessionCode
  quote: Pick<SymbolQuote, 'ref_price' | 'last_price' | 'bid_price' | 'ask_price'> | null
  /** Số giây thật kể từ lần cuối nhận giá. */
  quote_age_seconds: number | null
  /** Ngưỡng giá trễ của cấu hình hệ thống. Chỉ vận hành đọc được, role khác là null. */
  max_delay_seconds: number | null
  /** Số lần Core từ chối liên tiếp thì dừng lệnh. Chỉ vận hành đọc được. */
  max_rejects: number | null
}

/** Dữ liệu thêm của Chi tiết lệnh, không bắt buộc (Sổ lệnh không có). */
export interface ExplainExtra {
  parameters?: StrategyParameter[]
  executions?: Execution[]
  snapshot?: MarketSnapshot | null
  window?: MarketWindowStats | null
}

export interface PriceOutOfBand {
  field: PriceFieldName
  label: string
  value: number
  side: 'ABOVE' | 'BELOW'
  /** Giá hợp lệ gần nhất: giá trần nếu vượt trần, giá sàn nếu dưới sàn. */
  suggested: number
  /** Bước giá ở mức giá gợi ý. */
  tick: number
}

export interface ConditionInfo {
  label: string
  price: number
  /** Khoảng cách từ giá khớp gần nhất tới giá kích hoạt (đồng). null khi chưa có giá. */
  gap: number | null
  gap_ticks: number | null
  /** Giá phải đi lên (UP) hay xuống (DOWN) để chạm. */
  direction: 'UP' | 'DOWN'
}

export interface RejectInfo {
  child_order_id: string
  cycle_no: number
  quantity: number
  price: number | null
  /** Bước giá ở mức giá của lệnh con. */
  tick: number | null
  reject_code: CoreRejectCode | null
  event_id: string | null
}

/**
 * Mọi dữ kiện câu giải thích được dùng. Câu chỉ được lấy số từ đây; test kiểm tra điều này.
 * Số đã tính sẵn (giá trần, sàn, khoảng cách) cũng nằm ở đây, kèm nguồn trong `sources`.
 */
export interface ExplainContext {
  order_id: string
  symbol: string
  strategy_label: string
  side_label: string
  status: ParentOrderStatus
  reason_code: OrderReasonCode | null
  total_qty: number
  executed_qty: number
  remaining_qty: number
  /** KL các lệnh con đang chờ khớp. */
  working_qty: number
  working_children: number
  session: SessionCode
  session_label: string
  can_modify: boolean
  ref_price: number | null
  ceiling_price: number | null
  floor_price: number | null
  band_pct: number
  last_price: number | null
  out_of_band: PriceOutOfBand | null
  quote_age_seconds: number | null
  max_delay_seconds: number | null
  kill_switch_scope: string | null
  kill_switch_at: string | null
  last_reject: RejectInfo | null
  /** Số lệnh con bị từ chối liên tiếp ở cuối danh sách. */
  reject_streak: number
  max_rejects: number | null
  lot_size: number
  max_order_qty: number
  unknown_child: { child_order_id: string; cycle_no: number; open_qty: number; event_id: string | null } | null
  is_triggered: boolean
  conditions: ConditionInfo[]
  trailing_value: number | null
  pov: { participation_pct: number | null; max_pct: number | null; cap: number | null; market_qty: number | null } | null
  hunt: { limit_price: number | null; best_price: number | null; max_wait_min: number | null } | null
  /** Người, giờ của lần tạm dừng/hủy gần nhất. */
  last_action: { user: string; at: string } | null
  expire_code: EventReasonCode | null
  expire_at: string | null
  persistence_label: string
  valid_to: string
  window_start: string | null
  window_end: string | null
  hunt_price: number | null
  avg_price: number | null
  arrival_price: number | null
  arrival_bps_text: string | null
  arrival_favorable: boolean | null
  /** Event liên quan nhất, để nút "Xem nhật ký" cuộn tới. */
  related_event_id: string | null
}

export type ExplainActionKind = 'REPRICE' | 'SCROLL_LOG' | 'RESUME' | 'REOPEN' | 'RECONCILE' | 'OPEN_OPS'

export interface ExplainAction {
  kind: ExplainActionKind
  label: string
  enabled: boolean
  /** Lý do nút bị khóa. */
  reason?: string
  /** REPRICE: giá gợi ý cho form sửa giá. */
  prices?: Partial<Record<PriceFieldName, number>>
  /** RECONCILE: lệnh con cần đối soát. */
  child_order_id?: string
  /** SCROLL_LOG: event cần cuộn tới. */
  event_id?: string
}

export interface Explanation {
  code: ExplainCode
  title: string
  text: string
  /** Câu đầu của `text`, cho tooltip ở badge trạng thái. */
  short: string
  actions: ExplainAction[]
  /** Các dữ kiện đã dùng, hiện ở dòng "Dựa trên: …". */
  sources: string[]
  context: ExplainContext
}

export interface ChildExplanation {
  code: ExplainCode | 'CHILD_STATE'
  status: ChildOrderStatus
  text: string
}

export interface ActionDef {
  kind: ExplainActionKind
  label: string
  /** Vai trò thấy được nút. Không khai báo: mọi vai trò xem được lệnh. */
  roles?: Role[]
  /** Nút có bấm được không; trả về chuỗi là lý do bị khóa. */
  enabled?: (ctx: ExplainContext) => true | string
}
