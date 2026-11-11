import { toDateString } from '@/lib/format'
import type {
  ChildOrder,
  ChildOrderStatus,
  Execution,
  MarketSnapshot,
  MarketTrade,
  Notification,
  OrderCondition,
  OrderEvent,
  ParentOrder,
  ParentOrderStatus,
  PersistenceMode,
  Side,
  StrategyParameter,
  StrategyType,
} from '@/types'
import { getTickSize } from '@/utils/hose'
import type { SeedData } from './engine'

interface SeedChild {
  price: number
  quantity: number
  filled: number
  status: ChildOrderStatus
  /** Giờ gửi và khớp (HH:MM:SS). Không có thì dùng giờ tạo lệnh. */
  at?: string
}

/**
 * Lệnh đã chạy xong ở phiên trước, để báo cáo hiệu quả có dữ liệu ngay khi mở app.
 * Băng tick thị trường của khoảng [start, end] sinh tất định theo đường giá `path`.
 */
interface SeedHistory {
  /** Số phiên trước hôm nay, bỏ thứ Bảy và Chủ nhật. */
  daysAgo: number
  /** Giờ kích hoạt (cũng là giờ tạo lệnh, giờ chụp arrival), HH:MM:SS. */
  start: string
  /** Giờ hoàn tất, HH:MM:SS. */
  end: string
  /** Các mốc giá thị trường, nội suy tuyến tính trong khoảng [start, end]. */
  path: number[]
  /** Tổng KL thị trường của người khác trong khoảng, để tỷ lệ tham gia hợp lý. */
  marketVolume: number
}

interface SeedOrder {
  account_no: string
  symbol: string
  side: Side
  strategy_type: StrategyType
  total_qty: number
  limit_price: number | null
  status: ParentOrderStatus
  persistence_mode: PersistenceMode
  /** Lệnh tạo hôm nay hay từ hôm trước. Bỏ qua khi có `history`. */
  createdYesterday: boolean
  params: Array<[code: string, value: string, type: StrategyParameter['data_type']]>
  conditions?: Array<[type: string, price: number, status: OrderCondition['status']]>
  children?: SeedChild[]
  /** Lý do tạm dừng, ghi thành Notification. */
  pauseReason?: string
  arrival_price: number
  history?: SeedHistory
}

const A1 = '058C123456'
const A2 = '058C234567'
const A3 = '058C345678'

/** Lệnh con đã khớp hết của lệnh mẫu đã hoàn tất. */
const filled = (at: string, price: number, quantity: number): SeedChild => ({
  price,
  quantity,
  filled: quantity,
  status: 'FILLED',
  at,
})

// 8 lệnh mẫu đầu ở nhiều trạng thái. Lệnh đã có khớp hoặc đã kết thúc đều tạo từ hôm trước,
// vì app mở lúc 09:10, khi phiên liên tục hôm nay chưa bắt đầu.
// Các lệnh có `history` đã hoàn tất ở các phiên trước: đủ Iceberg, TWAP, POV, VWAP, HUNT, cả mua và bán,
// cả có lợi và bất lợi so với arrival, để báo cáo hiệu quả thực hiện có số liệu.
const SEED_ORDERS: SeedOrder[] = [
  {
    account_no: A1,
    symbol: 'HPG',
    side: 'BUY',
    strategy_type: 'ICEBERG',
    total_qty: 5_000,
    limit_price: 27_600,
    status: 'ACTIVE',
    persistence_mode: 'DAY',
    createdYesterday: false,
    params: [['slice_qty', '500', 'INTEGER']],
    arrival_price: 27_500,
  },
  {
    account_no: A1,
    symbol: 'FPT',
    side: 'SELL',
    strategy_type: 'TWAP',
    total_qty: 8_000,
    limit_price: 117_000,
    status: 'PARTIALLY_EXECUTED',
    persistence_mode: 'MULTI_SESSION',
    createdYesterday: true,
    params: [
      ['start_time', '09:15', 'TIME'],
      ['end_time', '11:15', 'TIME'],
      ['interval_min', '15', 'INTEGER'],
    ],
    children: [{ price: 117_000, quantity: 1_000, filled: 1_000, status: 'FILLED' }],
    arrival_price: 118_000,
  },
  {
    account_no: A2,
    symbol: 'VCB',
    side: 'SELL',
    strategy_type: 'STOP',
    total_qty: 2_000,
    limit_price: null,
    status: 'ACTIVE',
    persistence_mode: 'DAY',
    createdYesterday: false,
    params: [['trigger_price', '60900', 'INTEGER']],
    conditions: [['STOP', 60_900, 'ACTIVE']],
    arrival_price: 61_200,
  },
  {
    account_no: A2,
    symbol: 'TCB',
    side: 'BUY',
    strategy_type: 'POV',
    total_qty: 10_000,
    limit_price: 24_800,
    status: 'PAUSED_USER',
    persistence_mode: 'GTD',
    createdYesterday: true,
    params: [
      ['participation_pct', '10', 'INTEGER'],
      ['max_pct', '20', 'INTEGER'],
    ],
    children: [{ price: 24_800, quantity: 1_500, filled: 1_000, status: 'CANCELLED' }],
    arrival_price: 24_350,
  },
  {
    account_no: A3,
    symbol: 'VHM',
    side: 'BUY',
    strategy_type: 'VWAP',
    total_qty: 6_000,
    limit_price: 41_500,
    status: 'PAUSED_SYSTEM',
    persistence_mode: 'MULTI_SESSION',
    createdYesterday: true,
    params: [
      ['start_time', '09:30', 'TIME'],
      ['end_time', '14:00', 'TIME'],
    ],
    children: [
      { price: 41_500, quantity: 1_000, filled: 1_000, status: 'FILLED' },
      { price: 41_500, quantity: 1_000, filled: 0, status: 'UNKNOWN' },
    ],
    pauseReason: 'một lệnh con mất phản hồi từ Core, đang chờ đối soát.',
    arrival_price: 41_200,
  },
  {
    // Mua cao hơn arrival 100 đ: bất lợi.
    account_no: A1,
    symbol: 'MWG',
    side: 'BUY',
    strategy_type: 'ICEBERG',
    total_qty: 3_000,
    limit_price: 62_500,
    status: 'COMPLETED',
    persistence_mode: 'DAY',
    createdYesterday: true,
    params: [['slice_qty', '1000', 'INTEGER']],
    children: [filled('09:25:00', 62_500, 1_000), filled('09:35:00', 62_500, 1_000), filled('09:45:00', 62_500, 1_000)],
    arrival_price: 62_400,
    history: { daysAgo: 1, start: '09:20:00', end: '09:50:00', path: [62_400, 62_600, 62_500], marketVolume: 60_000 },
  },
  {
    account_no: A3,
    symbol: 'SSI',
    side: 'SELL',
    strategy_type: 'OCO',
    total_qty: 4_000,
    limit_price: null,
    status: 'CANCELLED',
    persistence_mode: 'DAY',
    createdYesterday: true,
    params: [
      ['tp_price', '26800', 'INTEGER'],
      ['sl_price', '25500', 'INTEGER'],
    ],
    conditions: [
      ['TAKE_PROFIT', 26_800, 'CANCELLED'],
      ['STOP', 25_500, 'CANCELLED'],
    ],
    arrival_price: 26_150,
  },
  {
    account_no: A2,
    symbol: 'ACB',
    side: 'BUY',
    strategy_type: 'STOP_LIMIT',
    total_qty: 1_500,
    limit_price: 25_200,
    status: 'EXPIRED',
    persistence_mode: 'DAY',
    createdYesterday: true,
    params: [['trigger_price', '25100', 'INTEGER']],
    conditions: [['STOP', 25_100, 'TRIGGERED']],
    children: [{ price: 25_200, quantity: 1_500, filled: 500, status: 'EXPIRED' }],
    arrival_price: 24_900,
  },
  {
    // Bán cao hơn arrival: có lợi.
    account_no: A2,
    symbol: 'FPT',
    side: 'SELL',
    strategy_type: 'TWAP',
    total_qty: 6_000,
    limit_price: 117_500,
    status: 'COMPLETED',
    persistence_mode: 'DAY',
    createdYesterday: true,
    params: [
      ['start_time', '09:30', 'TIME'],
      ['end_time', '11:00', 'TIME'],
      ['interval_min', '30', 'INTEGER'],
    ],
    children: [filled('09:45:00', 118_300, 2_000), filled('10:15:00', 118_500, 2_000), filled('10:45:00', 118_400, 2_000)],
    arrival_price: 118_000,
    history: { daysAgo: 2, start: '09:30:00', end: '11:00:00', path: [118_000, 118_400, 118_600, 118_300], marketVolume: 90_000 },
  },
  {
    // Mua cao hơn arrival: bất lợi.
    account_no: A1,
    symbol: 'TCB',
    side: 'BUY',
    strategy_type: 'POV',
    total_qty: 8_000,
    limit_price: 24_800,
    status: 'COMPLETED',
    persistence_mode: 'DAY',
    createdYesterday: true,
    params: [
      ['participation_pct', '10', 'INTEGER'],
      ['max_pct', '20', 'INTEGER'],
    ],
    children: [filled('10:20:00', 24_450, 3_000), filled('10:50:00', 24_500, 3_000), filled('11:20:00', 24_400, 2_000)],
    arrival_price: 24_350,
    history: { daysAgo: 3, start: '10:00:00', end: '11:30:00', path: [24_350, 24_500, 24_550, 24_400], marketVolume: 72_000 },
  },
  {
    // Bán thấp hơn arrival: bất lợi.
    account_no: A3,
    symbol: 'VNM',
    side: 'SELL',
    strategy_type: 'VWAP',
    total_qty: 5_000,
    limit_price: 63_000,
    status: 'COMPLETED',
    persistence_mode: 'DAY',
    createdYesterday: true,
    params: [
      ['start_time', '13:00', 'TIME'],
      ['end_time', '14:30', 'TIME'],
    ],
    children: [filled('13:20:00', 63_500, 2_000), filled('13:50:00', 63_400, 2_000), filled('14:20:00', 63_600, 1_000)],
    arrival_price: 63_800,
    history: { daysAgo: 1, start: '13:00:00', end: '14:30:00', path: [63_800, 63_500, 63_400, 63_600], marketVolume: 60_000 },
  },
  {
    // Mua thấp hơn arrival: có lợi.
    account_no: A1,
    symbol: 'HPG',
    side: 'BUY',
    strategy_type: 'HUNT',
    total_qty: 4_000,
    limit_price: 27_400,
    status: 'COMPLETED',
    persistence_mode: 'DAY',
    createdYesterday: true,
    params: [
      ['hunt_price', '27350', 'INTEGER'],
      ['max_wait_min', '30', 'INTEGER'],
    ],
    children: [filled('10:25:00', 27_350, 2_000), filled('10:35:00', 27_300, 2_000)],
    arrival_price: 27_500,
    history: { daysAgo: 4, start: '10:15:00', end: '10:45:00', path: [27_500, 27_350, 27_300, 27_400], marketVolume: 50_000 },
  },
  {
    // Bán thấp hơn arrival một chút: bất lợi nhẹ.
    account_no: A2,
    symbol: 'MBB',
    side: 'SELL',
    strategy_type: 'ICEBERG',
    total_qty: 3_000,
    limit_price: 23_600,
    status: 'COMPLETED',
    persistence_mode: 'DAY',
    createdYesterday: true,
    params: [['slice_qty', '1000', 'INTEGER']],
    children: [filled('13:35:00', 23_650, 1_000), filled('13:45:00', 23_700, 1_000), filled('13:55:00', 23_650, 1_000)],
    arrival_price: 23_700,
    history: { daysAgo: 2, start: '13:30:00', end: '14:00:00', path: [23_700, 23_650, 23_700, 23_650], marketVolume: 40_000 },
  },
]

/** Khoảng cách giữa hai tick thị trường mẫu, giây. */
const SEED_TICK_SECONDS = 20

/** Ngày giao dịch cách `now` n phiên, bỏ thứ Bảy và Chủ nhật. */
function tradingDaysAgo(now: Date, days: number): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let left = days
  while (left > 0) {
    date.setDate(date.getDate() - 1)
    if (date.getDay() !== 0 && date.getDay() !== 6) left -= 1
  }
  return toDateString(date)
}

const toSeconds = (clock: string) => {
  const [hour, minute, second] = clock.split(':').map(Number)
  return hour * 3600 + minute * 60 + (second ?? 0)
}

const toClock = (seconds: number) =>
  [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')

/** Bộ sinh số giả ngẫu nhiên có seed (LCG): cùng seed luôn ra cùng dãy, nên dữ liệu mẫu lặp lại được. */
function createLcg(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 2 ** 32
  }
}

/** Giá ở thời điểm t (0..1) theo đường giá, nội suy tuyến tính rồi làm tròn về đúng bước giá. */
function priceOnPath(path: number[], t: number, noiseSteps: number): number {
  const position = t * (path.length - 1)
  const index = Math.min(Math.floor(position), path.length - 2)
  const raw = path[index] + (path[index + 1] - path[index]) * (position - index)
  const tick = getTickSize(raw)
  return Math.round(raw / tick) * tick + noiseSteps * tick
}

/** Tick thị trường của người khác trong khoảng của một lệnh mẫu đã hoàn tất. */
function createHistoryTape(symbol: string, date: string, history: SeedHistory, seed: number): MarketTrade[] {
  const random = createLcg(seed)
  const from = toSeconds(history.start)
  const to = toSeconds(history.end)
  const count = Math.max(1, Math.floor((to - from) / SEED_TICK_SECONDS))
  const baseQty = history.marketVolume / count
  const trades: MarketTrade[] = []
  for (let step = 0; step < count; step += 1) {
    const seconds = from + step * SEED_TICK_SECONDS + 10
    const noise = Math.floor(random() * 3) - 1
    const qty = Math.max(100, Math.round((baseQty * (0.5 + random())) / 100) * 100)
    trades.push({ symbol, time: `${date}T${toClock(seconds)}`, price: priceOnPath(history.path, step / count, noise), qty })
  }
  return trades
}

/** Sinh dữ liệu mẫu theo ngày truyền vào. Giờ tạo mỗi lệnh lệch nhau 1 phút để sắp xếp có thứ tự rõ ràng. */
export function createSeedData(now: Date): SeedData {
  const today = toDateString(now)
  const yesterday = toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  const nextWeek = toDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7))

  const orders: ParentOrder[] = []
  const parameters = new Map<string, StrategyParameter[]>()
  const conditions: OrderCondition[] = []
  const children: ChildOrder[] = []
  const executions: Execution[] = []
  const snapshots = new Map<string, MarketSnapshot>()
  const events: OrderEvent[] = []
  const notifications: Notification[] = []
  const tape: MarketTrade[] = []

  const addEvent = (event: Omit<OrderEvent, 'event_id' | 'user_id' | 'channel'>, userId = 'SYSTEM') => {
    events.push({
      ...event,
      event_id: `E-SEED-${String(events.length + 1).padStart(3, '0')}`,
      user_id: userId,
      channel: userId === 'SYSTEM' ? 'ENGINE' : 'WEB',
    })
  }

  SEED_ORDERS.forEach((seed, index) => {
    const history = seed.history
    const date = history ? tradingDaysAgo(now, history.daysAgo) : seed.createdYesterday ? yesterday : today
    const id = `PO-${date.replaceAll('-', '')}-${String(index + 1).padStart(4, '0')}`
    const createdAt = history ? `${date}T${history.start}` : `${date}T09:${String(index + 1).padStart(2, '0')}:00`
    const finishedAt = history ? `${date}T${history.end}` : createdAt
    const multiDay = seed.persistence_mode !== 'DAY'
    const executed = (seed.children ?? []).reduce((sum, child) => sum + child.filled, 0)

    orders.push({
      parent_order_id: id,
      client_request_id: `seed-${index + 1}`,
      account_no: seed.account_no,
      symbol: seed.symbol,
      side: seed.side,
      total_qty: seed.total_qty,
      executed_qty: executed,
      limit_price: seed.limit_price,
      strategy_type: seed.strategy_type,
      status: seed.status,
      reason_code: null,
      valid_from: createdAt,
      valid_to: multiDay ? nextWeek : date,
      persistence_mode: seed.persistence_mode,
      version: 1,
      created_at: createdAt,
      updated_at: finishedAt,
    })
    parameters.set(
      id,
      seed.params.map(([parameter_code, parameter_value, data_type]) => ({ parameter_code, parameter_value, data_type })),
    )
    snapshots.set(id, {
      arrival_price: seed.arrival_price,
      arrival_bid: seed.arrival_price,
      arrival_ask: seed.arrival_price,
      arrival_timestamp: createdAt,
    })
    addEvent({ parent_order_id: id, child_order_id: null, action: 'CREATE', old_value: null, new_value: 'ACTIVE', event_time: createdAt }, 'seed')

    seed.conditions?.forEach(([condition_type, trigger_price, status], conditionIndex) => {
      conditions.push({
        condition_id: `${id}-C${conditionIndex + 1}`,
        parent_order_id: id,
        condition_type,
        trigger_price,
        oco_group_id: seed.strategy_type === 'OCO' ? `OCO-${id}` : null,
        status,
        triggered_at: status === 'TRIGGERED' ? createdAt : null,
      })
    })

    seed.children?.forEach((child, childIndex) => {
      const childId = `${id}-CH${String(childIndex + 1).padStart(3, '0')}`
      const childAt = child.at ? `${date}T${child.at}` : createdAt
      children.push({
        child_order_id: childId,
        parent_order_id: id,
        cycle_no: childIndex + 1,
        side: seed.side,
        order_type: 'LO',
        price: child.price,
        quantity: child.quantity,
        filled_qty: child.filled,
        status: child.status,
        client_order_id: `CL-${childId}`,
        idempotency_key: `IDEM-${childId}`,
        core_order_id: child.status === 'UNKNOWN' ? null : `CORE-SEED-${index + 1}${childIndex + 1}`,
        created_at: childAt,
        sent_at: childAt,
      })
      addEvent({ parent_order_id: id, child_order_id: childId, action: 'CHILD_CREATE', old_value: null, new_value: 'CREATED', event_time: childAt })
      addEvent({ parent_order_id: id, child_order_id: childId, action: 'CHILD_SEND', old_value: 'CREATED', new_value: child.status, event_time: childAt })
      if (child.filled > 0) {
        const matchId = `M-SEED-${index + 1}${childIndex + 1}`
        executions.push({
          execution_id: `X-${matchId}`,
          child_order_id: childId,
          parent_order_id: id,
          exchange_match_id: matchId,
          price: child.price,
          qty: child.filled,
          match_time: childAt,
        })
        // Lần khớp của lệnh cũng là một phần KL khớp toàn thị trường.
        tape.push({ symbol: seed.symbol, time: childAt, price: child.price, qty: child.filled })
        addEvent({ parent_order_id: id, child_order_id: childId, action: 'FILL', old_value: null, new_value: child.status, event_time: childAt, fill_detail: { qty: child.filled, price: child.price, exchange_match_id: matchId } })
      }
    })

    if (history) tape.push(...createHistoryTape(seed.symbol, date, history, index + 1))

    if (seed.pauseReason) {
      notifications.push({
        notification_type: 'PARENT_PAUSED',
        parent_order_id: id,
        message: `Lệnh ${id} tạm dừng: ${seed.pauseReason}`,
        sent_at: createdAt,
      })
    }

    if (seed.status !== 'ACTIVE') {
      addEvent({ parent_order_id: id, child_order_id: null, action: 'DECISION', old_value: 'ACTIVE', new_value: seed.status, event_time: finishedAt })
    }
  })

  return { orders, parameters, conditions, children, executions, snapshots, events, notifications, tape }
}
