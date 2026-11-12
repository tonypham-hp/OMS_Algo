import type { ExecutionReport, OrderEngine } from '@/mocks/engine'
import type { MarketTape } from '@/mocks/marketTape'
import type { MarketSimulator } from '@/mocks/simulator'
import type {
  ChildOrder,
  Execution,
  OrderCondition,
  OrderEvent,
  ParentOrder,
  Side,
  StrategyType,
} from '@/types'

// Chế độ Demo: kịch bản là DỮ LIỆU (src/demo/scenarios), bộ chạy (runner.ts) đọc và thực hiện.
// Không file nào trong src/demo (trừ phần gắn vào app) phụ thuộc React, để chạy được trong Vitest.

/** Những gì một kịch bản được điều khiển: engine, bộ giả lập giá, băng tick, tài khoản đặt lệnh. */
export interface DemoEnv {
  engine: OrderEngine
  simulator: MarketSimulator
  tape: MarketTape
  /** Tài khoản đặt lệnh của kịch bản (tài khoản đầu tiên của người đang đăng nhập). */
  account: string
  /** user_id ghi vào OrderEvent khi kịch bản thao tác thay người dùng. */
  userId: string
}

/** Chỉ tới một lệnh con: lệnh cha theo tên đã lưu, và lệnh con thứ n (từ 1), mới nhất, hoặc đang chờ khớp. */
export interface ChildRef {
  order: string
  child: number | 'last' | 'open'
}

export interface PlaceOrderParams {
  /** Tên để các bước sau chỉ tới lệnh này, ví dụ "order". */
  ref: string
  symbol: string
  side: Side
  strategy_type: StrategyType
  total_qty: number
  limit_price: number | null
  /** Tham số chiến lược. Chuỗi dạng hh:mm là TIME, còn lại là INTEGER. */
  parameters: Record<string, number | string>
}

export type DemoAction =
  | { type: 'note' }
  | { type: 'placeOrder'; params: PlaceOrderParams }
  /** Một hoặc nhiều lần khớp của thị trường; giữa các lần tua `everySeconds` giây. */
  | { type: 'trade'; params: { symbol: string; price: number; qty: number; repeat?: number; everySeconds?: number } }
  | { type: 'setDepth'; params: { symbol: string; asks: Array<[number, number]>; bids: Array<[number, number]> } }
  | { type: 'advance'; params: { seconds: number } }
  | { type: 'jumpTo'; params: { time: string } }
  | { type: 'injectTimeout'; params: { order: string; afterCore: boolean } }
  | { type: 'injectReject'; params: { order: string } }
  | { type: 'duplicateFill'; params: { order: string } }
  | { type: 'staleFeed'; params: { on: boolean } }
  | { type: 'reconcileNow'; params: ChildRef }
  /** Core báo khớp lệnh con: mặc định khớp hết phần còn lại, tại giá của lệnh con. */
  | { type: 'coreFill'; params: ChildRef & { qty?: number; price?: number } }
  | { type: 'coreCancelChild'; params: ChildRef }
  /** Core khớp lần lượt từng lệnh con đang chờ cho tới khi lệnh cha đủ KL. */
  | { type: 'fillUntilDone'; params: { order: string } }
  | { type: 'pause' | 'resume' | 'cancel'; params: { order: string } }
  /** Ghi lại số lệnh con hiện có của lệnh, để check so sánh về sau. */
  | { type: 'mark'; params: { key: string; order: string } }
  /** OMS sập: ghi trạng thái ra "đĩa" rồi xóa sạch bộ nhớ engine. */
  | { type: 'crash' }
  /** Core khớp trong lúc OMS đang tắt: báo khớp được giữ lại, chưa tới OMS. */
  | { type: 'coreFillWhileDown'; params: ChildRef & { qty: number; price: number } }
  /** OMS bật lại: nạp trạng thái từ "đĩa". */
  | { type: 'restore' }
  /** Đối soát với Core sau khi bật lại: nhận các báo khớp bị lỡ. */
  | { type: 'replayMissedFills' }

/** Dữ liệu riêng của một lần chạy kịch bản. */
export interface DemoContext {
  /** Tên → mã lệnh cha thật. */
  refs: Record<string, string>
  /** Số liệu ghi lại bằng action `mark`. */
  marks: Record<string, number>
  /** Trạng thái engine đã ghi ra "đĩa" lúc sập (JSON). */
  disk: string | null
  /** Ảnh dữ liệu lệnh ngay trước khi sập, để so với sau khi khôi phục. */
  beforeCrash: string | null
  /** Báo khớp Core gửi trong lúc OMS tắt. */
  missedReports: ExecutionReport[]
  /** Đếm để sinh mã khớp duy nhất cho báo khớp do kịch bản tạo. */
  matchSequence: number
}

/** Dữ liệu đưa vào check: đọc thẳng từ engine sau khi bước chạy xong. */
export interface DemoState {
  env: DemoEnv
  ctx: DemoContext
  orders: ParentOrder[]
  children: ChildOrder[]
  executions: Execution[]
  events: OrderEvent[]
  conditions: OrderCondition[]
  simSeconds: number
}

export interface Check {
  label: string
  fn: (state: DemoState) => boolean
}

export interface Step {
  id: string
  /** 1–2 câu tiếng Việt, giải thích VÌ SAO hệ thống làm vậy. */
  caption: string
  action: DemoAction
  /** Màn cần mở, có thể chứa {order}, {child:order:2}… */
  route?: string
  /** data-demo-id của phần tử cần tô sáng, cùng cú pháp như route. */
  highlight?: string
  /** Thời gian chờ cho người xem đọc trước khi sang bước sau (ms thật, ở tốc độ x1). */
  waitMs?: number
  /** Số nhịp giả lập tối đa chờ engine ổn định sau action. 0: không chờ. Mặc định 120. */
  settle?: number
  checks?: Check[]
}

export interface Scenario {
  id: string
  /** Số thứ tự hiển thị: Scenario 1…6. */
  number: number
  title: string
  summary: string
  tcRefs: string[]
  /** Seed của random trong engine, để mỗi lần chạy cho cùng kết quả. */
  seed: number
  /** Chuẩn bị thị trường trước bước đầu tiên (giờ, giá). */
  setup: (env: DemoEnv) => void
  steps: Step[]
}
