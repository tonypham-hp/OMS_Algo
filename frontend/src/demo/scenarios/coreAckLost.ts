import type { Scenario } from '../types'
import { childrenOf, countEvents, DETAIL_ROUTE, openMarketAt, orderOf, workingOf } from './common'

const SECOND = { order: 'order', child: 2 } as const

// Scenario 5: Core mất ACK → UNKNOWN → đối soát. Lỗi "Core đã tạo lệnh nhưng mất ACK" được bơm vào lệnh con #2.
// Số nhịp ở các bước theo engine: chờ ACK 3 nhịp (ACK_TIMEOUT_SECONDS), đối soát tự động sau 5 nhịp.
export const coreAckLost: Scenario = {
  id: 'core-ack-lost',
  number: 5,
  title: 'Core mất ACK → UNKNOWN → đối soát',
  summary: 'Core nhận lệnh nhưng mất phản hồi: lệnh con chuyển UNKNOWN, hệ thống không gửi lại mà đối soát rồi chạy tiếp.',
  tcRefs: ['TC-E2E-140', 'TC-E2E-141', 'TC-E2E-150'],
  seed: 505,
  setup: (env) => openMarketAt(env, 118_500),
  steps: [
    {
      id: 'place',
      caption: 'Đặt Iceberg mua 30.000 CP, mỗi phần 10.000. Lệnh con #1 đã xuống sàn và được Core xác nhận.',
      action: {
        type: 'placeOrder',
        params: {
          ref: 'order',
          symbol: 'FPT',
          side: 'BUY',
          strategy_type: 'ICEBERG',
          total_qty: 30_000,
          limit_price: 118_000,
          parameters: { slice_qty: 10_000 },
        },
      },
      route: DETAIL_ROUTE,
      highlight: 'child-status-{child:order:1}',
      checks: [{ label: 'Lệnh con #1 đã được Core xác nhận', fn: (s) => childrenOf(s)[0]?.status === 'ACKNOWLEDGED' }],
    },
    {
      id: 'arm-fault',
      caption:
        'Bơm lỗi cho lần gửi kế tiếp: Core sẽ tạo lệnh nhưng phản hồi (ACK) bị mất trên đường về. Đây là tình huống nguy hiểm nhất khi nối Core thật.',
      action: { type: 'injectTimeout', params: { order: 'order', afterCore: true } },
      settle: 0,
      route: DETAIL_ROUTE,
    },
    {
      id: 'send-second',
      caption: 'Lệnh con #1 khớp đủ, Iceberg gửi #2. Core đã nhận #2 nhưng hệ thống chưa thấy ACK, nên #2 đang ở SENDING.',
      action: { type: 'coreFill', params: { order: 'order', child: 1 } },
      settle: 2,
      route: DETAIL_ROUTE,
      highlight: 'child-status-{child:order:2}',
      checks: [{ label: 'Lệnh con #2 đang SENDING', fn: (s) => childrenOf(s)[1]?.status === 'SENDING' }],
    },
    {
      id: 'unknown',
      caption:
        'Hết 3 giây vẫn không có ACK: #2 chuyển UNKNOWN. Hệ thống không biết Core có đang giữ lệnh hay không, nên vẫn tính 10.000 của #2 là đang chờ và KHÔNG gửi lệnh thay thế.',
      action: { type: 'advance', params: { seconds: 3 } },
      settle: 0,
      route: DETAIL_ROUTE,
      highlight: 'child-status-{child:order:2}',
      waitMs: 6000,
      checks: [
        { label: 'Lệnh con #2 UNKNOWN', fn: (s) => childrenOf(s)[1]?.status === 'UNKNOWN' },
        { label: 'UNKNOWN vẫn tính là working: đang chờ 10.000', fn: (s) => workingOf(s) === 10_000 },
        { label: 'allowed = 30.000 − 10.000 − 10.000 = 10.000', fn: (s) => s.env.engine.getAllowedQty(orderOf(s).parent_order_id) === 10_000 },
        { label: 'Không sinh lệnh con #3 khi #2 chưa đối soát', fn: (s) => childrenOf(s).length === 2 },
      ],
    },
    {
      id: 'reconcile',
      caption:
        'Hệ thống tra Core theo client_order_id và thấy lệnh #2 đang tồn tại: giữ nguyên #2, chuyển ACKNOWLEDGED, không gửi lần hai.',
      action: { type: 'advance', params: { seconds: 5 } },
      route: DETAIL_ROUTE,
      highlight: 'child-status-{child:order:2}',
      checks: [
        { label: 'Lệnh con #2 về ACKNOWLEDGED, có mã lệnh Core', fn: (s) => childrenOf(s)[1]?.status === 'ACKNOWLEDGED' && childrenOf(s)[1]?.core_order_id !== null },
        { label: 'Vẫn là client_order_id cũ, không có lệnh gửi lại', fn: (s) => childrenOf(s).length === 2 && childrenOf(s)[1]?.cycle_no === 2 },
        { label: 'Có event đối soát (RECOVERY)', fn: (s) => countEvents(s, 'RECOVERY') === 1 },
      ],
    },
    {
      id: 'fill-second',
      caption: '#2 khớp đủ 10.000. Iceberg chạy tiếp với #3 như chưa có sự cố.',
      action: { type: 'coreFill', params: SECOND },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:3}',
      checks: [
        { label: 'Đã khớp 20.000', fn: (s) => orderOf(s).executed_qty === 20_000 },
        { label: 'Lệnh con #3 = 10.000', fn: (s) => childrenOf(s)[2]?.quantity === 10_000 },
      ],
    },
    {
      id: 'duplicate',
      caption:
        'Core gửi lại đúng báo khớp vừa rồi (cùng mã khớp). Hệ thống nhận ra trùng và bỏ qua, KL đã khớp không bị cộng hai lần.',
      action: { type: 'duplicateFill', params: { order: 'order' } },
      route: DETAIL_ROUTE,
      highlight: 'event-log',
      checks: [
        { label: 'Đã khớp vẫn 20.000', fn: (s) => orderOf(s).executed_qty === 20_000 },
        { label: 'Có event bỏ qua báo khớp trùng', fn: (s) => s.events.some((event) => event.new_value === 'IGNORED') },
      ],
    },
    {
      id: 'done',
      caption: 'Phần cuối khớp, lệnh hoàn tất 30.000. Từ đầu tới cuối không có lệnh con nào bị gửi trùng.',
      action: { type: 'fillUntilDone', params: { order: 'order' } },
      route: DETAIL_ROUTE,
      highlight: 'order-status',
      checks: [
        { label: 'COMPLETED, khớp 30.000', fn: (s) => orderOf(s).status === 'COMPLETED' && orderOf(s).executed_qty === 30_000 },
        { label: 'Đúng 3 lệnh con', fn: (s) => childrenOf(s).length === 3 },
      ],
    },
  ],
}
