import { afterEach, describe, expect, it } from 'vitest'
import { STO_EXPERIMENTAL_NO_LUNCH } from '@/rules/packs/experimental-no-lunch'
import { setExperimentalPack } from '@/rules/registry'
import { parseTimeToSeconds } from '@/rules/session'
import { createMarketSimulator } from './simulator'

const at = (time: string) => parseTimeToSeconds(time) as number
const quoteOf = (simulator: ReturnType<typeof createMarketSimulator>, symbol: string) =>
  simulator.getState().quotes.find((quote) => quote.symbol === symbol)!

afterEach(() => {
  setExperimentalPack(null)
})

describe('bộ giả lập theo gói luật', () => {
  it('nạp pack "bỏ nghỉ trưa": đồng hồ phiên chạy liên tục qua 12:00, giá vẫn khớp, không sửa code', () => {
    const simulator = createMarketSimulator({ symbols: [{ symbol: 'FPT', ref_price: 118_000 }], startDate: new Date(2026, 10, 16) })
    simulator.setSpeed(60)
    setExperimentalPack(STO_EXPERIMENTAL_NO_LUNCH.id)
    simulator.jumpTo(at('11:29'))
    expect(simulator.getState().session).toBe('CONTINUOUS')
    const before = quoteOf(simulator, 'FPT').total_volume
    // Từ 11:29 tới 12:30 ở x60: mỗi nhịp 1 phút.
    const seen = new Set<string>()
    for (let index = 0; index < 61; index += 1) {
      simulator.tick(1000)
      seen.add(simulator.getState().session)
    }
    expect(seen).toEqual(new Set(['CONTINUOUS']))
    expect(quoteOf(simulator, 'FPT').total_volume).toBeGreaterThan(before)

    // Bỏ pack thử nghiệm: cùng giờ đó quay về nghỉ trưa.
    setExperimentalPack(null)
    simulator.jumpTo(at('12:00'))
    expect(simulator.getState().session).toBe('LUNCH')
  })

  it('phiên theo bảng: UPCoM khớp liên tục tới 15:00, HOSE thỏa thuận sau giờ từ 14:45', () => {
    const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 16) })
    simulator.jumpTo(at('14:50'))
    expect(simulator.getState().session).toBe('PUT_THROUGH')
    expect(simulator.getState().board_sessions).toMatchObject({ STO: 'PUT_THROUGH', STX: 'PUT_THROUGH', UPX: 'CONTINUOUS' })
    simulator.jumpTo(at('09:05'))
    expect(simulator.getState().board_sessions).toMatchObject({ STO: 'ATO', STX: 'CONTINUOUS', UPX: 'CONTINUOUS' })
  })

  it('mã mô phỏng có bảng, loại chứng khoán, room; giá tham chiếu đúng bước giá', () => {
    const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 16) })
    expect(quoteOf(simulator, 'XHA')).toMatchObject({ board: 'STX', sec_type: 'STOCK', ceiling_price: 35_600, floor_price: 29_200 })
    expect(quoteOf(simulator, 'XUA')).toMatchObject({ board: 'UPX', ceiling_price: 14_100, floor_price: 10_500 })
    expect(quoteOf(simulator, 'XETF30')).toMatchObject({ board: 'STO', sec_type: 'ETF' })
    expect(quoteOf(simulator, 'CFPT2699')).toMatchObject({ sec_type: 'CW', ceiling_price: 2_050, floor_price: 410 })
    expect(quoteOf(simulator, 'MWG').foreign_room).toBe(5_000)
  })

  it('đổi ngày qua 23/12 → 24/12 → 28/12/2026: XHA từ HNX, ngừng giao dịch, sang HOSE ±7%', () => {
    const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 16) })
    simulator.setTradingDate('2026-12-23')
    expect(quoteOf(simulator, 'XHA')).toMatchObject({ board: 'STX', ceiling_price: 35_600 })
    simulator.setTradingDate('2026-12-24')
    expect(quoteOf(simulator, 'XHA').board).toBeNull()
    expect(quoteOf(simulator, 'FPT').board).toBe('STO')
    simulator.setTradingDate('2026-12-28')
    expect(quoteOf(simulator, 'XHA')).toMatchObject({ board: 'STO', transferred: true, ceiling_price: 34_650, floor_price: 30_150 })
    expect(simulator.getState().sim_seconds).toBe(at('09:10'))
  })

  it('đổi ngày: từ chối ngày nghỉ và lùi về quá khứ (trừ Demo)', () => {
    const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 16) })
    expect(() => simulator.setTradingDate('2026-12-26')).toThrow('không phải ngày giao dịch')
    expect(() => simulator.setTradingDate('2026-11-13')).toThrow('Không lùi')
    simulator.setTradingDate('2026-11-13', { allowPast: true })
    expect(simulator.getState().trading_date).toBe('2026-11-13')
  })

  it('UPCoM: giá tham chiếu ngày sau là bình quân gia quyền phiên trước, làm tròn đúng bước giá', () => {
    const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 16) })
    simulator.pushTrade('XUA', 12_400, 300)
    simulator.pushTrade('XUA', 12_600, 100)
    simulator.pushTrade('XHA', 32_600, 100)
    simulator.nextDay()
    // (12.400 × 300 + 12.600 × 100) / 400 = 12.450 → làm tròn bước 100 → 12.500; giá đóng cửa là 12.600.
    expect(quoteOf(simulator, 'XUA').ref_price).toBe(12_500)
    // HNX vẫn lấy giá đóng cửa.
    expect(quoteOf(simulator, 'XHA').ref_price).toBe(32_600)
  })
})
