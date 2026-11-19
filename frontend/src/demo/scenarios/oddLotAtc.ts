import { parseTimeToSeconds } from '@/utils/hose'
import type { Scenario } from '../types'
import { childrenOf, DETAIL_ROUTE, orderOf, SYMBOL } from './common'

// Scenario 8 (Đợt 8A): lô lẻ 1–99 CP chỉ đặt lệnh LO, khớp được cả trong phiên ATC theo KRX.

export const oddLotAtc: Scenario = {
  id: 'odd-lot-atc',
  number: 8,
  title: 'Lô lẻ khớp trong ATC',
  summary: 'Lệnh LO lô lẻ 50 CP đặt lúc 14:35 (phiên ATC), khớp ở giá khớp định kỳ lúc 14:45; KL lô lẻ sai bị từ chối.',
  tcRefs: ['KRX-ODD-01', 'KRX-ODD-02'],
  seed: 108,
  setup: (env) => {
    env.simulator.jumpTo(parseTimeToSeconds('14:35') ?? 52_500)
    env.simulator.pushTrade(SYMBOL, 118_000, 100)
    env.simulator.advance(1)
  },
  steps: [
    {
      id: 'odd-invalid',
      caption: 'Thử đặt lô lẻ 150 CP: bị từ chối vì lô lẻ chỉ từ 1 đến 99 CP. Từ 100 CP trở lên là lô chẵn, phải là bội số của 100.',
      action: {
        type: 'placeOrder',
        params: { ref: 'bad', symbol: SYMBOL, side: 'BUY', strategy_type: 'LIMIT', total_qty: 150, limit_price: 118_500, parameters: {}, lot_type: 'ODD', expectError: true },
      },
      route: '/dat-lenh',
      highlight: 'lot-toggle',
      checks: [{ label: 'Bị từ chối: lô lẻ 1–99 CP', fn: (s) => (s.ctx.lastError ?? '').includes('Lô lẻ') }],
    },
    {
      id: 'odd-place',
      caption: 'Đặt lệnh LO lô lẻ mua 50 CP FPT giá 118.500 trong phiên ATC. KRX nhận lô lẻ ở cả ATO, liên tục và ATC, nên lệnh được nhận ngay.',
      action: {
        type: 'placeOrder',
        params: { ref: 'order', symbol: SYMBOL, side: 'BUY', strategy_type: 'LIMIT', total_qty: 50, limit_price: 118_500, parameters: {}, lot_type: 'ODD' },
      },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:1}',
      checks: [
        { label: 'Lệnh được nhận, đánh dấu lô lẻ', fn: (s) => orderOf(s).status === 'ACTIVE' && orderOf(s).lot_type === 'ODD' },
        { label: 'Một lệnh con LO 50 CP đã lên sàn', fn: (s) => childrenOf(s).length === 1 && childrenOf(s)[0].quantity === 50 && childrenOf(s)[0].status === 'ACKNOWLEDGED' },
      ],
    },
    {
      id: 'atc-wait',
      caption: 'Giá dự kiến đổi trong phiên ATC nhưng chưa khớp: phiên định kỳ chỉ khớp một lần lúc hết phiên.',
      action: { type: 'trade', params: { symbol: SYMBOL, price: 118_200, qty: 100 } },
      route: DETAIL_ROUTE,
      highlight: 'order-executed',
      checks: [{ label: 'Chưa khớp', fn: (s) => orderOf(s).executed_qty === 0 }],
    },
    {
      id: 'atc-match',
      caption: '14:45 hết phiên ATC: khớp định kỳ ở giá 118.200, thấp hơn giá đặt 118.500 nên lệnh lô lẻ khớp đủ 50 CP, không bị làm tròn lô.',
      action: { type: 'jumpTo', params: { time: '14:45' } },
      route: DETAIL_ROUTE,
      highlight: 'executions',
      checks: [
        { label: 'Khớp đủ 50 CP giá 118.200', fn: (s) => s.executions.some((item) => item.parent_order_id === orderOf(s).parent_order_id && item.qty === 50 && item.price === 118_200) },
        { label: 'Lệnh hoàn tất', fn: (s) => orderOf(s).status === 'COMPLETED' },
      ],
    },
    {
      id: 'summary',
      caption: 'Lô lẻ là lệnh LO thường: một lệnh con đúng 50 CP, khớp ở phiên ATC, không có lệnh thị trường hay chia phần.',
      action: { type: 'note' },
      route: DETAIL_ROUTE,
      highlight: 'order-status',
      checks: [{ label: 'Chỉ một lệnh con, loại LO', fn: (s) => childrenOf(s).length === 1 && childrenOf(s)[0].order_type === 'LO' }],
    },
  ],
}
