// Bước giá, trần/sàn theo gói luật và loại chứng khoán. Hàm thuần, mọi số lấy từ pack.
import type { Side } from '@/types'
import type { RulePack, SecType } from './types'

export function getTickSize(price: number, secType: SecType, rules: RulePack): number {
  const table = rules.tickTable[secType]
  const rule = table.find((item) => item.below === null || price < item.below)
  return (rule ?? table[table.length - 1]).tick
}

export function isValidTick(price: number, secType: SecType, rules: RulePack): boolean {
  return Number.isInteger(price) && price > 0 && price % getTickSize(price, secType, rules) === 0
}

/**
 * Dịch `steps` bước giá. Đi từng bước một vì bước giá đổi khi qua ngưỡng (49.950 → 50.000 → 50.100).
 * Bước xuống dùng bước giá của mức phía dưới: 50.000 xuống 49.950.
 */
export function stepPrice(price: number, steps: number, secType: SecType, rules: RulePack): number {
  let result = price
  for (let index = 0; index < Math.abs(steps); index += 1) {
    result = steps > 0 ? result + getTickSize(result, secType, rules) : result - getTickSize(result - 1, secType, rules)
  }
  return result
}

export function roundToTick(price: number, direction: 'down' | 'up', secType: SecType, rules: RulePack): number {
  const tick = getTickSize(price, secType, rules)
  return direction === 'down' ? Math.floor(price / tick) * tick : Math.ceil(price / tick) * tick
}

export function countTicks(from: number, to: number, secType: SecType, rules: RulePack): number {
  let count = 0
  let price = from
  const direction = to >= from ? 1 : -1
  while (direction > 0 ? price < to : price > to) {
    price = stepPrice(price, direction, secType, rules)
    count += direction
  }
  return count
}

export function bandPct(rules: RulePack, firstDay = false): number {
  return firstDay ? rules.priceBand.firstDay : rules.priceBand.normal
}

export interface PriceLimits {
  ceiling: number
  /** Giá sàn hiển thị: chứng quyền có thể là 0. */
  floor: number
  /** Giá thấp nhất được đặt: max(sàn, giá tối thiểu của pack). */
  minOrderPrice: number
  bandPct: number
}

export interface PriceLimitOptions {
  firstDay?: boolean
  /** Chứng quyền: trần/sàn theo biên độ của tài sản cơ sở chia tỷ lệ chuyển đổi. */
  cw?: { ratio: number; underlyingRef: number; underlyingCeiling: number; underlyingFloor: number }
}

/**
 * Trần = tham chiếu × (1 + biên) làm tròn XUỐNG theo bước giá; sàn = tham chiếu × (1 − biên) làm tròn LÊN.
 * Như vậy trần, sàn luôn đúng bước giá và không vượt biên độ.
 * Chứng quyền: trần/sàn = tham chiếu ± (khoảng trần/sàn của tài sản cơ sở) / tỷ lệ; sàn âm hiển thị 0.
 */
export function priceLimits(ref: number, secType: SecType, rules: RulePack, options: PriceLimitOptions = {}): PriceLimits {
  const pct = bandPct(rules, options.firstDay)
  let rawCeiling: number
  let rawFloor: number
  if (secType === 'CW' && options.cw) {
    const { ratio, underlyingRef, underlyingCeiling, underlyingFloor } = options.cw
    rawCeiling = Math.floor(ref + (underlyingCeiling - underlyingRef) / ratio)
    rawFloor = Math.ceil(ref - (underlyingRef - underlyingFloor) / ratio)
  } else {
    rawCeiling = Math.floor((ref * (100 + pct)) / 100)
    rawFloor = Math.ceil((ref * (100 - pct)) / 100)
  }
  const ceiling = roundToTick(rawCeiling, 'down', secType, rules)
  const floor = rawFloor <= 0 ? 0 : roundToTick(rawFloor, 'up', secType, rules)
  return { ceiling, floor, minOrderPrice: Math.max(floor, rules.minPrice), bandPct: pct }
}

/**
 * Phần chưa khớp của MTL chuyển thành LO: mua tại giá khớp gần nhất + 1 bước, bán − 1 bước,
 * kẹp trong trần/sàn.
 */
export function mtlRemainderPrice(
  lastFill: number,
  side: Side,
  secType: SecType,
  rules: RulePack,
  limits?: { ceiling: number; floor: number },
): number {
  const price = stepPrice(lastFill, side === 'BUY' ? 1 : -1, secType, rules)
  if (!limits) return price
  return Math.min(Math.max(price, limits.floor), limits.ceiling)
}
