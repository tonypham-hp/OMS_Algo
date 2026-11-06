import { formatClock } from '@/lib/format'
import type { ChildOrder, Execution, ParentOrder, StrategyParameter } from '@/types'
import { parseTimeToSeconds } from '@/utils/hose'
import { isTerminalStatus } from '@/utils/orderActions'
import { getCycleCount, getTwapTarget, getVwapTarget, VWAP_CYCLE_SECONDS } from '@/utils/schedule'
import { getEntryExecutions } from './orderMetrics'

const MINUTE_MS = 60_000
const DAY_MS = 1_440 * MINUTE_MS
const MAX_TICKS = 6
const TICK_STEPS_MINUTES = [1, 5, 10, 15, 30, 60, 120, 360, 720, 1_440]

export interface ProgressRow {
  /** Thời điểm, tính bằng mili giây. */
  time: number
  /** null sau thời điểm hiện tại: tương lai chưa có thực tế. */
  actual: number | null
  /** null trước khung giờ của kế hoạch, và với loại lệnh không có kế hoạch. */
  plan: number | null
}

export interface OrderProgress {
  rows: ProgressRow[]
  hasPlan: boolean
  /** KL đã khớp trước điểm đầu biểu đồ (lệnh nhiều phiên), đường thực tế xuất phát từ đây. */
  startingQty: number
  /** KL kế hoạch phải đạt tới hiện tại. null khi không có kế hoạch hoặc chưa tới khung giờ. */
  plannedQty: number | null
  /** Đã có lần khớp nào của lệnh vào chưa. */
  hasFills: boolean
}

interface ProgressInput {
  order: ParentOrder
  parameters: StrategyParameter[]
  children: ChildOrder[]
  executions: Execution[]
  /** Ngày và giờ giả lập hiện tại. Với lệnh đã kết thúc thì không dùng tới. */
  tradingDate: string
  simSeconds: number
}

interface PlanStep {
  time: number
  qty: number
}

const toMs = (dateTime: string) => Date.parse(dateTime)
const atSeconds = (date: string, seconds: number) => toMs(`${date}T${formatClock(seconds)}`)

/**
 * Lịch của TWAP, VWAP trong ngày `date`, tính đúng như engine: chia phần KL còn lại lúc đầu ngày
 * (total_qty − đã khớp từ các ngày trước), bắt đầu mỗi chu kỳ thì KL phải đạt tăng lên một bậc.
 */
function getPlanSteps(order: ParentOrder, parameters: StrategyParameter[], date: string, baseQty: number): PlanStep[] {
  if (order.strategy_type !== 'TWAP' && order.strategy_type !== 'VWAP') return []
  const param = (code: string) => parameters.find((item) => item.parameter_code === code)?.parameter_value ?? ''
  const start = parseTimeToSeconds(param('start_time'))
  const end = parseTimeToSeconds(param('end_time'))
  const planQty = order.total_qty - baseQty
  if (start === null || end === null || end <= start || planQty <= 0) return []

  const windowSeconds = end - start
  const intervalSeconds = Number(param('interval_min')) * 60
  const isTwap = order.strategy_type === 'TWAP'
  if (isTwap && intervalSeconds <= 0) return []
  const cycleSeconds = isTwap ? intervalSeconds : VWAP_CYCLE_SECONDS

  const steps = Array.from({ length: getCycleCount(windowSeconds, cycleSeconds) }, (_, cycle) => {
    const elapsed = cycle * cycleSeconds
    const target = isTwap
      ? getTwapTarget(planQty, windowSeconds, intervalSeconds, elapsed)
      : getVwapTarget(planQty, windowSeconds, elapsed)
    return { time: atSeconds(date, start + elapsed), qty: baseQty + target }
  })
  return [...steps, { time: atSeconds(date, end), qty: order.total_qty }]
}

/**
 * Dữ liệu biểu đồ KL khớp lũy kế. Mỗi dòng có đủ cả hai đường để tooltip luôn so sánh được.
 * TWAP, VWAP chỉ vẽ khung giờ của một ngày: ngày hiện tại, hoặc ngày kết thúc nếu lệnh đã kết thúc.
 */
export function buildOrderProgress(input: ProgressInput): OrderProgress {
  const { order, parameters, children, executions, tradingDate, simSeconds } = input
  const fills = getEntryExecutions(order, children, executions)
    .map((fill) => ({ time: toMs(fill.match_time), qty: fill.qty }))
    .sort((a, b) => a.time - b.time)

  const useClock = !isTerminalStatus(order.status) && tradingDate !== ''
  const planDate = useClock ? tradingDate : order.updated_at.slice(0, 10)
  const lastFillTime = fills.at(-1)?.time ?? Number.NEGATIVE_INFINITY
  const until = Math.max(useClock ? atSeconds(tradingDate, simSeconds) : toMs(order.updated_at), lastFillTime)

  const dayStart = toMs(`${planDate}T00:00:00`)
  const baseQty = fills.filter((fill) => fill.time < dayStart).reduce((sum, fill) => sum + fill.qty, 0)
  const steps = getPlanSteps(order, parameters, planDate, baseQty)
  const hasPlan = steps.length > 0
  const firstTime = hasPlan ? steps[0].time : toMs(order.created_at)
  const lastPlanTime = hasPlan ? steps[steps.length - 1].time : Number.POSITIVE_INFINITY

  const startingQty = fills.filter((fill) => fill.time < firstTime).reduce((sum, fill) => sum + fill.qty, 0)
  const shownFills = fills.filter((fill) => fill.time >= firstTime)

  const times = new Set([firstTime, ...steps.map((step) => step.time), ...shownFills.map((fill) => fill.time)])
  // Thêm mốc "hiện tại" để đường thực tế chạy tới đó, nhưng không kéo dài trục quá hết kế hoạch.
  if (until >= firstTime) times.add(Math.min(until, Math.max(lastPlanTime, lastFillTime)))

  let plan: number | null = null
  let actual = startingQty
  let stepIndex = 0
  let fillIndex = 0
  const rows = [...times]
    .sort((a, b) => a - b)
    .map((time) => {
      while (stepIndex < steps.length && steps[stepIndex].time <= time) plan = steps[stepIndex++].qty
      while (fillIndex < shownFills.length && shownFills[fillIndex].time <= time) actual += shownFills[fillIndex++].qty
      return { time, plan, actual: time <= until ? actual : null }
    })

  const plannedQty = steps.filter((step) => step.time <= until).at(-1)?.qty ?? null
  return { rows, hasPlan, startingQty, plannedQty, hasFills: fills.length > 0 }
}

/** Các mốc trục thời gian rơi vào giờ tròn (mỗi 15 phút, mỗi giờ...), tối đa khoảng 6 mốc. */
export function getTimeTicks(min: number, max: number): number[] {
  if (max <= min) return [min]
  const span = max - min
  const stepMinutes =
    TICK_STEPS_MINUTES.find((minutes) => span / (minutes * MINUTE_MS) <= MAX_TICKS) ?? TICK_STEPS_MINUTES.at(-1)!
  const step = stepMinutes * MINUTE_MS
  // Làm tròn theo giờ địa phương, không theo UTC: nếu không, mốc "mỗi ngày" sẽ rơi vào 07:00.
  const offset = new Date(min).getTimezoneOffset() * MINUTE_MS
  const first = Math.ceil((min - offset) / step) * step + offset
  const ticks: number[] = []
  for (let tick = first; tick <= max; tick += step) ticks.push(tick)
  return ticks.length >= 2 ? ticks : [min, max]
}

/** Nhãn trục thời gian: nhiều ngày thì có ngày, khoảng rất ngắn thì có giây. */
export function formatTimeTick(time: number, spanMs: number): string {
  const date = new Date(time)
  const clock = formatClock(date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds())
  if (spanMs >= DAY_MS / 2) {
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${clock.slice(0, 5)}`
  }
  return spanMs < 5 * MINUTE_MS ? clock : clock.slice(0, 5)
}
