import type { GlossaryContext } from '@/config/glossary'
import type { OrderDetailData, ParentOrder } from '@/types'
import { getExecQuality } from '@/utils/execQuality'

/** Số của lệnh đang xem cho ví dụ trong tooltip thuật ngữ. Chưa tải xong thì chỉ có phần đã biết. */
export function getTermExample(
  order: ParentOrder | undefined,
  detail: OrderDetailData | undefined,
  refPrice: number | null,
): GlossaryContext {
  if (!order) return {}
  const quality = detail ? getExecQuality(order, detail.children, detail.executions, detail.snapshot, detail.market) : null
  return {
    symbol: order.symbol,
    side: order.side,
    ref_price: refPrice,
    limit_price: order.limit_price,
    total_qty: order.total_qty,
    executed_qty: order.executed_qty,
    avg_price: quality?.avgPrice ?? null,
    arrival_price: quality?.arrivalPrice ?? null,
    vwap: quality?.vwap ?? null,
    arrival_bps: quality?.arrivalBps ?? null,
    market_volume: quality?.marketVolume ?? null,
  }
}
