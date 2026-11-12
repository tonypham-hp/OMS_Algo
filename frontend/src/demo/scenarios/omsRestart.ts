import { orderDataFingerprint } from '../actions'
import type { Scenario } from '../types'
import { BOOK_ROUTE, childrenOf, DETAIL_ROUTE, openMarketAt, orderOf, workingOf } from './common'

const FIRST = { order: 'order', child: 1 } as const

// Scenario 6: OMS sập → khôi phục. Trạng thái được ghi ra "đĩa" (như localStorage, hay CSDL ở backend thật),
// bộ nhớ bị xóa; trong lúc tắt Core vẫn khớp; bật lại thì nạp trạng thái và nhận báo khớp bị lỡ.
export const omsRestart: Scenario = {
  id: 'oms-restart',
  number: 6,
  title: 'OMS sập → khôi phục trạng thái',
  summary: 'OMS tắt giữa chừng, Core vẫn khớp; bật lại nạp đúng trạng thái cũ, nhận phần khớp bị lỡ và chạy tiếp.',
  tcRefs: ['TC-E2E-200', 'TC-E2E-202'],
  seed: 606,
  setup: (env) => openMarketAt(env, 118_500),
  steps: [
    {
      id: 'place',
      caption: 'Đặt POV mua 100.000 CP, tham gia 10% KL thị trường. Lệnh bắt đầu đếm KL thị trường.',
      action: {
        type: 'placeOrder',
        params: {
          ref: 'order',
          symbol: 'FPT',
          side: 'BUY',
          strategy_type: 'POV',
          total_qty: 100_000,
          limit_price: 118_000,
          parameters: { participation_pct: 10, max_pct: 20 },
        },
      },
      route: DETAIL_ROUTE,
      highlight: 'order-status',
    },
    {
      id: 'volume',
      caption: 'Thị trường khớp 400.000 CP. POV gửi một lệnh con 40.000 (10%).',
      action: { type: 'trade', params: { symbol: 'FPT', price: 118_500, qty: 400_000 } },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:1}',
      checks: [{ label: 'Lệnh con #1 = 40.000', fn: (s) => childrenOf(s)[0]?.quantity === 40_000 }],
    },
    {
      id: 'partial',
      caption: 'Core báo khớp 30.000. Lệnh đã khớp 30.000, còn 10.000 của #1 đang chờ trên sàn.',
      action: { type: 'coreFill', params: { ...FIRST, qty: 30_000 } },
      route: DETAIL_ROUTE,
      highlight: 'order-executed',
      checks: [
        { label: 'Đã khớp 30.000', fn: (s) => orderOf(s).executed_qty === 30_000 },
        { label: 'Đang chờ 10.000', fn: (s) => workingOf(s) === 10_000 },
      ],
    },
    {
      id: 'crash',
      caption:
        'OMS sập. Trạng thái đã được ghi ra đĩa từ trước; bộ nhớ của OMS trống trơn, sổ lệnh không còn gì.',
      action: { type: 'crash' },
      settle: 0,
      route: BOOK_ROUTE,
      checks: [{ label: 'Bộ nhớ OMS trống', fn: (s) => s.orders.length === 0 && s.children.length === 0 }],
    },
    {
      id: 'core-fill-down',
      caption: 'Trong lúc OMS tắt, sàn vẫn chạy: Core khớp thêm 5.000 cho lệnh con #1. Báo khớp này chưa tới được OMS.',
      action: { type: 'coreFillWhileDown', params: { ...FIRST, qty: 5_000, price: 118_000 } },
      settle: 0,
      route: BOOK_ROUTE,
      checks: [{ label: 'Có 1 báo khớp đang chờ OMS', fn: (s) => s.ctx.missedReports.length === 1 }],
    },
    {
      id: 'restore',
      caption:
        'OMS bật lại và nạp trạng thái từ đĩa. Lệnh cha, lệnh con và KL đã khớp giống hệt lúc trước khi sập.',
      action: { type: 'restore' },
      settle: 0,
      route: DETAIL_ROUTE,
      highlight: 'order-executed',
      checks: [
        { label: 'Lệnh cha, lệnh con, lần khớp giống hệt trước khi sập', fn: (s) => orderDataFingerprint(s.env) === s.ctx.beforeCrash },
        { label: 'executed_qty vẫn 30.000', fn: (s) => orderOf(s).executed_qty === 30_000 },
      ],
    },
    {
      id: 'replay',
      caption:
        'Đối soát với Core: nhận báo khớp 5.000 bị lỡ. Đã khớp thành 35.000, không mất phần khớp lúc OMS tắt, và cũng không gửi lại lệnh con nào.',
      action: { type: 'replayMissedFills' },
      route: DETAIL_ROUTE,
      highlight: 'executions',
      checks: [
        { label: 'executed_qty = 35.000', fn: (s) => orderOf(s).executed_qty === 35_000 },
        { label: 'Đang chờ còn 5.000 của #1', fn: (s) => workingOf(s) === 5_000 },
        { label: 'Vẫn chỉ có 1 lệnh con', fn: (s) => childrenOf(s).length === 1 },
      ],
    },
    {
      id: 'continue',
      caption: 'Thị trường khớp thêm 100.000 CP. POV tính tiếp từ trạng thái đã khôi phục và gửi 10.000.',
      action: { type: 'trade', params: { symbol: 'FPT', price: 118_500, qty: 100_000 } },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:2}',
      checks: [
        { label: 'Lệnh con #2 = 10.000', fn: (s) => childrenOf(s)[1]?.quantity === 10_000 },
        { label: 'Lệnh vẫn đang chạy', fn: (s) => orderOf(s).status === 'PARTIALLY_EXECUTED' },
      ],
    },
  ],
}
