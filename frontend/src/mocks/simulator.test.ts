import { describe, expect, it } from 'vitest'
import { isValidTick } from '@/utils/hose'
import { createMarketSimulator } from './simulator'

/** Hàm random có seed (mulberry32) để test luôn cho cùng một kết quả. */
function seededRandom(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('bộ giả lập giá', () => {
  it('giá luôn là số nguyên, đúng bước giá và trong biên độ', () => {
    const simulator = createMarketSimulator({ random: seededRandom(1) })
    for (let index = 0; index < 3000; index += 1) {
      simulator.tick()
      for (const quote of simulator.getState().quotes) {
        expect(Number.isInteger(quote.last_price)).toBe(true)
        expect(isValidTick(quote.last_price)).toBe(true)
        expect(quote.last_price).toBeLessThanOrEqual(quote.ceiling_price)
        expect(quote.last_price).toBeGreaterThanOrEqual(quote.floor_price)
      }
      // Đặt lại khi hết ngày để toàn bộ vòng lặp đều có giá nhảy.
      if (simulator.getState().session === 'CLOSED') simulator.reset()
    }
  })

  it('đúng bước giá khi đi qua ngưỡng 50.000', () => {
    const simulator = createMarketSimulator({
      random: seededRandom(2),
      symbols: [{ symbol: 'TEST', ref_price: 50_000 }],
    })
    const seen = new Set<number>()
    for (let index = 0; index < 2000; index += 1) {
      simulator.tick()
      const price = simulator.getState().quotes[0].last_price
      seen.add(price)
      expect(isValidTick(price)).toBe(true)
      if (simulator.getState().session === 'CLOSED') simulator.reset()
    }
    expect([...seen].some((price) => price < 50_000)).toBe(true)
    expect([...seen].some((price) => price > 50_000)).toBe(true)
  })

  it('tốc độ x60 tua đồng hồ nhanh gấp 60 lần', () => {
    const simulator = createMarketSimulator({ random: seededRandom(3) })
    const start = simulator.getState().sim_seconds
    simulator.setSpeed(60)
    simulator.tick(1000)
    expect(simulator.getState().sim_seconds).toBe(start + 60)
  })

  it('bắt đầu ở ATO và chuyển sang phiên liên tục sau 09:15', () => {
    const simulator = createMarketSimulator({ random: seededRandom(4) })
    expect(simulator.getState().session).toBe('ATO')
    simulator.setSpeed(60)
    for (let index = 0; index < 5; index += 1) simulator.tick(1000)
    expect(simulator.getState().session).toBe('CONTINUOUS')
  })

  it('giá đứng yên khi nghỉ trưa', () => {
    const simulator = createMarketSimulator({ random: seededRandom(5) })
    simulator.setSpeed(60)
    while (simulator.getState().session !== 'LUNCH') simulator.tick(1000)
    const before = simulator.getState().quotes.map((quote) => quote.last_price)
    simulator.tick(1000)
    expect(simulator.getState().quotes.map((quote) => quote.last_price)).toEqual(before)
  })

  it('đồng hồ dừng sau giờ đóng cửa, reset đưa giá về tham chiếu', () => {
    const simulator = createMarketSimulator({ random: seededRandom(6) })
    simulator.setSpeed(60)
    for (let index = 0; index < 500; index += 1) simulator.tick(1000)
    expect(simulator.getState().session).toBe('CLOSED')
    expect(simulator.getState().sim_seconds).toBe(15 * 3600)

    simulator.reset()
    expect(simulator.getState().session).toBe('ATO')
    for (const quote of simulator.getState().quotes) {
      expect(quote.last_price).toBe(quote.ref_price)
    }
  })

  it('sang ngày mới: bỏ qua cuối tuần, giá đóng cửa thành giá tham chiếu, trần sàn tính lại', () => {
    const simulator = createMarketSimulator({
      random: seededRandom(8),
      startDate: new Date(2026, 10, 6), // Thứ Sáu.
      symbols: [{ symbol: 'TEST', ref_price: 100_000 }],
    })
    for (let index = 0; index < 400; index += 1) {
      simulator.setSpeed(60)
      simulator.tick(1000)
    }
    const close = simulator.getState().quotes[0].last_price

    simulator.nextDay()
    const state = simulator.getState()
    const quote = state.quotes[0]
    expect(state.trading_date).toBe('2026-11-09')
    expect(state.session).toBe('ATO')
    expect(quote.ref_price).toBe(close)
    expect(quote.last_price).toBe(close)
    expect(quote.total_volume).toBe(0)
    expect(isValidTick(quote.ceiling_price)).toBe(true)
    expect(quote.ceiling_price).toBeGreaterThan(close)
    expect(quote.floor_price).toBeLessThan(close)

    simulator.reset()
    expect(simulator.getState().trading_date).toBe('2026-11-06')
    expect(simulator.getState().quotes[0].ref_price).toBe(100_000)
  })

  it('xuất rồi nạp lại giữ nguyên ngày, giờ, tốc độ và giá', () => {
    const source = createMarketSimulator({ random: seededRandom(9), startDate: new Date(2026, 10, 6) })
    source.setSpeed(10)
    for (let index = 0; index < 50; index += 1) source.tick()
    source.nextDay()
    source.tick()

    const target = createMarketSimulator({ random: seededRandom(9) })
    target.importState(JSON.parse(JSON.stringify(source.exportState())))
    expect(target.getState()).toEqual(source.getState())
  })

  it('subscribe nhận ngay trạng thái hiện tại và ngừng nhận sau khi hủy', () => {
    const simulator = createMarketSimulator({ random: seededRandom(7) })
    let calls = 0
    const unsubscribe = simulator.subscribe(() => {
      calls += 1
    })
    expect(calls).toBe(1)
    simulator.tick()
    expect(calls).toBe(2)
    unsubscribe()
    simulator.tick()
    expect(calls).toBe(2)
  })
})
