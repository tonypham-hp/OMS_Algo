import type { BookLevel, OrderBookDepth } from '@/types'
import { countTicks } from './hose'

/** Số mức mỗi phía hiển thị trên OrderBook3. */
export const DISPLAY_LEVELS = 3

/**
 * Các dòng hiển thị của sổ lệnh 3 mức (hàm thuần): phía bán đảo ngược để bán 3 ở trên cùng, bán 1 sát dòng chênh lệch;
 * phía mua giữ thứ tự mua 1 → mua 3. Thiếu mức thì chèn null để bảng luôn đủ dòng.
 */
export function buildBookRows(depth: OrderBookDepth, levels = DISPLAY_LEVELS): { asks: Array<BookLevel | null>; bids: Array<BookLevel | null> } {
  const pad = (items: BookLevel[]) => Array.from({ length: levels }, (_, index) => items[index] ?? null)
  return { asks: pad(depth.asks).reverse(), bids: pad(depth.bids) }
}

/** Chênh lệch giữa giá bán 1 và giá mua 1, bằng đồng và bằng số bước giá. null nếu thiếu một phía. */
export function getSpread(depth: OrderBookDepth): { amount: number; ticks: number } | null {
  const ask = depth.asks[0]?.price
  const bid = depth.bids[0]?.price
  if (ask === undefined || bid === undefined) return null
  return { amount: ask - bid, ticks: countTicks(bid, ask) }
}
