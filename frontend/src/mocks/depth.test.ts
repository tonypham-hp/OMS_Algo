import { describe, expect, it } from 'vitest'
import type { OrderBookDepth, SymbolQuote } from '@/types'
import { getCeilingPrice, getFloorPrice, getTickSize, stepPrice } from '@/utils/hose'
import {
  consumeLevel,
  createDepthRandom,
  DEPTH_LEVELS,
  generateDepth,
  OWN_TAKEN_TICKS,
  rebaseDepth,
  replenishDepth,
  validateDepth,
} from './depth'
import { createMarketSimulator } from './simulator'

function quoteAt(ref: number, last = ref): SymbolQuote {
  const ceiling = getCeilingPrice(ref)
  const floor = getFloorPrice(ref)
  return {
    symbol: 'TEST',
    ref_price: ref,
    ceiling_price: ceiling,
    floor_price: floor,
    last_price: last,
    indicative_price: null,
    last_qty: 0,
    total_volume: 0,
    bid_price: Math.max(stepPrice(last, -1), floor),
    ask_price: Math.min(stepPrice(last, 1), ceiling),
    tick_direction: 0,
  }
}

describe('sinh sổ lệnh 3 mức', () => {
  // Ba vùng bước giá HOSE: dưới 10.000 bước 10, 10.000–49.950 bước 50, từ 50.000 bước 100.
  it.each([
    [8_000, 10],
    [27_500, 50],
    [118_000, 100],
  ])('giá %i: đúng bước giá %i, trong trần – sàn, KL bội 100, bán 1 > mua 1', (ref, tick) => {
    const quote = quoteAt(ref)
    const depth = generateDepth(quote, createDepthRandom(1))
    expect(depth.asks).toHaveLength(DEPTH_LEVELS)
    expect(depth.bids).toHaveLength(DEPTH_LEVELS)
    expect(validateDepth(depth, quote)).toEqual([])
    for (const level of [...depth.asks, ...depth.bids]) {
      expect(getTickSize(level.price)).toBe(tick)
      expect(level.price % tick).toBe(0)
      expect(level.qty % 100).toBe(0)
    }
    expect(depth.asks[0].price).toBeGreaterThan(depth.bids[0].price)
    // Các mức cách nhau đúng 1 bước giá.
    expect(depth.asks[1].price - depth.asks[0].price).toBe(tick)
    expect(depth.bids[0].price - depth.bids[1].price).toBe(tick)
  })

  it('qua ngưỡng 50.000: mức bán đi 49.950 → 50.000 → 50.100', () => {
    const quote = { ...quoteAt(49_900), ask_price: 49_950, bid_price: 49_900 }
    const depth = generateDepth(quote, createDepthRandom(2))
    expect(depth.asks.map((level) => level.price)).toEqual([49_950, 50_000, 50_100])
  })

  it('sát trần: không sinh mức vượt trần, vẫn hợp lệ', () => {
    const base = quoteAt(27_500)
    const quote = { ...base, last_price: base.ceiling_price, bid_price: stepPrice(base.ceiling_price, -1), ask_price: base.ceiling_price }
    const depth = generateDepth(quote, createDepthRandom(3))
    expect(depth.asks.every((level) => level.price <= quote.ceiling_price)).toBe(true)
    expect(depth.asks).toHaveLength(1)
    expect(validateDepth(depth, quote)).toEqual([])
  })

  it('bộ giả lập: mọi mã luôn có sổ lệnh hợp lệ qua nhiều nhịp', () => {
    let seed = 7
    const simulator = createMarketSimulator({
      random: () => {
        seed = (seed * 16_807) % 2_147_483_647
        return seed / 2_147_483_647
      },
    })
    simulator.setSpeed(60)
    for (let index = 0; index < 400; index += 1) {
      simulator.tick()
      for (const quote of simulator.getState().quotes) {
        expect(quote.depth).toBeDefined()
        expect(validateDepth(quote.depth as OrderBookDepth, quote)).toEqual([])
      }
    }
  })
})

describe('khớp làm giảm KL của mức', () => {
  const quote = quoteAt(27_500, 27_600)
  const depth: OrderBookDepth = {
    asks: [
      { price: 27_650, qty: 6_400 },
      { price: 27_700, qty: 9_800 },
      { price: 27_750, qty: 3_000 },
    ],
    bids: [
      { price: 27_550, qty: 5_000 },
      { price: 27_500, qty: 4_000 },
      { price: 27_450, qty: 3_000 },
    ],
  }

  it('lấy một phần: KL mức giảm đúng phần đã lấy, ghi phần mình lấy', () => {
    const result = consumeLevel(depth, 'asks', 27_700, 1_600, quote, createDepthRandom(1))
    expect(result.taken).toBe(1_600)
    expect(result.depth.asks[1]).toMatchObject({ price: 27_700, qty: 8_200, own_taken: 1_600 })
    expect(result.depth.asks[0]).toEqual(depth.asks[0])
  })

  it('không bao giờ lấy quá KL đang có ở mức', () => {
    const result = consumeLevel(depth, 'asks', 27_650, 10_000, quote, createDepthRandom(1))
    expect(result.taken).toBe(6_400)
  })

  it('mức hết KL: các mức sau dồn lên và sinh mức mới phía sau', () => {
    const result = consumeLevel(depth, 'asks', 27_650, 6_400, quote, createDepthRandom(1))
    expect(result.depth.asks.map((level) => level.price)).toEqual([27_700, 27_750, 27_800])
    expect(result.depth.asks[0].qty).toBe(9_800)
    expect(validateDepth(result.depth, quote)).toEqual([])
  })

  it('phía mua đối xứng: hết mức mua 1 thì mua 2 lên thay, sinh mức thấp hơn phía sau', () => {
    const result = consumeLevel(depth, 'bids', 27_550, 5_000, quote, createDepthRandom(1))
    expect(result.depth.bids.map((level) => level.price)).toEqual([27_500, 27_450, 27_400])
  })

  it('mức không có trong sổ lệnh: không lấy gì', () => {
    expect(consumeLevel(depth, 'asks', 28_000, 100, quote, createDepthRandom(1)).taken).toBe(0)
  })

  it('thị trường bổ sung KL dần, dấu KL của mình tự xóa sau vài nhịp', () => {
    let current = consumeLevel(depth, 'asks', 27_700, 1_600, quote, createDepthRandom(1)).depth
    const random = createDepthRandom(5)
    const before = current.asks.reduce((sum, level) => sum + level.qty, 0)
    for (let index = 0; index < OWN_TAKEN_TICKS; index += 1) current = replenishDepth(current, random)
    const after = current.asks.reduce((sum, level) => sum + level.qty, 0)
    expect(after).toBeGreaterThanOrEqual(before)
    expect(current.asks.every((level) => level.qty % 100 === 0)).toBe(true)
    expect(current.asks.some((level) => level.own_taken !== undefined)).toBe(false)
  })

  it('giá đổi: neo lại theo mua 1, bán 1 mới, giữ KL của mức còn hợp lệ', () => {
    const moved = { ...quote, last_price: 27_650, bid_price: 27_600, ask_price: 27_700 }
    const rebased = rebaseDepth(depth, moved, createDepthRandom(1))
    expect(rebased.asks[0]).toEqual({ price: 27_700, qty: 9_800 })
    expect(rebased.bids[0].price).toBe(27_600)
    expect(rebased.bids.some((level) => level.price === 27_550 && level.qty === 5_000)).toBe(true)
    expect(validateDepth(rebased, moved)).toEqual([])
  })
})
