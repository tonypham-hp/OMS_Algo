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

  describe('khớp định kỳ ATO, ATC', () => {
    const ONE_SYMBOL = [{ symbol: 'TEST', ref_price: 100_000 }]
    const quoteOf = (simulator: ReturnType<typeof createMarketSimulator>) => simulator.getState().quotes[0]

    function tickUntil(simulator: ReturnType<typeof createMarketSimulator>, session: string) {
      while (simulator.getState().session !== session) simulator.tick(1000)
    }

    it('trong ATO chỉ giá dự kiến đổi, giá khớp và KL đứng yên', () => {
      const simulator = createMarketSimulator({ random: seededRandom(10), symbols: ONE_SYMBOL })
      const seen = new Set<number>()
      for (let index = 0; index < 100; index += 1) {
        simulator.tick(1000)
        const quote = quoteOf(simulator)
        expect(quote.last_price).toBe(100_000)
        expect(quote.total_volume).toBe(0)
        expect(quote.last_qty).toBe(0)
        expect(quote.indicative_price).not.toBeNull()
        expect(isValidTick(quote.indicative_price as number)).toBe(true)
        expect(quote.indicative_price).toBeLessThanOrEqual(quote.ceiling_price)
        expect(quote.indicative_price).toBeGreaterThanOrEqual(quote.floor_price)
        seen.add(quote.indicative_price as number)
      }
      expect(seen.size).toBeGreaterThan(1)
    })

    it.each([1, 10, 60] as const)('x%i: khớp một lần đúng 09:15:00 theo giá dự kiến', (speed) => {
      const simulator = createMarketSimulator({ random: seededRandom(11), symbols: ONE_SYMBOL })
      simulator.setSpeed(speed)
      simulator.tick(1000)
      let indicative = quoteOf(simulator).indicative_price
      while (simulator.getState().session === 'ATO') {
        indicative = quoteOf(simulator).indicative_price
        simulator.tick(1000)
      }

      const matched = quoteOf(simulator)
      expect(simulator.getState().sim_seconds).toBe(9 * 3600 + 15 * 60)
      expect(matched.last_price).toBe(indicative)
      expect(matched.indicative_price).toBeNull()
      expect(matched.total_volume).toBe(matched.last_qty)
      expect(matched.total_volume).toBeGreaterThan(0)
    })

    it('trong ATC KL đứng yên, khớp một lần đúng 14:45:00, sau đó không đổi gì nữa', () => {
      const simulator = createMarketSimulator({ random: seededRandom(12), symbols: ONE_SYMBOL })
      simulator.setSpeed(60)
      tickUntil(simulator, 'ATC')
      const before = quoteOf(simulator)
      expect(before.indicative_price).not.toBeNull()

      let indicative = before.indicative_price
      while (simulator.getState().session === 'ATC') {
        indicative = quoteOf(simulator).indicative_price
        expect(quoteOf(simulator).total_volume).toBe(before.total_volume)
        expect(quoteOf(simulator).last_price).toBe(before.last_price)
        simulator.tick(1000)
      }

      const matched = quoteOf(simulator)
      expect(simulator.getState().session).toBe('CLOSED')
      expect(simulator.getState().sim_seconds).toBe(14 * 3600 + 45 * 60)
      expect(matched.last_price).toBe(indicative)
      expect(matched.total_volume).toBe(before.total_volume + matched.last_qty)

      simulator.tick(1000)
      expect(quoteOf(simulator)).toEqual({ ...matched, tick_direction: 0 })
    })

    it('phiên liên tục và nghỉ trưa không có giá dự kiến', () => {
      const simulator = createMarketSimulator({ random: seededRandom(13), symbols: ONE_SYMBOL })
      simulator.setSpeed(60)
      tickUntil(simulator, 'CONTINUOUS')
      expect(quoteOf(simulator).indicative_price).toBeNull()
      tickUntil(simulator, 'LUNCH')
      expect(quoteOf(simulator).indicative_price).toBeNull()
    })
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
