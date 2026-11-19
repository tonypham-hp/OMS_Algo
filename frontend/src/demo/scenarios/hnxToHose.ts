import { parseTimeToSeconds } from '@/utils/hose'
import type { DemoState, Scenario } from '../types'
import { orderOf } from './common'

// Scenario 9 (Đợt 8A): cổ phiếu niêm yết HNX giao dịch phiên cuối 23/12/2026, nghỉ 24–25/12,
// giao dịch trên HOSE từ 28/12/2026 (Thông tư 139/2025/TT-BTC). Luật đổi theo gói luật, không sửa code.

/** Mã niêm yết HNX mô phỏng, tham chiếu 32.400. */
const HNX_SYMBOL = 'XHA'
const quoteOf = (s: DemoState) => s.env.simulator.getState().quotes.find((quote) => quote.symbol === HNX_SYMBOL)

export const hnxToHose: Scenario = {
  id: 'hnx-to-hose',
  number: 9,
  title: 'Ngày 28/12/2026: mã HNX sang HOSE',
  summary: 'Mã XHA (mô phỏng) theo luật HNX tới 23/12, ngừng giao dịch 24–25/12, từ 28/12 theo luật HOSE: biên ±7%, bước giá theo vùng.',
  tcRefs: ['KRX-TRANSFER-01', 'KRX-TRANSFER-02', 'KRX-TRANSFER-03'],
  seed: 109,
  setup: (env) => {
    env.simulator.setTradingDate('2026-12-23', { allowPast: true })
    env.simulator.jumpTo(parseTimeToSeconds('10:00') ?? 36_000)
    env.simulator.advance(1)
  },
  steps: [
    {
      id: 'hnx-day',
      caption: 'Ngày 23/12/2026: XHA còn trên HNX, biên ±10%. Tham chiếu 32.400 → trần 35.600, sàn 29.200, bước giá 100 đ.',
      action: { type: 'note' },
      route: '/dat-lenh',
      highlight: 'sim-date',
      checks: [
        { label: 'XHA thuộc bảng HNX (STX)', fn: (s) => quoteOf(s)?.board === 'STX' },
        { label: 'Trần 35.600, sàn 29.200 (±10%)', fn: (s) => quoteOf(s)?.ceiling_price === 35_600 && quoteOf(s)?.floor_price === 29_200 },
      ],
    },
    {
      id: 'hnx-tick',
      caption: 'Đặt mua giá 32.450 bị từ chối: trên HNX bước giá là 100 đ ở mọi mức giá.',
      action: {
        type: 'placeOrder',
        params: { ref: 'hnx', symbol: HNX_SYMBOL, side: 'BUY', strategy_type: 'LIMIT', total_qty: 1_000, limit_price: 32_450, parameters: {}, expectError: true },
      },
      route: '/dat-lenh',
      checks: [{ label: 'Bị từ chối: sai bước giá 100 đ', fn: (s) => (s.ctx.lastError ?? '').includes('bước 100đ') }],
    },
    {
      id: 'halt',
      caption: 'Sang 24/12/2026: cổ phiếu niêm yết HNX ngừng giao dịch hai ngày 24–25/12 để chuyển sang HOSE. Bảng giá ghi "Ngừng GD".',
      action: { type: 'setDate', params: { date: '2026-12-24' } },
      route: '/dat-lenh',
      highlight: 'sim-date',
      checks: [{ label: 'XHA ngừng giao dịch (không thuộc bảng nào)', fn: (s) => quoteOf(s)?.board === null }],
    },
    {
      id: 'halt-reject',
      caption: 'Đặt lệnh XHA trong ngày ngừng giao dịch bị từ chối, kèm ngày giao dịch lại trên HOSE.',
      action: {
        type: 'placeOrder',
        params: { ref: 'halted', symbol: HNX_SYMBOL, side: 'BUY', strategy_type: 'LIMIT', total_qty: 1_000, limit_price: 32_400, parameters: {}, expectError: true },
      },
      route: '/dat-lenh',
      checks: [{ label: 'Bị từ chối: ngừng giao dịch để chuyển sàn', fn: (s) => (s.ctx.lastError ?? '').includes('ngừng giao dịch') }],
    },
    {
      id: 'hose-day',
      caption:
        'Sang 28/12/2026: XHA giao dịch trên HOSE (bảng STO), biên ±7%. Tham chiếu 32.400 → trần 34.650, sàn 30.150, bước giá 50 đ ở vùng 10.000–50.000. Luật bảng mới là giả định, có nhãn "Giả định".',
      action: { type: 'setDate', params: { date: '2026-12-28' } },
      route: '/dat-lenh',
      highlight: 'sim-date',
      checks: [
        { label: 'XHA thuộc bảng HOSE (STO), đánh dấu đã chuyển sàn', fn: (s) => quoteOf(s)?.board === 'STO' && quoteOf(s)?.transferred === true },
        { label: 'Trần 34.650, sàn 30.150 (±7%)', fn: (s) => quoteOf(s)?.ceiling_price === 34_650 && quoteOf(s)?.floor_price === 30_150 },
      ],
    },
    {
      id: 'hose-order',
      caption: 'Cùng lệnh mua giá 32.450 nay được nhận: trên HOSE giá 32.450 đúng bước 50 đ. Không cần sửa code, chỉ đổi ngày mô phỏng.',
      action: { type: 'jumpTo', params: { time: '10:00' } },
      settle: 0,
      route: '/dat-lenh',
      checks: [{ label: 'Đang ở phiên liên tục ngày 28/12', fn: (s) => s.env.simulator.getState().trading_date === '2026-12-28' }],
    },
    {
      id: 'hose-place',
      caption: 'Đặt lệnh LO mua 1.000 CP XHA giá 32.450 trên HOSE: lệnh được nhận và gửi xuống sàn.',
      action: {
        type: 'placeOrder',
        params: { ref: 'order', symbol: HNX_SYMBOL, side: 'BUY', strategy_type: 'LIMIT', total_qty: 1_000, limit_price: 32_450, parameters: {} },
      },
      route: '/so-lenh/{order}',
      highlight: 'order-status',
      checks: [{ label: 'Lệnh XHA giá 32.450 được nhận', fn: (s) => orderOf(s).limit_price === 32_450 && orderOf(s).status !== 'CANCELLED' }],
    },
  ],
}
