import { parseTimeToSeconds } from '@/utils/hose'
import type { DemoState, Scenario } from '../types'
import { childrenOf, orderOf } from './common'

// Scenario 10 (Đợt 8B): mã bị hạn chế giao dịch chỉ khớp định kỳ theo lượt 15 phút, chỉ lô chẵn, chỉ LO trong lượt;
// khóa sửa, hủy 5 phút cuối lượt.

/** Mã hạn chế giao dịch mô phỏng, tham chiếu 14.250. */
const SYMBOL = 'XRS'
const ROUTE = '/so-lenh/{order}'
const at = (time: string) => parseTimeToSeconds(time) as number
const quoteOf = (s: DemoState) => s.env.simulator.getState().quotes.find((quote) => quote.symbol === SYMBOL)
const errorHas = (s: DemoState, text: string) => (s.ctx.lastError ?? '').includes(text)
const place = (ref: string, extra: Record<string, unknown> = {}) => ({
  type: 'placeOrder' as const,
  params: {
    ref,
    symbol: SYMBOL,
    side: 'BUY' as const,
    strategy_type: 'LIMIT' as const,
    total_qty: 1_000,
    limit_price: 14_300,
    parameters: {},
    ...extra,
  },
})

export const restrictedAuction: Scenario = {
  id: 'restricted-auction',
  number: 10,
  title: 'Mã hạn chế khớp định kỳ 15 phút',
  summary: 'XRS (mô phỏng) bị hạn chế giao dịch: lệnh LO chỉ khớp lúc hết lượt 15 phút; lô lẻ, MTL, HUNT bị chặn; khóa sửa, hủy 5 phút cuối lượt.',
  tcRefs: ['KRX-RESTRICTED-01', 'KRX-RESTRICTED-02', 'KRX-RESTRICTED-03'],
  seed: 110,
  setup: (env) => {
    env.simulator.jumpTo(at('09:20'))
    env.simulator.pushTrade(SYMBOL, 14_250, 100)
    env.simulator.advance(1)
  },
  steps: [
    {
      id: 'place',
      caption:
        '09:20: XRS đang trong lượt khớp định kỳ 09:15–09:30. Đặt LO mua 1.000 CP giá 14.300: lệnh được nhận và nằm chờ, không khớp liên tục dù giá khớp gần nhất thấp hơn.',
      action: place('order'),
      route: ROUTE,
      highlight: 'child-{child:order:1}',
      checks: [
        { label: 'XRS trong lượt định kỳ, khớp lúc 09:30', fn: (s) => quoteOf(s)?.phase?.session === 'PERIODIC' && quoteOf(s)?.phase?.call_end === at('09:30') },
        { label: 'Lệnh con LO 1.000 CP đã lên sàn, chưa khớp', fn: (s) => childrenOf(s)[0]?.status === 'ACKNOWLEDGED' && orderOf(s).executed_qty === 0 },
      ],
    },
    {
      id: 'odd-lot',
      caption: 'Thử đặt lô lẻ 50 CP: bị từ chối vì mã hạn chế giao dịch chỉ nhận lô chẵn.',
      action: place('odd', { total_qty: 50, lot_type: 'ODD', expectError: true }),
      checks: [{ label: 'Bị từ chối: chỉ nhận lô chẵn', fn: (s) => errorHas(s, 'chỉ nhận lô chẵn') }],
    },
    {
      id: 'mtl',
      caption: 'Thử đặt lệnh Stop (khi kích hoạt sẽ gửi MTL): bị từ chối vì mã chỉ khớp định kỳ, không có lệnh thị trường.',
      action: place('stop', { strategy_type: 'STOP', limit_price: null, parameters: { trigger_price: 14_500 }, expectError: true }),
      checks: [{ label: 'Bị từ chối: không nhận MTL', fn: (s) => errorHas(s, 'không nhận lệnh MTL') }],
    },
    {
      id: 'hunt',
      caption: 'Thử đặt HUNT: bị từ chối, vì mã chỉ khớp 15 phút một lần nên không có sổ lệnh liên tục để săn giá, quét mức.',
      action: place('hunt', { strategy_type: 'HUNT', parameters: { hunt_price: 14_200, max_wait_min: 10 }, expectError: true }),
      checks: [{ label: 'Bị từ chối: không đặt được HUNT', fn: (s) => errorHas(s, 'không đặt được lệnh HUNT') }],
    },
    {
      id: 'lock',
      caption: '09:26: vào 5 phút cuối lượt. Mã hạn chế khóa sửa, hủy trong cửa sổ này để giá khớp định kỳ không bị xáo trộn sát giờ khớp.',
      action: { type: 'jumpTo', params: { time: '09:26' } },
      settle: 0,
      route: ROUTE,
      highlight: 'order-status',
      checks: [{ label: 'XRS đang khóa sửa/hủy (PERIODIC_LOCK)', fn: (s) => quoteOf(s)?.phase?.session === 'PERIODIC_LOCK' }],
    },
    {
      id: 'amend-locked',
      caption: 'Thử giảm KL còn 800: bị từ chối, lý do nêu rõ khóa 5 phút cuối lượt và giờ khớp 09:30.',
      action: { type: 'amend', params: { order: 'order', total_qty: 800, expectError: true } },
      settle: 0,
      checks: [
        { label: 'Bị từ chối: khóa sửa, hủy, khớp lúc 09:30', fn: (s) => errorHas(s, 'Khóa sửa, hủy 5 phút cuối lượt') && errorHas(s, '09:30') },
        { label: 'KL giữ nguyên 1.000', fn: (s) => orderOf(s).total_qty === 1_000 },
      ],
    },
    {
      id: 'match',
      caption: '09:30 hết lượt: khớp định kỳ ở giá 14.250, thấp hơn giá mua 14.300, nên lệnh khớp đủ 1.000 CP một lần. Lượt kế tiếp chạy tới 09:45.',
      action: { type: 'jumpTo', params: { time: '09:30' } },
      route: ROUTE,
      highlight: 'executions',
      checks: [
        { label: 'Khớp đủ 1.000 CP giá 14.250 lúc 09:30', fn: (s) => s.executions.some((item) => item.parent_order_id === orderOf(s).parent_order_id && item.qty === 1_000 && item.price === 14_250 && item.match_time.endsWith('09:30:00')) },
        { label: 'Lượt mới khớp lúc 09:45', fn: (s) => quoteOf(s)?.phase?.call_end === at('09:45') },
      ],
    },
  ],
}
