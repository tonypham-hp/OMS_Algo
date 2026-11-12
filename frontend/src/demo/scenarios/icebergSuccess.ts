import type { Scenario } from '../types'
import { childrenOf, DETAIL_ROUTE, openMarketAt, orderOf, remainingOf, SYMBOL, workingOf } from './common'

// Scenario 1: Iceberg thành công. Giá thị trường đứng trên giá giới hạn nên lệnh con chỉ khớp khi Core báo khớp,
// để từng bước diễn ra đúng như tài liệu.
export const icebergSuccess: Scenario = {
  id: 'iceberg-success',
  number: 1,
  title: 'Iceberg thành công',
  summary: 'Lệnh 50.000 CP chia từng phần 10.000; một phần khớp thiếu thì phần sau tính theo số đã khớp thật.',
  tcRefs: ['TC-E2E-050', 'TC-E2E-051', 'TC-E2E-052', 'TC-E2E-220', 'TC-E2E-231'],
  seed: 101,
  setup: (env) => openMarketAt(env, 118_500),
  steps: [
    {
      id: 'place',
      caption:
        'Đặt lệnh Iceberg mua 50.000 CP FPT, mỗi phần 10.000. Hệ thống chỉ gửi xuống sàn phần đầu tiên, không đẩy cả 50.000 một lần để giấu khối lượng thật.',
      action: {
        type: 'placeOrder',
        params: {
          ref: 'order',
          symbol: SYMBOL,
          side: 'BUY',
          strategy_type: 'ICEBERG',
          total_qty: 50_000,
          limit_price: 118_000,
          parameters: { slice_qty: 10_000 },
        },
      },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:1}',
      checks: [
        { label: 'Lệnh cha ACTIVE, chưa khớp', fn: (s) => orderOf(s).status === 'ACTIVE' && orderOf(s).executed_qty === 0 },
        {
          label: 'Chỉ có 1 lệnh con 10.000, không gửi cả 50.000',
          fn: (s) => childrenOf(s).length === 1 && childrenOf(s)[0].quantity === 10_000,
        },
      ],
    },
    {
      id: 'fill-first',
      caption:
        'Core báo lệnh con #1 khớp đủ 10.000. Phần trước kết thúc thì Iceberg mới gửi phần tiếp theo, cũng 10.000.',
      action: { type: 'coreFill', params: { order: 'order', child: 1 } },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:2}',
      checks: [
        { label: 'Đã khớp 10.000', fn: (s) => orderOf(s).executed_qty === 10_000 },
        { label: 'Lệnh con #2 = 10.000', fn: (s) => childrenOf(s)[1]?.quantity === 10_000 },
      ],
    },
    {
      id: 'partial',
      caption:
        'Lệnh con #2 mới khớp 5.000. Phần còn lại vẫn đang nằm trên sàn nên Iceberg chưa sinh lệnh con mới, tránh gửi trùng khối lượng.',
      action: { type: 'coreFill', params: { order: 'order', child: 2, qty: 5_000 } },
      route: DETAIL_ROUTE,
      highlight: 'child-status-{child:order:2}',
      checks: [
        { label: 'Vẫn chỉ có 2 lệnh con', fn: (s) => childrenOf(s).length === 2 },
        { label: 'KL đang chờ trên sàn = 5.000', fn: (s) => workingOf(s) === 5_000 },
      ],
    },
    {
      id: 'core-cancel',
      caption:
        'Core hủy 5.000 chưa khớp của #2. Lệnh con kế tiếp tính theo số đã khớp thật (15.000), nên còn lại 35.000 chứ không phải 30.000.',
      action: { type: 'coreCancelChild', params: { order: 'order', child: 2 } },
      route: DETAIL_ROUTE,
      highlight: 'order-executed',
      checks: [
        { label: 'Đã khớp 15.000, còn lại 35.000', fn: (s) => orderOf(s).executed_qty === 15_000 && remainingOf(s) === 35_000 },
        { label: 'Lệnh con #3 = 10.000', fn: (s) => childrenOf(s)[2]?.quantity === 10_000 },
      ],
    },
    {
      id: 'fill-rest',
      caption:
        'Các phần sau lần lượt khớp. Phần cuối chỉ còn 5.000 nên lệnh con cuối là 5.000: thứ tự 10.000 → 10.000 → 5.000, không gửi dư.',
      action: { type: 'fillUntilDone', params: { order: 'order' } },
      route: DETAIL_ROUTE,
      highlight: 'executions',
      checks: [
        { label: 'Lệnh con cuối = 5.000', fn: (s) => childrenOf(s).at(-1)?.quantity === 5_000 },
        { label: 'Không lệnh con nào vượt 10.000', fn: (s) => childrenOf(s).every((child) => child.quantity <= 10_000) },
      ],
    },
    {
      id: 'completed',
      caption:
        'Lệnh hoàn tất: đã khớp đúng 50.000, còn lại 0, không còn lệnh con chờ. KL của lệnh cha bằng đúng tổng các lần khớp.',
      action: { type: 'note' },
      route: DETAIL_ROUTE,
      highlight: 'order-status',
      checks: [
        { label: 'COMPLETED, khớp 50.000, còn lại 0', fn: (s) => orderOf(s).status === 'COMPLETED' && remainingOf(s) === 0 },
        { label: 'Không còn lệnh con đang chờ', fn: (s) => workingOf(s) === 0 },
      ],
    },
  ],
}
