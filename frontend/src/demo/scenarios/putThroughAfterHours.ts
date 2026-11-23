import { parseTimeToSeconds } from '@/utils/hose'
import type { DemoState, Scenario } from '../types'
import { SYMBOL } from './common'

// Scenario 12 (Đợt 8B): lệnh thỏa thuận trong phiên thỏa thuận sau giờ 14:45–15:00.

const ROUTE = '/so-lenh?tab=thoa-thuan'
const dealOf = (s: DemoState) => s.env.engine.listPutThroughs().find((deal) => deal.deal_id === s.ctx.refs.deal)
const quoteOf = (s: DemoState) => s.env.simulator.getState().quotes.find((quote) => quote.symbol === SYMBOL)
const errorHas = (s: DemoState, text: string) => (s.ctx.lastError ?? '').includes(text)
const deal = (ref: string, extra: Record<string, unknown> = {}) => ({
  type: 'putThrough' as const,
  params: { ref, symbol: SYMBOL, side: 'BUY' as const, qty: 20_000, price: 118_050, ...extra },
})

export const putThroughAfterHours: Scenario = {
  id: 'put-through-after-hours',
  number: 12,
  title: 'Thỏa thuận sau giờ 14:45–15:00',
  summary: 'Lệnh thỏa thuận FPT lúc 14:50: dưới 20.000 CP hoặc ngoài biên bị từ chối; 20.000 CP được đối ứng xác nhận thì khớp, không đổi sổ lệnh.',
  tcRefs: ['KRX-PT-01', 'KRX-PT-02', 'KRX-PT-03'],
  seed: 112,
  setup: (env) => {
    env.simulator.jumpTo(parseTimeToSeconds('14:50') as number)
    env.simulator.advance(1)
  },
  steps: [
    {
      id: 'min-qty',
      caption: '14:50 là phiên thỏa thuận sau giờ, khớp lệnh đã đóng. Thỏa thuận 10.000 CP bị từ chối: trên HOSE tối thiểu 20.000 CP.',
      action: deal('small', { qty: 10_000, expectError: true }),
      route: ROUTE,
      checks: [
        { label: 'Đang ở phiên thỏa thuận sau giờ', fn: (s) => s.env.simulator.getState().session === 'PUT_THROUGH' },
        { label: 'Bị từ chối: tối thiểu 20.000 CP', fn: (s) => errorHas(s, 'tối thiểu 20.000 CP') },
      ],
    },
    {
      id: 'band',
      caption: 'Thỏa thuận giá 130.000 bị từ chối: giá thỏa thuận vẫn phải nằm trong trần – sàn của mã (trần FPT 126.200).',
      action: deal('band', { price: 130_000, expectError: true }),
      checks: [{ label: 'Bị từ chối: vượt giá trần 126.200', fn: (s) => errorHas(s, 'vượt giá trần 126.200') }],
    },
    {
      id: 'send',
      caption: 'Gửi thỏa thuận mua 20.000 CP giá 118.050 (bước giá thỏa thuận 1 đ). Lệnh chờ bên đối ứng xác nhận.',
      action: deal('deal'),
      route: ROUTE,
      highlight: 'put-through-table',
      checks: [{ label: 'Chờ đối ứng xác nhận', fn: (s) => dealOf(s)?.status === 'PENDING_CONFIRM' }],
    },
    {
      id: 'confirm',
      caption: 'Bên đối ứng (mô phỏng) xác nhận: lệnh khớp ngay. Giao dịch thỏa thuận không qua sổ lệnh nên sổ lệnh 3 mức và KL khớp lệnh không đổi.',
      action: { type: 'confirmPutThrough', params: { ref: 'deal' } },
      route: ROUTE,
      highlight: 'put-through-table',
      checks: [
        { label: 'Đã khớp 20.000 CP giá 118.050', fn: (s) => dealOf(s)?.status === 'MATCHED' && dealOf(s)?.qty === 20_000 },
        { label: 'Không có khớp lệnh nào, KL khớp lệnh của FPT không đổi', fn: (s) => s.executions.length === 0 && quoteOf(s)?.total_volume === 0 },
      ],
    },
    {
      id: 'cancel-locked',
      caption: 'Thử hủy lệnh thỏa thuận đã khớp: bị từ chối, vì đã khớp thì không sửa, không hủy được.',
      action: { type: 'cancelPutThrough', params: { ref: 'deal', expectError: true } },
      route: ROUTE,
      checks: [
        { label: 'Bị từ chối: đã khớp', fn: (s) => errorHas(s, 'đã khớp: không sửa, không hủy được') },
        { label: 'Vẫn ở trạng thái đã khớp', fn: (s) => dealOf(s)?.status === 'MATCHED' },
      ],
    },
  ],
}
