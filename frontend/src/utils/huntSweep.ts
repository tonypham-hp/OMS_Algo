import { formatNumber } from '@/lib/format'
import type { BookLevel, ChildOrder, Execution, HuntSweepPlan, HuntSweepStep, Side } from '@/types'

interface PlanInput {
  side: Side
  /** Các mức phía đối ứng, mức tốt nhất trước: MUA là các mức bán tăng dần, BÁN là các mức mua giảm dần. */
  levels: BookLevel[]
  /** KL cần lấy (phần còn được phép đặt). */
  qty: number
  /** Giá tối đa (MUA) hoặc tối thiểu (BÁN). null là không giới hạn. */
  limitPrice: number | null
  /** Số mức được xét tối đa. Không truyền thì xét hết các mức. */
  maxLevels?: number
  remainderPolicy?: HuntSweepPlan['remainder_policy']
}

/** Mức giá được phép quét: MUA không vượt giá tối đa, BÁN không thấp hơn giá tối thiểu. */
export function isPriceWithinLimit(side: Side, price: number, limit: number | null) {
  if (limit === null) return true
  return side === 'BUY' ? price <= limit : price >= limit
}

/** Bảo đảm thứ tự quét từ mức tốt nhất: MUA giá tăng dần, BÁN giá giảm dần. */
function sortBestFirst(side: Side, levels: BookLevel[]) {
  return [...levels].sort((a, b) => (side === 'BUY' ? a.price - b.price : b.price - a.price))
}

/**
 * Kế hoạch quét sổ lệnh của HUNT (hàm thuần).
 * Quét lần lượt từ mức tốt nhất, không vượt giới hạn giá; mỗi mức lấy đúng KL còn lấy được (không quá KL đang có ở mức);
 * dừng khi đủ KL hoặc hết mức trong giới hạn. Mức trong giới hạn nhưng không cần dùng là UNUSED.
 */
export function planHuntSweep(input: PlanInput): HuntSweepPlan {
  const ordered = sortBestFirst(input.side, input.levels)
  const scanned = input.maxLevels === undefined ? ordered : ordered.slice(0, Math.max(0, input.maxLevels))
  let need = Math.max(0, input.qty)
  let takeQty = 0
  let value = 0
  const steps: HuntSweepStep[] = scanned.map((level) => {
    if (!isPriceWithinLimit(input.side, level.price, input.limitPrice)) {
      return { price: level.price, available: level.qty, take: 0, short_after: need, status: 'OUT_OF_LIMIT' }
    }
    if (need <= 0) return { price: level.price, available: level.qty, take: 0, short_after: 0, status: 'UNUSED' }
    const take = Math.min(level.qty, need)
    need -= take
    takeQty += take
    value += take * level.price
    return { price: level.price, available: level.qty, take, short_after: need, status: 'TAKE' }
  })
  return {
    side: input.side,
    qty: Math.max(0, input.qty),
    limit_price: input.limitPrice,
    steps,
    take_qty: takeQty,
    avg_price: takeQty > 0 ? Math.round(value / takeQty) : null,
    remainder: need,
    remainder_policy: input.remainderPolicy ?? 'WAIT',
  }
}

/** Số mức trong giới hạn giá (TAKE hoặc UNUSED). */
export function countLevelsInLimit(plan: HuntSweepPlan) {
  return plan.steps.filter((step) => step.status !== 'OUT_OF_LIMIT').length
}

export type HuntStepState = 'FILLED' | 'WORKING' | 'UNUSED' | 'OUT_OF_LIMIT' | 'CANCELLED'

export interface HuntStepView {
  step: HuntSweepStep
  index: number
  state: HuntStepState
  filledQty: number
  /** Câu mô tả: "Quét mức 27.650: lấy 6.400, còn thiếu 1.600". */
  text: string
}

export interface HuntRemainderView {
  qty: number
  policy: HuntSweepPlan['remainder_policy']
  /** Lệnh con chờ của phần còn lại (nếu đã đặt). */
  child?: ChildOrder
  text: string
}

export interface HuntSweepView {
  steps: HuntStepView[]
  remainder: HuntRemainderView | null
  /** Giá bình quân thực tế đã khớp của các lệnh quét; null nếu chưa khớp. */
  avgPrice: number | null
  filledQty: number
  /** Mức đang bị quét: lệnh con quét đầu tiên còn đang chờ khớp. */
  activePrice: number | null
}

export const HUNT_STEP_LABELS: Record<HuntStepState, string> = {
  FILLED: 'Đã khớp',
  WORKING: 'Đang chờ',
  UNUSED: 'Không cần dùng',
  OUT_OF_LIMIT: 'Vượt giới hạn giá',
  CANCELLED: 'Đã hủy',
}

const LIVE_CHILD = new Set(['CREATED', 'SENDING', 'ACKNOWLEDGED', 'PARTIAL_FILLED', 'CANCEL_PENDING', 'UNKNOWN'])

export function describeHuntStep(step: HuntSweepStep): string {
  const price = formatNumber(step.price)
  if (step.status === 'OUT_OF_LIMIT') return `Mức ${price}: vượt giới hạn giá, không quét`
  if (step.status === 'UNUSED') return `Mức ${price}: đã đủ KL, không cần dùng`
  const tail = step.short_after > 0 ? `còn thiếu ${formatNumber(step.short_after)}` : 'đủ KL'
  return `Quét mức ${price}: lấy ${formatNumber(step.take)}, ${tail}`
}

/**
 * Ghép kế hoạch quét với lệnh con và lần khớp thực tế để ra trạng thái từng bước (hàm thuần).
 * Lệnh con quét được nhận theo `child_order_id` ghi trong kế hoạch; lệnh con sinh sau đó là phần còn lại.
 */
export function deriveHuntSweepView(plan: HuntSweepPlan, children: ChildOrder[], executions: Execution[]): HuntSweepView {
  const byId = new Map(children.map((child) => [child.child_order_id, child]))
  const sweepIds = new Set(plan.steps.map((step) => step.child_order_id).filter((id): id is string => Boolean(id)))
  let activePrice: number | null = null
  const steps: HuntStepView[] = plan.steps.map((step, index) => {
    const child = step.child_order_id ? byId.get(step.child_order_id) : undefined
    let state: HuntStepState = step.status === 'TAKE' ? 'WORKING' : step.status
    const filledQty = child?.filled_qty ?? 0
    if (step.status === 'TAKE' && child) {
      if (child.status === 'FILLED') state = 'FILLED'
      else if (!LIVE_CHILD.has(child.status)) state = filledQty > 0 ? 'FILLED' : 'CANCELLED'
    }
    if (state === 'WORKING' && activePrice === null) activePrice = step.price
    return { step, index, state, filledQty, text: describeHuntStep(step) }
  })

  const sweepExecutions = executions.filter((execution) => sweepIds.has(execution.child_order_id))
  const filledQty = sweepExecutions.reduce((sum, execution) => sum + execution.qty, 0)
  const value = sweepExecutions.reduce((sum, execution) => sum + execution.qty * execution.price, 0)

  let remainder: HuntRemainderView | null = null
  if (plan.remainder > 0) {
    const sweepCreated = children.filter((child) => sweepIds.has(child.child_order_id))
    const lastSweepCycle = Math.max(0, ...sweepCreated.map((child) => child.cycle_no))
    const rest = children.find((child) => !sweepIds.has(child.child_order_id) && child.cycle_no > lastSweepCycle)
    const qty = plan.remainder
    const text =
      plan.remainder_policy === 'WAIT'
        ? rest?.price
          ? `Phần còn lại ${formatNumber(rest.quantity)}: chờ ở giá ${formatNumber(rest.price)}`
          : `Phần còn lại ${formatNumber(qty)}: chờ khi các mức quét khớp xong`
        : `Phần còn lại ${formatNumber(qty)}: hủy, không đuổi giá`
    remainder = { qty, policy: plan.remainder_policy, child: rest, text }
  }

  return { steps, remainder, avgPrice: filledQty > 0 ? Math.round(value / filledQty) : null, filledQty, activePrice }
}
