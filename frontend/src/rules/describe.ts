// Câu mô tả luật sinh từ pack, để chữ trên giao diện luôn khớp số trong cấu hình.
import { formatNumber } from '@/lib/format'
import type { TickRule } from './types'

/** [{below:10000,tick:10},{below:50000,tick:50},{below:null,tick:100}] → "dưới 10.000 đ bước 10 đ; từ 10.000 đ tới dưới 50.000 đ bước 50 đ; từ 50.000 đ trở lên bước 100 đ". */
export function describeTickTable(table: readonly TickRule[]): string {
  if (table.length === 1) return `bước ${formatNumber(table[0].tick)} đ mọi mức giá`
  let from: number | null = null
  const parts = table.map((rule) => {
    const tick = `bước ${formatNumber(rule.tick)} đ`
    let text: string
    if (rule.below === null) text = `từ ${formatNumber(from ?? 0)} đ trở lên ${tick}`
    else if (from === null) text = `dưới ${formatNumber(rule.below)} đ ${tick}`
    else text = `từ ${formatNumber(from)} đ tới dưới ${formatNumber(rule.below)} đ ${tick}`
    from = rule.below
    return text
  })
  return parts.join('; ')
}
