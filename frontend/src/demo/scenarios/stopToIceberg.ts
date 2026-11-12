import type { DemoState, Scenario } from '../types'
import { childrenOf, countEvents, DETAIL_ROUTE, openMarketAt, orderOf, SYMBOL } from './common'

const conditionOf = (state: DemoState) =>
  state.conditions.find((condition) => condition.parent_order_id === state.ctx.refs.order)

// Scenario 2: Stop kích hoạt → Iceberg. Stop Limit bán có KL mỗi phần: chạm ngưỡng mới bắt đầu chia lệnh con.
export const stopToIceberg: Scenario = {
  id: 'stop-to-iceberg',
  number: 2,
  title: 'Stop kích hoạt → Iceberg',
  summary: 'Giá chưa chạm ngưỡng thì không làm gì; chạm ngưỡng thì kích hoạt đúng một lần rồi chia theo từng phần.',
  tcRefs: ['TC-E2E-010', 'TC-E2E-011', 'TC-E2E-012', 'TC-E2E-050'],
  seed: 202,
  setup: (env) => openMarketAt(env, 118_000),
  steps: [
    {
      id: 'place',
      caption:
        'Đặt Stop Limit bán 30.000 CP: giá về 116.000 thì bán, giá thấp nhất 115.500, mỗi phần 10.000. Trước khi chạm ngưỡng, lệnh chỉ theo dõi giá.',
      action: {
        type: 'placeOrder',
        params: {
          ref: 'order',
          symbol: SYMBOL,
          side: 'SELL',
          strategy_type: 'STOP_LIMIT',
          total_qty: 30_000,
          limit_price: 115_500,
          parameters: { trigger_price: 116_000, slice_qty: 10_000 },
        },
      },
      route: DETAIL_ROUTE,
      highlight: 'conditions',
      checks: [
        { label: 'Điều kiện Stop đang ACTIVE', fn: (s) => conditionOf(s)?.status === 'ACTIVE' },
        { label: 'Chưa có lệnh con nào', fn: (s) => childrenOf(s).length === 0 },
      ],
    },
    {
      id: 'above',
      caption: 'Giá giảm về 117.000 nhưng chưa chạm 116.000. Hệ thống không làm gì: không có lệnh con nào xuống sàn.',
      action: { type: 'trade', params: { symbol: SYMBOL, price: 117_000, qty: 2_000, repeat: 3 } },
      route: DETAIL_ROUTE,
      highlight: 'conditions',
      checks: [
        { label: 'Điều kiện vẫn ACTIVE', fn: (s) => conditionOf(s)?.status === 'ACTIVE' },
        { label: 'Vẫn chưa có lệnh con', fn: (s) => childrenOf(s).length === 0 },
      ],
    },
    {
      id: 'trigger',
      caption:
        'Giá chạm 116.000: điều kiện kích hoạt và Iceberg bắt đầu với phần đầu 10.000 tại giá 115.500. Lệnh con chỉ sinh SAU thời điểm kích hoạt.',
      action: { type: 'trade', params: { symbol: SYMBOL, price: 116_000, qty: 3_000 } },
      settle: 0,
      route: DETAIL_ROUTE,
      highlight: 'conditions',
      checks: [
        { label: 'Điều kiện TRIGGERED', fn: (s) => conditionOf(s)?.status === 'TRIGGERED' },
        {
          label: 'Lệnh con đầu tiên sinh sau thời điểm kích hoạt',
          fn: (s) => {
            const triggeredAt = conditionOf(s)?.triggered_at
            const first = childrenOf(s)[0]
            return Boolean(triggeredAt && first && first.created_at >= triggeredAt)
          },
        },
        { label: 'Lệnh con đầu = 10.000, giá 115.500', fn: (s) => childrenOf(s)[0]?.quantity === 10_000 && childrenOf(s)[0]?.price === 115_500 },
      ],
    },
    {
      id: 'keep-falling',
      caption:
        'Giá tiếp tục giảm 115.000 → 114.000. Điều kiện chỉ kích hoạt một lần, nên không có lệnh con thứ hai chừng nào phần đầu chưa xong.',
      action: { type: 'trade', params: { symbol: SYMBOL, price: 114_000, qty: 2_000, repeat: 3 } },
      route: DETAIL_ROUTE,
      highlight: 'event-log',
      checks: [
        { label: 'Chỉ có 1 lần TRIGGER', fn: (s) => countEvents(s, 'TRIGGER') === 1 },
        { label: 'Vẫn 1 lệnh con', fn: (s) => childrenOf(s).length === 1 },
      ],
    },
    {
      id: 'first-slice',
      caption: 'Phần đầu khớp đủ 10.000 thì Iceberg gửi phần tiếp theo, vẫn đúng 10.000.',
      action: { type: 'coreFill', params: { order: 'order', child: 1 } },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:2}',
      checks: [{ label: 'Lệnh con #2 = 10.000', fn: (s) => childrenOf(s)[1]?.quantity === 10_000 }],
    },
    {
      id: 'done',
      caption: 'Các phần còn lại khớp lần lượt tới đủ 30.000. Ba lệnh con, mỗi lệnh 10.000, lệnh cha hoàn tất.',
      action: { type: 'fillUntilDone', params: { order: 'order' } },
      route: DETAIL_ROUTE,
      highlight: 'order-status',
      checks: [
        { label: 'COMPLETED, khớp 30.000', fn: (s) => orderOf(s).status === 'COMPLETED' && orderOf(s).executed_qty === 30_000 },
        { label: '3 lệnh con, mỗi lệnh 10.000', fn: (s) => childrenOf(s).length === 3 && childrenOf(s).every((child) => child.quantity === 10_000) },
        { label: 'Vẫn chỉ 1 lần TRIGGER', fn: (s) => countEvents(s, 'TRIGGER') === 1 },
      ],
    },
  ],
}
