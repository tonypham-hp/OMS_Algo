import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { DEMO_USERS } from '@/mocks/data'
import { EngineError, createOrderEngine } from '@/mocks/engine'
import { buildHistory, createReconApi } from '@/mocks/historyApi'
import { createSeedData } from '@/mocks/seedOrders'
import { useAuthStore } from '@/store/auth.store'
import type { DemoUser } from '@/types'
import { MASKED_ACTOR } from '@/utils/audit'
import { defaultDateRange, resolveDateRange } from '@/utils/dateRange'
import History from './index'
import { ReconTab } from './ReconTab'
import { HISTORY_TABS, resolveTab } from './tabs'

const TODAY = '2026-11-16'
const NOW = `${TODAY}T09:10:00`
const user = (username: string) => DEMO_USERS.find((item) => item.username === username)!
const CUSTOMER = user('khachhang')
const DEALER = user('dealer')
const OPS = user('vanhanh')
const OPS2 = user('vanhanh2')

function setup() {
  const engine = createOrderEngine()
  engine.load(createSeedData(new Date(2026, 10, 16, 9, 10)))
  return { engine, api: createReconApi(engine, () => NOW, () => TODAY) }
}

function render(node: React.ReactNode, who: DemoUser, client = new QueryClient(), path = '/bao-cao/lich-su') {
  // Render phía server: zustand đọc snapshot ban đầu (getInitialState), không đọc setState.
  // getInitialState trả về đúng đối tượng trạng thái ban đầu của store, nên gán thẳng vào đó.
  useAuthStore.getInitialState().user = who
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => {
  useAuthStore.getInitialState().user = null
})

const thrown = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return error as EngineError
  }
  throw new Error('Không ném lỗi')
}

describe('Phân quyền màn Lịch sử và đối soát', () => {
  it('CUSTOMER không thấy tab Đối soát, kể cả gõ ?tab=doi-soat; DEALER, OPS thấy', () => {
    const tabs = (who: DemoUser) => render(<History />, who, new QueryClient(), '/bao-cao/lich-su?tab=doi-soat')
    expect(tabs(CUSTOMER)).toContain('Nhật ký kiểm toán')
    expect(tabs(CUSTOMER)).not.toContain('>Đối soát<')
    expect(tabs(DEALER)).toContain('>Đối soát<')
    expect(tabs(OPS)).toContain('>Đối soát<')
    expect(resolveTab(HISTORY_TABS.recon, false)).toBe(HISTORY_TABS.history)
    expect(resolveTab(HISTORY_TABS.recon, true)).toBe(HISTORY_TABS.recon)
    expect(resolveTab('la', true)).toBe(HISTORY_TABS.history)
  })

  it('API lịch sử của CUSTOMER: chỉ lệnh tài khoản của mình, không có user_id người khác', () => {
    const { engine } = setup()
    const data = buildHistory(engine, CUSTOMER, TODAY)
    expect(data.orders.length).toBeGreaterThan(0)
    expect(data.orders.every((order) => CUSTOMER.accounts.includes(order.account_no))).toBe(true)
    const visible = new Set(data.orders.map((order) => order.parent_order_id))
    expect(data.events.every((event) => visible.has(event.parent_order_id))).toBe(true)
    expect(data.children.every((child) => visible.has(child.parent_order_id))).toBe(true)
    const actors = new Set(data.events.map((event) => event.user_id))
    expect([...actors].every((actor) => ['khachhang', 'SYSTEM', 'seed', MASKED_ACTOR].includes(actor))).toBe(true)
    // Lệnh mẫu bị dealer hủy: khách hàng thấy "người dùng khác", dealer thấy đúng tên.
    expect(actors.has(MASKED_ACTOR)).toBe(true)
    expect(buildHistory(engine, DEALER, TODAY).events.some((event) => event.user_id === 'dealer')).toBe(true)
  })

  it('API đối soát: CUSTOMER bị 403; DEALER xem được nhưng không xử lý được', () => {
    const { api } = setup()
    const range = { from: '2026-11-10', to: TODAY }
    expect(thrown(() => api.get(CUSTOMER, range)).status).toBe(403)
    expect(thrown(() => api.run(CUSTOMER, range)).status).toBe(403)
    const rows = api.get(DEALER, range).rows
    expect(rows.length).toBeGreaterThan(0)
    const open = rows.find((row) => row.status === 'OPEN')!
    expect(thrown(() => api.decide(DEALER, { row_id: open.id, step: 'RESOLVE_REQUESTED', note: 'x', ...range })).status).toBe(403)
  })

  it('OPS: thiếu ghi chú không lưu được; người đánh dấu không tự duyệt; người thứ hai duyệt thì Đã xử lý', () => {
    const { api, engine } = setup()
    const range = { from: '2026-11-10', to: TODAY }
    const open = api.get(OPS, range).rows.find((row) => row.type === 'QTY_MISMATCH')!
    expect(thrown(() => api.decide(OPS, { row_id: open.id, step: 'RESOLVE_REQUESTED', note: '  ', ...range })).status).toBe(422)

    const pending = api.decide(OPS, { row_id: open.id, step: 'RESOLVE_REQUESTED', note: 'Core xác nhận 1.200', ...range })
    expect(pending.rows.find((row) => row.id === open.id)?.status).toBe('PENDING_APPROVAL')
    expect(thrown(() => api.decide(OPS, { row_id: open.id, step: 'RESOLVED', ...range })).message).toContain('không được tự duyệt')

    const resolved = api.decide(OPS2, { row_id: open.id, step: 'RESOLVED', ...range })
    expect(resolved.rows.find((row) => row.id === open.id)).toMatchObject({ status: 'RESOLVED', requested_by: 'vanhanh', approved_by: 'vanhanh2' })
    // Mỗi bước là một OrderEvent DECISION trong nhật ký của lệnh.
    const decisions = engine.getEvents(open.parent_order_id).filter((event) => event.old_value === `RECON:${open.id}`)
    expect(decisions.map((event) => [event.new_value, event.user_id])).toEqual([
      ['RESOLVE_REQUESTED', 'vanhanh'],
      ['RESOLVED', 'vanhanh2'],
    ])
  })

  it('Đối soát ngay tra Core cho lệnh con UNKNOWN và ghi lần chạy gần nhất', () => {
    const { api } = setup()
    const range = { from: '2026-11-10', to: TODAY }
    expect(api.get(DEALER, range).rows.some((row) => row.type === 'UNKNOWN_OPEN')).toBe(true)
    const after = api.run(DEALER, range)
    expect(after.rows.some((row) => row.type === 'UNKNOWN_OPEN')).toBe(false)
    expect(after).toMatchObject({ last_run_at: NOW, last_run_by: 'dealer' })
  })

  it('DEALER không có nút "Đánh dấu đã xử lý"; OPS có', () => {
    const { api } = setup()
    const range = resolveDateRange(defaultDateRange('FIVE_SESSIONS'), TODAY)
    const markup = (who: DemoUser) => {
      const client = new QueryClient()
      client.setQueryData(['reconciliation', who.username, range.from, range.to], api.get(who, range))
      return render(<ReconTab tradingDate={TODAY} />, who, client)
    }
    const dealer = markup(DEALER)
    expect(dealer).toContain('Đối soát ngay')
    expect(dealer).toContain('QTY_MISMATCH')
    expect(dealer).not.toContain('Đánh dấu đã xử lý')
    expect(markup(OPS)).toContain('Đánh dấu đã xử lý')
  })
})
