import type { DemoState, Scenario } from '../types'
import { childrenOf, DETAIL_ROUTE, openMarketAt, orderOf, SYMBOL } from './common'

// Scenario 7 (Đợt 8A): sửa lệnh LO tại chỗ theo KRX. Mỗi lần chỉ đổi giá HOẶC khối lượng;
// đổi giá, tăng KL thì mất ưu tiên thời gian, giảm KL thì giữ.

const child = (s: DemoState) => childrenOf(s)[0]
const keepsPriority = (s: DemoState) => child(s)?.priority_at === child(s)?.created_at
const amendKinds = (s: DemoState) =>
  s.events
    .filter((event) => event.parent_order_id === orderOf(s).parent_order_id && event.action === 'MODIFY' && event.child_order_id === null)
    .map((event) => event.amend_kind)

export const amendPriority: Scenario = {
  id: 'amend-priority',
  number: 7,
  title: 'Sửa lệnh: mất / giữ ưu tiên',
  summary: 'Lệnh LO 1.000 CP sửa tại chỗ: giảm KL giữ ưu tiên, đổi giá và tăng KL mất ưu tiên, đổi cả hai cùng lúc bị từ chối.',
  tcRefs: ['KRX-AMEND-01', 'KRX-AMEND-02', 'KRX-AMEND-03'],
  seed: 107,
  setup: (env) => openMarketAt(env, 118_500),
  steps: [
    {
      id: 'place',
      caption:
        'Đặt lệnh LO mua 1.000 CP FPT giá 118.000, thấp hơn giá khớp 118.500 nên lệnh nằm chờ trên sổ lệnh. Mốc ưu tiên thời gian là lúc lệnh vào sổ.',
      action: {
        type: 'placeOrder',
        params: { ref: 'order', symbol: SYMBOL, side: 'BUY', strategy_type: 'LIMIT', total_qty: 1_000, limit_price: 118_000, parameters: {} },
      },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:1}',
      checks: [
        { label: 'Một lệnh con LO 1.000 CP giá 118.000', fn: (s) => childrenOf(s).length === 1 && child(s).order_type === 'LO' && child(s).quantity === 1_000 && child(s).price === 118_000 },
        { label: 'Lệnh con đã lên sàn (ACKNOWLEDGED)', fn: (s) => child(s).status === 'ACKNOWLEDGED' },
      ],
    },
    {
      id: 'qty-down',
      caption: 'Giảm khối lượng còn 600 CP. KRX: giảm KL không làm mất ưu tiên thời gian, lệnh con được sửa tại chỗ, không hủy rồi đặt lại.',
      action: { type: 'amend', params: { order: 'order', total_qty: 600 } },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:1}',
      checks: [
        { label: 'Vẫn là lệnh con #1, KL 600', fn: (s) => childrenOf(s).length === 1 && child(s).quantity === 600 },
        { label: 'Giữ ưu tiên thời gian (mốc ưu tiên không đổi)', fn: keepsPriority },
        { label: 'MODIFY ghi loại sửa QTY_DOWN', fn: (s) => amendKinds(s).at(-1) === 'QTY_DOWN' },
      ],
    },
    {
      id: 'both-rejected',
      caption:
        'Thử đổi cùng lúc giá 118.100 và KL 800: bị từ chối vì mỗi lần sửa chỉ được đổi giá hoặc khối lượng. Trên hộp Sửa lệnh, sửa một ô thì ô kia bị khóa.',
      action: { type: 'amend', params: { order: 'order', total_qty: 800, limit_price: 118_100, expectError: true } },
      route: DETAIL_ROUTE,
      highlight: 'order-status',
      checks: [
        { label: 'Bị từ chối đúng lý do (chỉ giá hoặc KL)', fn: (s) => (s.ctx.lastError ?? '').includes('không đổi cả hai') },
        { label: 'Lệnh giữ nguyên: 600 CP, giá 118.000', fn: (s) => orderOf(s).total_qty === 600 && orderOf(s).limit_price === 118_000 },
      ],
    },
    {
      id: 'price',
      caption: 'Đổi giá lên 118.100. Đổi giá thì lệnh mất ưu tiên thời gian: mốc ưu tiên đặt lại bằng lúc sửa, xếp cuối hàng chờ ở mức giá mới.',
      action: { type: 'amend', params: { order: 'order', limit_price: 118_100 } },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:1}',
      checks: [
        { label: 'Lệnh con #1 giá 118.100, KL vẫn 600', fn: (s) => child(s).price === 118_100 && child(s).quantity === 600 },
        { label: 'Mất ưu tiên thời gian (mốc ưu tiên sau lúc vào sổ)', fn: (s) => !keepsPriority(s) },
        { label: 'MODIFY ghi loại sửa PRICE', fn: (s) => amendKinds(s).at(-1) === 'PRICE' },
      ],
    },
    {
      id: 'qty-up',
      caption: 'Tăng KL lên 900 CP. Tăng KL cũng mất ưu tiên như đổi giá, vì phần tăng thêm không được chen lên trước người đặt trước.',
      action: { type: 'amend', params: { order: 'order', total_qty: 900 } },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:1}',
      checks: [
        { label: 'Lệnh con #1 KL 900', fn: (s) => childrenOf(s).length === 1 && child(s).quantity === 900 },
        { label: 'MODIFY ghi loại sửa QTY_UP', fn: (s) => amendKinds(s).at(-1) === 'QTY_UP' },
      ],
    },
    {
      id: 'summary',
      caption: 'Nhật ký ghi đủ ba lần sửa theo loại: giảm KL (giữ ưu tiên), đổi giá và tăng KL (mất ưu tiên). Lần sửa bị từ chối không ghi gì.',
      action: { type: 'note' },
      route: DETAIL_ROUTE,
      highlight: 'event-log',
      checks: [{ label: 'Loại sửa: QTY_DOWN → PRICE → QTY_UP', fn: (s) => amendKinds(s).join(',') === 'QTY_DOWN,PRICE,QTY_UP' }],
    },
  ],
}
