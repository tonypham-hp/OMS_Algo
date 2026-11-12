import { getParticipation } from '@/utils/execQuality'
import type { DemoState, Scenario } from '../types'
import { childrenOf, DETAIL_ROUTE, openMarketAt, orderOf, SYMBOL } from './common'

/** Tỷ lệ tham gia thực tế của lệnh: KL khớp / KL toàn thị trường (băng tick) từ lúc đặt lệnh. */
function participation(state: DemoState) {
  const order = orderOf(state)
  const market = state.env.tape
    .list(SYMBOL, order.created_at, '9999-12-31T23:59:59')
    .reduce((sum, trade) => sum + trade.qty, 0)
  return getParticipation(order.executed_qty, market) ?? 0
}

const totalSent = (state: DemoState) => childrenOf(state).reduce((sum, child) => sum + child.quantity, 0)

// Scenario 3: POV điều chỉnh theo KL thị trường. Giá thị trường cao hơn giá giới hạn nên lệnh con chỉ khớp
// khi Core báo khớp, KL gửi đi phụ thuộc hoàn toàn vào KL thị trường mà kịch bản đẩy vào.
// Tài liệu gốc ghép POV với Adaptive (chọn giá theo Bid/Ask); engine chưa có Adaptive nên chỉ trình diễn phần POV.
export const povAdjust: Scenario = {
  id: 'pov-adjust',
  number: 3,
  title: 'POV điều chỉnh theo thị trường',
  summary: 'POV 10% bám theo KL thị trường: đứng yên thì không gửi, tăng đột biến vẫn không vượt trần 20%.',
  tcRefs: ['TC-E2E-070', 'TC-E2E-071', 'TC-E2E-072', 'TC-E2E-232'],
  seed: 303,
  setup: (env) => openMarketAt(env, 118_800),
  steps: [
    {
      id: 'place',
      caption:
        'Đặt POV mua 20.000 CP, tham gia 10% KL thị trường, tối đa 20%. Lệnh bắt đầu đếm KL thị trường từ lúc đặt, chưa gửi gì.',
      action: {
        type: 'placeOrder',
        params: {
          ref: 'order',
          symbol: SYMBOL,
          side: 'BUY',
          strategy_type: 'POV',
          total_qty: 20_000,
          limit_price: 118_500,
          parameters: { participation_pct: 10, max_pct: 20 },
        },
      },
      route: DETAIL_ROUTE,
      highlight: 'order-status',
      checks: [{ label: 'Chưa có lệnh con', fn: (s) => childrenOf(s).length === 0 }],
    },
    {
      id: 'quiet',
      caption: 'Đồng hồ chạy 30 giây nhưng thị trường không có giao dịch. POV không sinh lệnh con vì 10% của 0 là 0.',
      action: { type: 'advance', params: { seconds: 30 } },
      route: DETAIL_ROUTE,
      highlight: 'order-executed',
      checks: [{ label: 'Không có KL mới thì không có lệnh con', fn: (s) => childrenOf(s).length === 0 }],
    },
    {
      id: 'flow',
      caption:
        'Thị trường khớp 5 đợt, mỗi đợt 10.000 CP. Mỗi đợt POV gửi 1.000 (10%), tổng 5.000; không đợt nào vượt 20%.',
      action: { type: 'trade', params: { symbol: SYMBOL, price: 118_800, qty: 10_000, repeat: 5, everySeconds: 2 } },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:last}',
      checks: [
        { label: 'Tổng gửi = 10% của 50.000 = 5.000', fn: (s) => totalSent(s) === 5_000 },
        { label: 'Mỗi lệnh con ≤ 20% của đợt 10.000', fn: (s) => childrenOf(s).every((child) => child.quantity <= 2_000) },
      ],
    },
    {
      id: 'fill-flow',
      caption: 'Core báo khớp các lệnh con đang chờ. Đã mua 5.000 CP.',
      action: { type: 'fillOpen', params: { order: 'order' } },
      route: DETAIL_ROUTE,
      highlight: 'executions',
      checks: [{ label: 'Đã khớp 5.000', fn: (s) => orderOf(s).executed_qty === 5_000 }],
    },
    {
      id: 'quiet-again',
      caption: 'Thị trường lại đứng yên 60 giây. POV giữ nguyên, không tự gửi thêm để "đuổi" kế hoạch.',
      action: { type: 'advance', params: { seconds: 60 } },
      route: DETAIL_ROUTE,
      highlight: 'order-executed',
      checks: [
        { label: 'Không sinh thêm lệnh con khi KL thị trường không đổi', fn: (s) => childrenOf(s).length === 5 },
      ],
    },
    {
      id: 'spike',
      caption:
        'KL thị trường tăng đột biến 200.000 CP. 10% là 20.000 nhưng lệnh chỉ còn 15.000 chưa đặt, nên POV gửi 15.000: tôn trọng cả trần tham gia lẫn KL còn lại.',
      action: { type: 'trade', params: { symbol: SYMBOL, price: 118_800, qty: 200_000 } },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:last}',
      checks: [
        { label: 'Lệnh con mới = 15.000 (KL còn lại)', fn: (s) => childrenOf(s).at(-1)?.quantity === 15_000 },
        { label: 'Tổng gửi không vượt 20.000', fn: (s) => totalSent(s) <= 20_000 },
      ],
    },
    {
      id: 'done',
      caption:
        'Core khớp phần còn lại, lệnh hoàn tất. Tỷ lệ tham gia thực tế (KL lệnh / KL thị trường) thấp hơn trần 20%.',
      action: { type: 'fillOpen', params: { order: 'order' } },
      route: DETAIL_ROUTE,
      highlight: 'exec-quality',
      checks: [
        { label: 'COMPLETED, khớp 20.000', fn: (s) => orderOf(s).status === 'COMPLETED' && orderOf(s).executed_qty === 20_000 },
        { label: 'Tỷ lệ tham gia thực tế ≤ 20%', fn: (s) => participation(s) > 0 && participation(s) <= 0.2 },
      ],
    },
  ],
}
