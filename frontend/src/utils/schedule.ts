import { QTY_LOT_SIZE } from '@/config/hose'

/** VWAP chia khung giờ thành các chu kỳ 5 phút. */
export const VWAP_CYCLE_SECONDS = 300

function roundUpToLot(numerator: number, denominator: number) {
  return Math.ceil(numerator / (denominator * QTY_LOT_SIZE)) * QTY_LOT_SIZE
}

/** KL lũy kế phải đạt đến chu kỳ `index`, chia theo tỷ trọng. Luôn là bội số lô, chu kỳ cuối bằng total. */
function getScheduleTarget(totalQty: number, weights: number[], index: number) {
  const last = weights.length - 1
  if (index >= last) return totalQty
  const sumAll = weights.reduce((sum, weight) => sum + weight, 0)
  const sumDone = weights.slice(0, index + 1).reduce((sum, weight) => sum + weight, 0)
  return Math.min(totalQty, roundUpToLot(totalQty * sumDone, sumAll))
}

export function getCycleCount(windowSeconds: number, cycleSeconds: number) {
  return Math.max(1, Math.floor(windowSeconds / cycleSeconds))
}

export function getTwapTarget(totalQty: number, windowSeconds: number, intervalSeconds: number, elapsedSeconds: number) {
  const cycles = getCycleCount(windowSeconds, intervalSeconds)
  const index = Math.floor(elapsedSeconds / intervalSeconds)
  return getScheduleTarget(totalQty, Array<number>(cycles).fill(1), index)
}

export function getVwapTarget(totalQty: number, windowSeconds: number, elapsedSeconds: number) {
  const cycles = getCycleCount(windowSeconds, VWAP_CYCLE_SECONDS)
  // Tỷ trọng hình chữ U: hai đầu khung giờ nhiều gấp 3 lần ở giữa, mô phỏng thanh khoản trong ngày.
  const weights = Array.from({ length: cycles }, (_, cycle) => {
    const position = (cycle + 0.5) / cycles
    return 1 + 2 * Math.abs(2 * position - 1)
  })
  return getScheduleTarget(totalQty, weights, Math.floor(elapsedSeconds / VWAP_CYCLE_SECONDS))
}
