import { describe, expect, it } from 'vitest'
import { iso, makeChild, makeExecution, makeOrder, TODAY, YESTERDAY } from '@/test/fixtures'
import type { MarketSnapshot, MarketTrade, MarketWindowStats } from '@/types'
import {
  ALL,
  DEFAULT_REPORT_FILTERS,
  describeStrategyBps,
  filterReportRows,
  formatDiffPct,
  formatFavorableBps,
  formatParticipation,
  formatQualityPrice,
  getAvgFillPrice,
  getDiffPct,
  getExecQuality,
  getMarketVwap,
  getMarketWindow,
  getParticipation,
  getReportKpis,
  getSessionDates,
  getStrategyBps,
  isFavorable,
  sortReportRows,
  summarizeTicks,
  toFavorableBps,
  type ExecQualityRow,
} from './execQuality'

const snapshot = (price: number, at = iso(TODAY, '09:30:00')): MarketSnapshot => ({
  arrival_price: price,
  arrival_bid: price,
  arrival_ask: price,
  arrival_timestamp: at,
})

const tick = (time: string, price: number, qty: number, symbol = 'FPT'): MarketTrade => ({ symbol, time, price, qty })

describe('chênh lệch và bps: ví dụ tính tay', () => {
  it('MUA giá BQ 92.380, arrival 92.500 → −0,13%, có lợi, +13 bps', () => {
    const pct = getDiffPct(92_380, 92_500)
    expect(pct).toBeCloseTo(-0.12973, 5)
    expect(formatDiffPct(pct)).toBe('-0,13%')
    expect(isFavorable('BUY', pct)).toBe(true)
    expect(toFavorableBps('BUY', pct)).toBeCloseTo(12.973, 3)
    expect(formatFavorableBps(toFavorableBps('BUY', pct))).toBe('+13 bps')
  })

  it('BÁN giá BQ 61.400, arrival 61.500 → −0,16%, bất lợi, −16 bps', () => {
    const pct = getDiffPct(61_400, 61_500)
    expect(pct).toBeCloseTo(-0.1626, 4)
    expect(formatDiffPct(pct)).toBe('-0,16%')
    expect(isFavorable('SELL', pct)).toBe(false)
    expect(toFavorableBps('SELL', pct)).toBeCloseTo(-16.26, 2)
    expect(formatFavorableBps(toFavorableBps('SELL', pct))).toBe('-16 bps')
  })

  it('MUA cao hơn mốc là bất lợi, BÁN cao hơn mốc là có lợi; bằng mốc thì không xếp loại', () => {
    expect(isFavorable('BUY', 0.2)).toBe(false)
    expect(toFavorableBps('BUY', 0.2)).toBeCloseTo(-20)
    expect(isFavorable('SELL', 0.2)).toBe(true)
    expect(toFavorableBps('SELL', 0.2)).toBeCloseTo(20)
    expect(isFavorable('BUY', 0)).toBeNull()
  })
})

describe('giá BQ và VWAP', () => {
  it('giá BQ gia quyền theo KL, giữ nguyên phần lẻ', () => {
    // (100.000 × 300 + 100.100 × 400) / 700 = 100.057,142857…
    const avg = getAvgFillPrice([
      { price: 100_000, qty: 300 },
      { price: 100_100, qty: 400 },
    ])
    expect(avg).toBeCloseTo(100_057.142857, 5)
    expect(formatQualityPrice(avg)).toBe('100.057')
  })

  it('VWAP chỉ lấy tick trong khoảng (tính cả hai đầu)', () => {
    const ticks = [
      tick(iso(TODAY, '09:59:59'), 1_000, 10_000),
      tick(iso(TODAY, '10:00:00'), 100_000, 100),
      tick(iso(TODAY, '10:30:00'), 101_000, 300),
      tick(iso(TODAY, '11:00:00'), 102_000, 100),
      tick(iso(TODAY, '11:00:01'), 1_000, 10_000),
    ]
    const stats = summarizeTicks(ticks, iso(TODAY, '10:00:00'), iso(TODAY, '11:00:00'))
    expect(stats).toEqual({ volume: 500, value: 50_500_000 })
    expect(getMarketVwap(stats)).toBe(101_000)
  })

  it('so VWAP đúng dấu cho cả hai chiều', () => {
    const market: MarketWindowStats = { volume: 10_000, value: 1_000_000_000 } // VWAP 100.000
    const buy = makeOrder('A', { side: 'BUY' })
    const sell = makeOrder('B', { side: 'SELL' })
    const buyRow = getExecQuality(buy, [makeChild('A1', 'A')], [makeExecution('X1', 'A1', 'A', 1_000, 100_500)], snapshot(100_000), market)
    const sellRow = getExecQuality(sell, [makeChild('B1', 'B', 'FILLED', 'SELL')], [makeExecution('X2', 'B1', 'B', 1_000, 100_500)], snapshot(100_000), market)
    expect(buyRow.vsVwapPct).toBeCloseTo(0.5)
    expect(buyRow.vwapFavorable).toBe(false)
    expect(buyRow.vwapBps).toBeCloseTo(-50)
    expect(sellRow.vwapFavorable).toBe(true)
    expect(sellRow.vwapBps).toBeCloseTo(50)
  })

  it('khoảng tính: từ lúc kích hoạt tới lúc kết thúc, lệnh đang chạy tới hiện tại', () => {
    const now = iso(TODAY, '13:00:00')
    const done = makeOrder('A', { status: 'COMPLETED', updated_at: iso(TODAY, '11:00:00') })
    const live = makeOrder('B', { status: 'PARTIALLY_EXECUTED', updated_at: iso(TODAY, '11:00:00') })
    expect(getMarketWindow(done, snapshot(100_000), now)).toEqual({ from: iso(TODAY, '09:30:00'), to: iso(TODAY, '11:00:00') })
    expect(getMarketWindow(live, snapshot(100_000), now)).toEqual({ from: iso(TODAY, '09:30:00'), to: now })
    expect(getMarketWindow(live, null, now)).toBeNull()
  })
})

describe('tỷ lệ tham gia', () => {
  it('= KL lệnh / KL thị trường cùng khoảng', () => {
    expect(getParticipation(1_000, 25_000)).toBeCloseTo(0.04)
    expect(formatParticipation(getParticipation(1_000, 24_000))).toBe('4,2%')
  })

  it('không vượt 100% kể cả khi dữ liệu thị trường thiếu', () => {
    expect(getParticipation(5_000, 2_000)).toBe(1)
    expect(formatParticipation(1)).toBe('100,0%')
  })
})

describe('lệnh chưa khớp và thiếu dữ liệu', () => {
  it('không chia cho 0, mọi chỉ số là null và hiển thị "—"', () => {
    const row = getExecQuality(makeOrder('A'), [], [], snapshot(100_000), { volume: 0, value: 0 })
    expect(row.filledQty).toBe(0)
    for (const value of [row.avgPrice, row.vwap, row.vsArrivalPct, row.vsVwapPct, row.arrivalBps, row.participation]) {
      expect(value).toBeNull()
    }
    expect([formatQualityPrice(row.avgPrice), formatDiffPct(row.vsArrivalPct), formatFavorableBps(row.arrivalBps), formatParticipation(row.participation)]).toEqual(['—', '—', '—', '—'])
  })

  it('có khớp nhưng thị trường chưa có tick và chưa có arrival: chỉ có giá BQ', () => {
    const row = getExecQuality(makeOrder('A'), [makeChild('A1', 'A')], [makeExecution('X1', 'A1', 'A', 100, 100_000)], null, null)
    expect(row.avgPrice).toBe(100_000)
    expect(row.arrivalPrice).toBeNull()
    expect(row.vwap).toBeNull()
    expect(row.participation).toBeNull()
    expect(getDiffPct(100_000, 0)).toBeNull()
  })

  it('lệnh thoát của Bracket không tính vào giá BQ và KL', () => {
    const order = makeOrder('A', { strategy_type: 'BRACKET', side: 'BUY' })
    const children = [makeChild('A1', 'A', 'FILLED', 'BUY'), makeChild('A2', 'A', 'FILLED', 'SELL')]
    const executions = [makeExecution('X1', 'A1', 'A', 1_000, 100_000), makeExecution('X2', 'A2', 'A', 1_000, 110_000)]
    const row = getExecQuality(order, children, executions, snapshot(100_000), { volume: 10_000, value: 1_000_000_000 })
    expect(row.filledQty).toBe(1_000)
    expect(row.avgPrice).toBe(100_000)
  })
})

function row(id: string, overrides: Parameters<typeof makeOrder>[1], fillPrice: number | null, arrival = 100_000): ExecQualityRow {
  const order = makeOrder(id, overrides)
  const fills = fillPrice === null ? [] : [makeExecution(`X-${id}`, `${id}1`, id, 1_000, fillPrice)]
  return getExecQuality(order, [makeChild(`${id}1`, id, 'FILLED', order.side)], fills, snapshot(arrival), { volume: 20_000, value: 20_000 * arrival })
}

describe('lọc, sắp xếp, KPI', () => {
  const rows = [
    row('A', { status: 'COMPLETED', updated_at: iso(TODAY, '10:00:00'), strategy_type: 'TWAP', account_no: 'X' }, 99_000),
    row('B', { status: 'COMPLETED', updated_at: iso(YESTERDAY, '10:00:00'), strategy_type: 'POV', side: 'SELL', account_no: 'Y' }, 99_000),
    row('C', { status: 'PARTIALLY_EXECUTED', strategy_type: 'TWAP', account_no: 'X' }, 100_500),
    row('D', { status: 'CANCELLED', updated_at: iso(TODAY, '10:00:00'), account_no: 'X' }, 100_000),
    row('E', { status: 'COMPLETED', updated_at: '2026-10-01T10:00:00', account_no: 'X' }, 100_000),
  ]
  const ids = (list: ExecQualityRow[]) => list.map((item) => item.order.parent_order_id)

  it('5 phiên bỏ thứ Bảy, Chủ nhật', () => {
    expect(getSessionDates('2026-11-10', 5)).toEqual(['2026-11-10', '2026-11-09', '2026-11-06', '2026-11-05', '2026-11-04'])
  })

  it('mặc định 5 phiên, chỉ lệnh đã hoàn tất; "Hôm nay" chỉ lấy ngày hiện tại', () => {
    expect(ids(filterReportRows(rows, DEFAULT_REPORT_FILTERS, TODAY))).toEqual(['A', 'B'])
    expect(ids(filterReportRows(rows, { ...DEFAULT_REPORT_FILTERS, period: 'TODAY' }, TODAY))).toEqual(['A'])
  })

  it('gồm cả đang chạy; lọc theo chiến lược, chiều, tài khoản', () => {
    const withLive = { ...DEFAULT_REPORT_FILTERS, status: 'COMPLETED_AND_LIVE' as const }
    expect(ids(filterReportRows(rows, withLive, TODAY))).toEqual(['A', 'B', 'C'])
    expect(ids(filterReportRows(rows, { ...withLive, strategy_type: 'TWAP' }, TODAY))).toEqual(['A', 'C'])
    expect(ids(filterReportRows(rows, { ...withLive, side: 'SELL' }, TODAY))).toEqual(['B'])
    expect(ids(filterReportRows(rows, { ...withLive, account_no: 'Y', strategy_type: ALL }, TODAY))).toEqual(['B'])
  })

  it('sắp xếp theo cột số, ô trống luôn nằm cuối', () => {
    const withEmpty = [...rows.slice(0, 3), row('F', { status: 'COMPLETED', updated_at: iso(TODAY, '10:00:00') }, null)]
    expect(ids(sortReportRows(withEmpty, 'vsArrivalPct', 'asc'))).toEqual(['A', 'B', 'C', 'F'])
    expect(ids(sortReportRows(withEmpty, 'vsArrivalPct', 'desc'))).toEqual(['C', 'A', 'B', 'F'])
    expect(ids(sortReportRows(withEmpty, 'symbol', 'asc'))).toEqual(['A', 'B', 'C', 'F'])
  })

  it('KPI: số lệnh hoàn tất, tổng KL, x / y tốt hơn arrival, tham gia TB', () => {
    const shown = filterReportRows(rows, { ...DEFAULT_REPORT_FILTERS, status: 'COMPLETED_AND_LIVE' }, TODAY)
    // A mua 99.000 < 100.000: có lợi. B bán 99.000: bất lợi. C mua 100.500: bất lợi.
    const kpis = getReportKpis(shown)
    expect(kpis).toMatchObject({ completed: 2, totalFilled: 3_000, betterThanArrival: 1, measuredVsArrival: 3 })
    expect(kpis.avgParticipation).toBeCloseTo(0.05)
    expect(getReportKpis([])).toMatchObject({ completed: 0, measuredVsArrival: 0, avgParticipation: null })
  })
})

describe('bps theo chiến lược và câu nhận xét', () => {
  it('bình quân gia quyền theo KL, sắp từ có lợi nhất, câu nhận xét dùng đúng số', () => {
    const rows = [
      row('A', { strategy_type: 'TWAP', side: 'BUY' }, 99_800), // +20 bps
      row('B', { strategy_type: 'TWAP', side: 'BUY' }, 100_000), // 0 bps
      row('C', { strategy_type: 'POV', side: 'SELL' }, 99_820), // −18 bps
    ]
    const stats = getStrategyBps(rows)
    expect(stats.map((item) => [item.label, Math.round(item.bps), item.orders])).toEqual([
      ['TWAP', 10, 2],
      ['POV', -18, 1],
    ])
    expect(describeStrategyBps(stats)).toBe(
      'POV kém nhất: trung bình -18 bps (1 lệnh) so với arrival. Tốt nhất là TWAP: +10 bps (2 lệnh).',
    )
  })

  it('không có số liệu hoặc chỉ một chiến lược', () => {
    expect(describeStrategyBps([])).toBe('Chưa đủ dữ liệu để so sánh các chiến lược.')
    const one = getStrategyBps([row('A', { strategy_type: 'VWAP' }, 99_900)])
    expect(describeStrategyBps(one)).toBe('Chỉ có VWAP: trung bình +10 bps (1 lệnh) so với arrival.')
    expect(getStrategyBps([row('B', {}, null)])).toEqual([])
  })
})
