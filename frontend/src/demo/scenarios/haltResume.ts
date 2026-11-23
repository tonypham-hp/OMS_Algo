import type { DemoState, Scenario } from '../types'
import { childrenOf, DETAIL_ROUTE, openMarketAt, orderOf, SYMBOL } from './common'

// Scenario 11 (Đợt 8B): vận hành tạm ngừng mã → lệnh cha PAUSED_SYSTEM; giao dịch lại → phiên khớp định kỳ 15 phút
// chỉ nhận LO, cấm sửa/hủy → khớp một lần → về lịch bình thường.

const quoteOf = (s: DemoState) => s.env.simulator.getState().quotes.find((quote) => quote.symbol === SYMBOL)
const errorHas = (s: DemoState, text: string) => (s.ctx.lastError ?? '').includes(text)

export const haltResume: Scenario = {
  id: 'halt-resume',
  number: 11,
  title: 'Tạm ngừng và giao dịch lại',
  summary: 'FPT bị tạm ngừng: lệnh đang chạy chuyển "Hệ thống tạm dừng"; giao dịch lại qua phiên khớp định kỳ 15 phút rồi lệnh tự chạy và khớp.',
  tcRefs: ['KRX-HALT-01', 'KRX-HALT-02', 'KRX-HALT-03'],
  seed: 111,
  setup: (env) => openMarketAt(env, 118_500),
  steps: [
    {
      id: 'place',
      caption: 'Đặt LO mua 1.000 CP FPT giá 118.000, thấp hơn giá khớp 118.500 nên lệnh nằm chờ trên sổ lệnh.',
      action: {
        type: 'placeOrder',
        params: { ref: 'order', symbol: SYMBOL, side: 'BUY', strategy_type: 'LIMIT', total_qty: 1_000, limit_price: 118_000, parameters: {} },
      },
      route: DETAIL_ROUTE,
      highlight: 'child-{child:order:1}',
      checks: [{ label: 'Lệnh con LO đã lên sàn', fn: (s) => childrenOf(s)[0]?.status === 'ACKNOWLEDGED' }],
    },
    {
      id: 'halt',
      caption:
        'Vận hành tạm ngừng giao dịch FPT. Lệnh cha chuyển "Hệ thống tạm dừng" với lý do mã tạm ngừng, lệnh con đang chờ bị hủy để không còn lệnh treo trên sàn.',
      action: { type: 'haltSymbol', params: { symbol: SYMBOL } },
      route: DETAIL_ROUTE,
      highlight: 'order-status',
      checks: [
        { label: 'Lệnh cha PAUSED_SYSTEM, lý do SYMBOL_HALTED', fn: (s) => orderOf(s).status === 'PAUSED_SYSTEM' && orderOf(s).reason_code === 'SYMBOL_HALTED' },
        { label: 'Lệnh con đã hủy', fn: (s) => childrenOf(s)[0]?.status === 'CANCELLED' },
      ],
    },
    {
      id: 'reject-new',
      caption: 'Đặt lệnh mới trên FPT lúc đang tạm ngừng: bị từ chối ngay ở bước kiểm tra.',
      action: {
        type: 'placeOrder',
        params: { ref: 'blocked', symbol: SYMBOL, side: 'BUY', strategy_type: 'LIMIT', total_qty: 1_000, limit_price: 118_000, parameters: {}, expectError: true },
      },
      checks: [{ label: 'Bị từ chối: mã đang tạm ngừng giao dịch', fn: (s) => errorHas(s, 'tạm ngừng giao dịch') }],
    },
    {
      id: 'resume',
      caption:
        'Vận hành cho FPT giao dịch lại. Mã vào phiên khớp định kỳ 15 phút: chỉ nhận LO, cấm sửa, hủy. Lệnh cha tự chạy lại và gửi lại lệnh con.',
      action: { type: 'resumeSymbol', params: { symbol: SYMBOL } },
      route: DETAIL_ROUTE,
      highlight: 'order-status',
      checks: [
        { label: 'FPT trong phiên khớp định kỳ sau tạm ngừng', fn: (s) => quoteOf(s)?.phase?.session === 'REOPEN' },
        { label: 'Lệnh cha tự chạy lại (SYMBOL_RESUMED)', fn: (s) => orderOf(s).status === 'ACTIVE' && s.events.some((event) => event.reason_code === 'SYMBOL_RESUMED') },
      ],
    },
    {
      id: 'amend-locked',
      caption: 'Thử giảm KL còn 800 trong phiên mở lại: bị từ chối vì phiên khớp định kỳ sau tạm ngừng cấm sửa, hủy.',
      action: { type: 'amend', params: { order: 'order', total_qty: 800, expectError: true } },
      settle: 0,
      checks: [{ label: 'Bị từ chối: phiên khớp định kỳ sau tạm ngừng', fn: (s) => errorHas(s, 'Khớp định kỳ sau tạm ngừng') }],
    },
    {
      id: 'reopen-match',
      caption:
        'Giá dự kiến về 117.900. Hết 15 phút, phiên mở lại khớp một lần ở giá 117.900 (thấp hơn giá mua 118.000), lệnh khớp đủ. FPT trở về khớp lệnh liên tục.',
      action: { type: 'trade', params: { symbol: SYMBOL, price: 117_900, qty: 100, repeat: 1, everySeconds: 900 } },
      route: DETAIL_ROUTE,
      highlight: 'executions',
      checks: [
        { label: 'Khớp đủ 1.000 CP giá 117.900', fn: (s) => orderOf(s).status === 'COMPLETED' && s.executions.some((item) => item.price === 117_900 && item.qty === 1_000) },
        { label: 'FPT về lịch bình thường', fn: (s) => quoteOf(s)?.phase === undefined && quoteOf(s)?.halt === undefined },
      ],
    },
  ],
}
