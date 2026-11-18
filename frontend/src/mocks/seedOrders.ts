import { toDateString } from '@/lib/format'
import type {
  ChildOrder,
  ChildOrderStatus,
  EventReasonCode,
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
import type { CoreOverride, SeedData } from './engine'

interface SeedChild {
  price: number
  quantity: number
  filled: number
  status: ChildOrderStatus
  /** Giờ gửi và khớp (HH:MM:SS). Không có thì dùng giờ tạo lệnh. */
  at?: string
  /** Lệnh có `past`: lệnh con thuộc phiên thứ mấy kể từ phiên bắt đầu (0 là phiên đầu). */
  session?: number
  /**
   * Lệnh con từng mất ACK rồi được đối soát: KEPT là Core đã có lệnh (giữ lệnh con, khớp sau đó),
   * CANCELLED là Core không có lệnh (hủy, không có core_order_id).
   */
  unknown?: 'KEPT' | 'CANCELLED'
  /** Có một báo khớp trùng exchange_match_id của lần khớp này, đã bị bỏ qua. */
  duplicate?: boolean
  /** Sổ phía Core ghi khác OMS (dữ liệu đối soát mẫu). */
  core?: Omit<CoreOverride, 'child_order_id'>
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

/**
 * Lệnh đã kết thúc (hoặc chạy nhiều phiên) ở các phiên trước, cho màn Lịch sử và đối soát.
 * Khác `history`: không sinh băng tick và có thể chạy qua nhiều phiên.
 */
interface SeedPast {
  /** Phiên bắt đầu, tính bằng số phiên trước hôm nay. */
  daysAgo: number
  start: string
  /** Giờ kết thúc ở phiên cuối. */
  end: string
  /** Số phiên đã chạy (GTD, MULTI_SESSION). Mỗi lần sang phiên sau có một event CARRY_OVER. Mặc định 1. */
  sessions?: number
  /** Mã lý do của event kết thúc (hết hạn). Lệnh CANCELLED dùng USER_CANCEL. */
  endReason?: EventReasonCode
  /** Người hủy lệnh (lệnh CANCELLED). */
  endUser?: string
  /** Dữ liệu đối soát mẫu: executed_qty ghi trên lệnh cha khác tổng khớp (một Execution bị mất). */
  executedQty?: number
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
  past?: SeedPast
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
  // ===== Các phiên trước, cho màn Lịch sử và đối soát (Đợt 7). Không có lệnh COMPLETED để báo cáo hiệu quả không đổi. =====
  {
    // Dealer hủy giữa chừng. Lệnh con thứ hai mất ACK, đối soát ra Core không có lệnh.
    account_no: A1,
    symbol: 'SSI',
    side: 'BUY',
    strategy_type: 'ICEBERG',
    total_qty: 4_000,
    limit_price: 26_000,
    status: 'CANCELLED',
    persistence_mode: 'DAY',
    createdYesterday: false,
    params: [['slice_qty', '1000', 'INTEGER']],
    children: [
      filled('09:40:00', 26_000, 1_000),
      { price: 26_000, quantity: 1_000, filled: 0, status: 'CANCELLED', at: '09:50:00', unknown: 'CANCELLED' },
      { price: 26_000, quantity: 1_000, filled: 0, status: 'CANCELLED', at: '10:00:00' },
    ],
    arrival_price: 26_100,
    past: { daysAgo: 3, start: '09:35:00', end: '10:05:00', endUser: 'dealer' },
  },
  {
    // Hết ngày còn một lệnh con chưa khớp: OMS ghi hết hạn, Core ghi đã hủy (mẫu STATUS_MISMATCH).
    account_no: A2,
    symbol: 'VCB',
    side: 'SELL',
    strategy_type: 'TWAP',
    total_qty: 3_000,
    limit_price: 61_000,
    status: 'EXPIRED',
    persistence_mode: 'DAY',
    createdYesterday: false,
    params: [
      ['start_time', '09:45', 'TIME'],
      ['end_time', '14:30', 'TIME'],
      ['interval_min', '30', 'INTEGER'],
    ],
    children: [
      filled('10:00:00', 61_000, 1_000),
      filled('10:30:00', 61_100, 1_000),
      { price: 61_000, quantity: 1_000, filled: 0, status: 'EXPIRED', at: '14:20:00', core: { status: 'CANCELLED' } },
    ],
    arrival_price: 61_200,
    past: { daysAgo: 4, start: '09:45:00', end: '15:00:00', endReason: 'DAY_END' },
  },
  {
    // GTD chạy 2 phiên rồi tới valid_to. Lệnh con phiên 2 lệch KL với Core (mẫu QTY_MISMATCH).
    account_no: A3,
    symbol: 'VNM',
    side: 'BUY',
    strategy_type: 'POV',
    total_qty: 5_000,
    limit_price: 64_000,
    status: 'EXPIRED',
    persistence_mode: 'GTD',
    createdYesterday: false,
    params: [
      ['participation_pct', '10', 'INTEGER'],
      ['max_pct', '20', 'INTEGER'],
    ],
    children: [
      { ...filled('10:30:00', 63_800, 1_500), session: 0 },
      { price: 63_900, quantity: 1_500, filled: 1_000, status: 'EXPIRED', at: '10:15:00', session: 1, core: { filled_qty: 1_200 } },
    ],
    arrival_price: 63_700,
    past: { daysAgo: 3, start: '10:00:00', end: '15:00:00', sessions: 2, endReason: 'VALID_TO_REACHED' },
  },
  {
    // Nhiều phiên, khách hủy ở phiên 2. Có một báo khớp trùng bị bỏ qua và một lệnh con mất ACK nhưng Core đã có lệnh.
    account_no: A1,
    symbol: 'MWG',
    side: 'SELL',
    strategy_type: 'VWAP',
    total_qty: 4_000,
    limit_price: 62_000,
    status: 'CANCELLED',
    persistence_mode: 'MULTI_SESSION',
    createdYesterday: false,
    params: [
      ['start_time', '09:30', 'TIME'],
      ['end_time', '14:30', 'TIME'],
    ],
    children: [
      { ...filled('10:00:00', 62_300, 1_000), session: 0, duplicate: true },
      { ...filled('10:20:00', 62_200, 1_000), session: 1, unknown: 'KEPT' },
      { price: 62_200, quantity: 1_000, filled: 0, status: 'CANCELLED', at: '11:00:00', session: 1 },
    ],
    arrival_price: 62_400,
    past: { daysAgo: 2, start: '09:30:00', end: '11:10:00', sessions: 2, endUser: 'khachhang' },
  },
  {
    // executed_qty ghi 1.500 nhưng chỉ có 1.000 CP khớp (mẫu PARENT_SUM_MISMATCH).
    account_no: A2,
    symbol: 'ACB',
    side: 'BUY',
    strategy_type: 'ICEBERG',
    total_qty: 2_000,
    limit_price: 25_000,
    status: 'EXPIRED',
    persistence_mode: 'DAY',
    createdYesterday: false,
    params: [['slice_qty', '500', 'INTEGER']],
    children: [
      filled('10:00:00', 25_000, 500),
      filled('10:10:00', 24_950, 500),
      { price: 25_000, quantity: 500, filled: 0, status: 'EXPIRED', at: '14:00:00' },
    ],
    arrival_price: 24_900,
    past: { daysAgo: 1, start: '09:55:00', end: '15:00:00', endReason: 'DAY_END', executedQty: 1_500 },
  },
]

/** Vị trí lệnh mẫu cố ý có executed_qty khác tổng khớp, để màn Đối soát có dòng PARENT_SUM_MISMATCH. */
export const PARENT_SUM_SAMPLE_INDEX = SEED_ORDERS.findIndex((seed) => seed.past?.executedQty !== undefined)

const isFinished = (status: ParentOrderStatus) => status === 'COMPLETED' || status === 'CANCELLED' || status === 'EXPIRED'

/** Khoảng cách giữa hai tick thị trường mẫu, giây. */
const SEED_TICK_SECONDS = 20

/** Ngày giao dịch cách `now` n phiên, bỏ thứ Bảy và Chủ nhật. */
export function tradingDaysAgo(now: Date, days: number): string {
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
  const coreOverrides: CoreOverride[] = []

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
    const past = seed.past
    const date = history
      ? tradingDaysAgo(now, history.daysAgo)
      : past
        ? tradingDaysAgo(now, past.daysAgo)
        : seed.createdYesterday
          ? yesterday
          : today
    /** Ngày của phiên thứ `session` kể từ phiên bắt đầu (chỉ lệnh `past` chạy nhiều phiên). */
    const sessionDate = (session = 0) => (past ? tradingDaysAgo(now, past.daysAgo - session) : date)
    const sessionCount = past?.sessions ?? 1
    const lastDate = sessionDate(sessionCount - 1)
    const id = `PO-${date.replaceAll('-', '')}-${String(index + 1).padStart(4, '0')}`
    const createdAt = history
      ? `${date}T${history.start}`
      : past
        ? `${date}T${past.start}`
        : `${date}T09:${String(index + 1).padStart(2, '0')}:00`
    const finishedAt = history ? `${date}T${history.end}` : past ? `${lastDate}T${past.end}` : createdAt
    const multiDay = seed.persistence_mode !== 'DAY'
    const executed = past?.executedQty ?? (seed.children ?? []).reduce((sum, child) => sum + child.filled, 0)

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
      // GTD đã hết hạn vì tới valid_to: valid_to là phiên cuối.
      valid_to: multiDay ? (past?.endReason === 'VALID_TO_REACHED' ? lastDate : nextWeek) : date,
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
      const childDate = sessionDate(child.session ?? 0)
      const childAt = child.at ? `${childDate}T${child.at}` : createdAt
      const later = (seconds: number) => (child.at ? `${childDate}T${toClock(toSeconds(child.at) + seconds)}` : childAt)
      // Lệnh con mất ACK được giữ lại thì khớp sau khi đối soát xong.
      const fillAt = child.unknown === 'KEPT' ? later(10) : childAt
      if (child.core) coreOverrides.push({ child_order_id: childId, ...child.core })
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
        core_order_id:
          child.status === 'UNKNOWN' || child.unknown === 'CANCELLED' ? null : `CORE-SEED-${index + 1}${childIndex + 1}`,
        created_at: childAt,
        sent_at: childAt,
      })
      addEvent({ parent_order_id: id, child_order_id: childId, action: 'CHILD_CREATE', old_value: null, new_value: 'CREATED', event_time: childAt })
      if (child.unknown) {
        // Gửi, mất ACK, rồi đối soát ra trạng thái thật (như timeOutChild → recoverChild của engine).
        const kept = child.unknown === 'KEPT'
        addEvent({ parent_order_id: id, child_order_id: childId, action: 'CHILD_SEND', old_value: 'CREATED', new_value: 'SENDING', event_time: childAt })
        addEvent({ parent_order_id: id, child_order_id: childId, action: 'CHILD_UNKNOWN', old_value: 'SENDING', new_value: 'UNKNOWN', event_time: later(3), reason_code: 'ACK_TIMEOUT' })
        addEvent({
          parent_order_id: id,
          child_order_id: childId,
          action: 'RECOVERY',
          old_value: 'UNKNOWN',
          new_value: kept ? 'ACKNOWLEDGED' : 'CANCELLED',
          event_time: later(8),
          reason_code: kept ? 'RECONCILED_KEPT' : 'RECONCILED_CANCELLED',
        })
      } else {
        addEvent({
          parent_order_id: id,
          child_order_id: childId,
          action: 'CHILD_SEND',
          old_value: 'CREATED',
          new_value: child.status,
          event_time: childAt,
          // Lệnh con mẫu UNKNOWN: mất ACK từ Core, để phần giải thích lệnh có mã lý do.
          ...(child.status === 'UNKNOWN' ? { reason_code: 'ACK_TIMEOUT' as const } : {}),
        })
      }
      if (child.filled > 0) {
        const matchId = `M-SEED-${index + 1}${childIndex + 1}`
        executions.push({
          execution_id: `X-${matchId}`,
          child_order_id: childId,
          parent_order_id: id,
          exchange_match_id: matchId,
          price: child.price,
          qty: child.filled,
          match_time: fillAt,
        })
        // Lần khớp của lệnh cũng là một phần KL khớp toàn thị trường.
        tape.push({ symbol: seed.symbol, time: fillAt, price: child.price, qty: child.filled })
        addEvent({ parent_order_id: id, child_order_id: childId, action: 'FILL', old_value: null, new_value: child.status, event_time: fillAt, fill_detail: { qty: child.filled, price: child.price, exchange_match_id: matchId } })
        if (child.duplicate) {
          // Sàn gửi lại đúng báo khớp này: engine bỏ qua, KL không đổi (như applyExecution).
          addEvent({ parent_order_id: id, child_order_id: childId, action: 'DECISION', old_value: `DUPLICATE_FILL:${matchId}`, new_value: 'IGNORED', event_time: later(5) })
        }
      }
    })

    // Lệnh nhiều phiên: mỗi lần hết phiên mà chưa xong thì mang phần còn lại sang phiên sau (như closeDay của engine).
    const carryDates = past
      ? Array.from({ length: sessionCount - 1 }, (_, session) => sessionDate(session))
      : multiDay && seed.createdYesterday && !isFinished(seed.status)
        ? [yesterday]
        : []
    carryDates.forEach((day, session) => {
      const filledSoFar = (seed.children ?? [])
        .filter((child) => !past || (child.session ?? 0) <= session)
        .reduce((sum, child) => sum + child.filled, 0)
      addEvent({ parent_order_id: id, child_order_id: null, action: 'DECISION', old_value: `SESSION:${day}`, new_value: `CARRY_OVER:${seed.total_qty - filledSoFar}`, event_time: `${day}T15:00:00` })
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

    if (past) {
      const before = executed > 0 ? 'PARTIALLY_EXECUTED' : 'ACTIVE'
      if (seed.status === 'CANCELLED') {
        addEvent({ parent_order_id: id, child_order_id: null, action: 'CANCEL', old_value: before, new_value: 'CANCELLED', event_time: finishedAt, reason_code: 'USER_CANCEL' }, past.endUser ?? 'SYSTEM')
      } else {
        addEvent({ parent_order_id: id, child_order_id: null, action: 'DECISION', old_value: before, new_value: seed.status, event_time: finishedAt, ...(past.endReason ? { reason_code: past.endReason } : {}) })
      }
    } else if (seed.status !== 'ACTIVE') {
      addEvent({ parent_order_id: id, child_order_id: null, action: 'DECISION', old_value: 'ACTIVE', new_value: seed.status, event_time: finishedAt })
    }
  })

  return { orders, parameters, conditions, children, executions, snapshots, events, notifications, tape, coreOverrides }
}
