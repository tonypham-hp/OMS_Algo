import type { DemoState, Scenario } from '../types'
import { BOOK_ROUTE, childrenOf, DETAIL_ROUTE, openMarketAt, orderOf, SYMBOL } from './common'

const MAX_PRICE = 118_300
/** Hai lệnh con đầu là lệnh quét; lệnh con sau đó là phần còn lại đặt bị động. */
const sweepChildren = (state: DemoState) => childrenOf(state).slice(0, 2)

// Scenario 4: HUNT quét sổ lệnh tối đa 3 mức, không vượt giá tối đa; phần còn lại đặt bị động tại giá mua tốt nhất.
export const huntSweep: Scenario = {
  id: 'hunt-sweep',
  number: 4,
  title: 'HUNT quét mức + phần còn lại',
  summary: 'Giá về mức săn thì quét tối đa 3 mức giá bán không vượt giá tối đa; phần còn lại đặt chờ ở giá mua.',
  tcRefs: ['TC-E2E-090', 'TC-E2E-091'],
  seed: 404,
  setup: (env) => openMarketAt(env, 118_500),
  steps: [
    {
      id: 'book',
      caption:
        'Sổ lệnh bán FPT: 118.100 có 3.000, 118.200 có 4.000, 118.400 có 5.000. Phía mua tốt nhất 117.900.',
      action: {
        type: 'setDepth',
        params: {
          symbol: SYMBOL,
          asks: [
            [118_100, 3_000],
            [118_200, 4_000],
            [118_400, 5_000],
            [118_500, 6_000],
          ],
          bids: [
            [117_900, 5_000],
            [117_800, 5_000],
          ],
        },
      },
      route: BOOK_ROUTE,
    },
    {
      id: 'place',
      caption:
        'Đặt HUNT mua 10.000 CP: săn khi giá về 118.000, giá tối đa 118.300, quét tối đa 3 mức, phần còn lại đặt bị động. Giá đang 118.500 nên lệnh chờ.',
      action: {
        type: 'placeOrder',
        params: {
          ref: 'order',
          symbol: SYMBOL,
          side: 'BUY',
          strategy_type: 'HUNT',
          total_qty: 10_000,
          limit_price: MAX_PRICE,
          parameters: { hunt_price: 118_000, max_wait_min: 30, max_levels: 3, remainder_passive: 1 },
        },
      },
      route: DETAIL_ROUTE,
      highlight: 'order-params',
      checks: [{ label: 'Chưa có lệnh con khi giá chưa về mức săn', fn: (s) => childrenOf(s).length === 0 }],
    },
    {
      id: 'sweep',
      caption:
        'Giá về 118.000: HUNT quét sổ lệnh. Chỉ 2 mức 118.100 và 118.200 nằm trong giá tối đa; mức 118.400 vượt 118.300 nên không quét, dù được phép 3 mức.',
      action: { type: 'trade', params: { symbol: SYMBOL, price: 118_000, qty: 1_000 } },
      settle: 0,
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:2}',
      checks: [
        {
          label: 'Quét đúng 2 mức: 3.000 @118.100 và 4.000 @118.200',
          fn: (s) => {
            const [first, second] = sweepChildren(s)
            return childrenOf(s).length === 2 && first?.price === 118_100 && first.quantity === 3_000 && second?.price === 118_200 && second.quantity === 4_000
          },
        },
        { label: 'Không lệnh con nào có giá vượt giá tối đa 118.300', fn: (s) => childrenOf(s).every((child) => (child.price ?? 0) <= MAX_PRICE) },
      ],
    },
    {
      id: 'remainder',
      caption:
        'Hai lệnh quét khớp hết 7.000. Phần còn lại 3.000 không đuổi giá mà chuyển sang đặt bị động tại giá mua tốt nhất 117.900, như chính sách đã chọn.',
      action: { type: 'note' },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:3}',
      checks: [
        { label: 'Tổng KL quét = 7.000, không vượt KL của các mức hợp lệ', fn: (s) => sweepChildren(s).reduce((sum, child) => sum + child.filled_qty, 0) === 7_000 },
        {
          label: 'Phần còn lại: 1 lệnh con LO 3.000 @117.900',
          fn: (s) => {
            const rest = childrenOf(s)[2]
            return childrenOf(s).length === 3 && rest?.order_type === 'LO' && rest.price === 117_900 && rest.quantity === 3_000
          },
        },
      ],
    },
    {
      id: 'passive-fill',
      caption: 'Giá về 117.900, lệnh bị động khớp dần. Lệnh mua đủ 10.000 mà không lần nào trả giá cao hơn 118.300.',
      action: { type: 'trade', params: { symbol: SYMBOL, price: 117_900, qty: 2_000, repeat: 2 } },
      route: DETAIL_ROUTE,
      highlight: 'order-status',
      checks: [
        { label: 'COMPLETED, khớp 10.000', fn: (s) => orderOf(s).status === 'COMPLETED' && orderOf(s).executed_qty === 10_000 },
        { label: 'Mọi lần khớp ≤ giá tối đa', fn: (s) => s.executions.every((execution) => execution.price <= MAX_PRICE) },
      ],
    },
  ],
}
