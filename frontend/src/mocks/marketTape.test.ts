import { describe, expect, it } from 'vitest'
import type { MarketTrade } from '@/types'
import { createMarketTape } from './marketTape'
import { createMarketSimulator } from './simulator'

const trade = (date: string, clock: string, qty = 100, symbol = 'FPT'): MarketTrade => ({
  symbol,
  time: `${date}T${clock}`,
  price: 100_000,
  qty,
})

describe('băng tick khớp thị trường', () => {
  it('lọc theo mã và khoảng thời gian, giữ thứ tự thời gian kể cả khi tick đến lệch', () => {
    const tape = createMarketTape()
    tape.record([trade('2026-11-10', '10:00:00'), trade('2026-11-10', '10:00:00', 200, 'HPG')])
    tape.record([trade('2026-11-10', '09:30:00', 300)])
    expect(tape.list('FPT', '2026-11-10T09:00:00', '2026-11-10T11:00:00').map((item) => item.qty)).toEqual([300, 100])
    expect(tape.list('FPT', '2026-11-10T09:45:00', '2026-11-10T11:00:00')).toHaveLength(1)
    expect(tape.list('VNM', '2026-11-10T09:00:00', '2026-11-10T11:00:00')).toEqual([])
  })

  it('chỉ giữ 5 ngày giao dịch gần nhất và không vượt trần số tick', () => {
    const tape = createMarketTape({ maxTrades: 4 })
    for (const date of ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10']) {
      tape.record([trade(date, '10:00:00')])
    }
    expect(tape.list('FPT', '2026-11-01T00:00:00', '2026-11-30T00:00:00').map((item) => item.time.slice(0, 10))).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-09',
      '2026-11-10',
    ])
    expect(tape.size()).toBe(4)
  })

  it('lưu rồi nạp lại đúng dữ liệu', () => {
    const tape = createMarketTape()
    tape.record([trade('2026-11-10', '10:00:00'), trade('2026-11-10', '10:00:05', 500, 'HPG')])
    const copy = createMarketTape()
    copy.importState(JSON.parse(JSON.stringify(tape.exportState())))
    expect(copy.exportState()).toEqual(tape.exportState())
  })
})

describe('bộ giả lập phát tick khớp', () => {
  it('mỗi tick khớp ứng đúng phần KL tăng thêm của mã, tổng bằng total_volume', () => {
    let seed = 7
    const random = () => {
      seed = (seed * 16_807) % 2_147_483_647
      return seed / 2_147_483_647
    }
    const simulator = createMarketSimulator({ random, startDate: new Date(2026, 10, 10) })
    const trades: MarketTrade[] = []
    simulator.onTrades((items) => trades.push(...items))
    simulator.setSpeed(60)
    for (let index = 0; index < 120; index += 1) simulator.tick()

    expect(trades.length).toBeGreaterThan(0)
    for (const quote of simulator.getState().quotes) {
      const total = trades.filter((item) => item.symbol === quote.symbol).reduce((sum, item) => sum + item.qty, 0)
      expect(total).toBe(quote.total_volume)
    }
    expect(trades.every((item) => item.time.startsWith('2026-11-10T'))).toBe(true)
  })
})
