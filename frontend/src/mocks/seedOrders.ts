import { toDateString } from '@/lib/format'
import type {
  ChildOrder,
  ChildOrderStatus,
  Execution,
  MarketSnapshot,
  OrderCondition,
  OrderEvent,
  ParentOrder,
  ParentOrderStatus,
  PersistenceMode,
  Side,
  StrategyParameter,
  StrategyType,
} from '@/types'
import type { SeedData } from './engine'

interface SeedChild {
  price: number
  quantity: number
  filled: number
  status: ChildOrderStatus
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
  /** Lệnh tạo hôm nay hay từ hôm trước. */
  createdYesterday: boolean
  params: Array<[code: string, value: string, type: StrategyParameter['data_type']]>
  conditions?: Array<[type: string, price: number, status: OrderCondition['status']]>
  children?: SeedChild[]
  arrival_price: number
}

const A1 = '058C123456'
const A2 = '058C234567'
const A3 = '058C345678'

// 8 lệnh mẫu ở nhiều trạng thái. Lệnh đã có khớp hoặc đã kết thúc đều tạo từ hôm trước,
// vì app mở lúc 09:10, khi phiên liên tục hôm nay chưa bắt đầu.
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
    arrival_price: 41_200,
  },
  {
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
    children: [
      { price: 62_500, quantity: 1_000, filled: 1_000, status: 'FILLED' },
      { price: 62_500, quantity: 1_000, filled: 1_000, status: 'FILLED' },
      { price: 62_500, quantity: 1_000, filled: 1_000, status: 'FILLED' },
    ],
    arrival_price: 62_400,
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
]

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

  const addEvent = (event: Omit<OrderEvent, 'event_id' | 'user_id' | 'channel'>, userId = 'SYSTEM') => {
    events.push({
      ...event,
      event_id: `E-SEED-${String(events.length + 1).padStart(3, '0')}`,
      user_id: userId,
      channel: userId === 'SYSTEM' ? 'ENGINE' : 'WEB',
    })
  }

  SEED_ORDERS.forEach((seed, index) => {
    const date = seed.createdYesterday ? yesterday : today
    const id = `PO-${date.replaceAll('-', '')}-${String(index + 1).padStart(4, '0')}`
    const createdAt = `${date}T09:0${index + 1}:00`
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
      updated_at: createdAt,
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
        created_at: createdAt,
        sent_at: createdAt,
      })
      addEvent({ parent_order_id: id, child_order_id: childId, action: 'CHILD_CREATE', old_value: null, new_value: 'CREATED', event_time: createdAt })
      addEvent({ parent_order_id: id, child_order_id: childId, action: 'CHILD_SEND', old_value: 'CREATED', new_value: child.status, event_time: createdAt })
      if (child.filled > 0) {
        const matchId = `M-SEED-${index + 1}${childIndex + 1}`
        executions.push({
          execution_id: `X-${matchId}`,
          child_order_id: childId,
          parent_order_id: id,
          exchange_match_id: matchId,
          price: child.price,
          qty: child.filled,
          match_time: createdAt,
        })
        addEvent({ parent_order_id: id, child_order_id: childId, action: 'FILL', old_value: null, new_value: child.status, event_time: createdAt })
      }
    })

    if (seed.status !== 'ACTIVE') {
      addEvent({ parent_order_id: id, child_order_id: null, action: 'DECISION', old_value: 'ACTIVE', new_value: seed.status, event_time: createdAt })
    }
  })

  return { orders, parameters, conditions, children, executions, snapshots, events }
}
