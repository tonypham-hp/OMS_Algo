import { formatStrategyFieldValue, STRATEGIES } from '@/config/strategies'
import type { ChildOrder, Execution, MarketSnapshot, ParentOrder, StrategyParameter } from '@/types'

/**
 * Các lần khớp của lệnh vào. Lệnh thoát của Bracket đi ngược chiều lệnh cha và không cộng vào
 * executed_qty, nên không được tính vào KL lũy kế hay giá bình quân của lệnh.
 */
export function getEntryExecutions(order: ParentOrder, children: ChildOrder[], executions: Execution[]) {
  const exitChildIds = new Set(
    children.filter((child) => child.side !== order.side).map((child) => child.child_order_id),
  )
  return executions.filter((execution) => !exitChildIds.has(execution.child_order_id))
}

export interface FillSummary {
  /** Giá bình quân khớp, chưa làm tròn. null khi chưa khớp. */
  avgPrice: number | null
  arrivalPrice: number | null
  /** (giá BQ − arrival) / arrival, theo bps. Dương là giá BQ cao hơn arrival. */
  differenceBps: number | null
  /** Có lợi: mua thấp hơn hoặc bán cao hơn arrival. null khi chưa tính được hoặc bằng arrival. */
  isFavorable: boolean | null
}

export function getFillSummary(
  order: ParentOrder,
  children: ChildOrder[],
  executions: Execution[],
  snapshot: MarketSnapshot | null,
): FillSummary {
  const fills = getEntryExecutions(order, children, executions)
  const qty = fills.reduce((sum, fill) => sum + fill.qty, 0)
  // Giá là số nguyên đồng: tính trên tổng tiền để không cộng dồn sai số của giá đã chia.
  const notional = fills.reduce((sum, fill) => sum + fill.price * fill.qty, 0)
  const arrivalPrice = snapshot?.arrival_price ?? null
  const avgPrice = qty > 0 ? notional / qty : null
  if (avgPrice === null || arrivalPrice === null) {
    return { avgPrice, arrivalPrice, differenceBps: null, isFavorable: null }
  }

  const gap = notional - arrivalPrice * qty
  return {
    avgPrice,
    arrivalPrice,
    differenceBps: (gap * 10_000) / (arrivalPrice * qty),
    isFavorable: gap === 0 ? null : order.side === 'BUY' ? gap < 0 : gap > 0,
  }
}

export interface StrategyParamRow {
  label: string
  value: string
}

/** Tham số của lệnh theo đúng khai báo của loại lệnh, đã định dạng để hiển thị. */
export function getStrategyParamRows(order: ParentOrder, parameters: StrategyParameter[]): StrategyParamRow[] {
  return STRATEGIES[order.strategy_type].fields.map((field) => {
    const raw =
      field.name === 'limit_price'
        ? order.limit_price
        : parameters.find((parameter) => parameter.parameter_code === field.name)?.parameter_value
    if (raw === null || raw === undefined) return { label: field.label, value: field.optional ? 'Mặc định' : '—' }
    return { label: field.label, value: formatStrategyFieldValue(field, raw) }
  })
}
