import { describe, expect, it } from 'vitest'
import { STRATEGIES } from '@/config/strategies'
import type { DemoUser } from '@/types'
import { buildReportRows } from '@/utils/execQuality'
import { DEMO_USERS } from './data'
import { createOrderEngine } from './engine'
import { createMarketTape } from './marketTape'
import { buildExecutionReport, type ReportSource } from './report'
import { createSeedData } from './seedOrders'

const NOW = new Date(2026, 10, 11)
const user = (username: string) => DEMO_USERS.find((item) => item.username === username) as DemoUser

function seededSource(): ReportSource {
  const seed = createSeedData(NOW)
  const engine = createOrderEngine()
  engine.load(seed)
  const tape = createMarketTape()
  tape.load(seed.tape ?? [])
  return {
    tradingDate: '2026-11-11',
    now: '2026-11-11T09:10:00',
    orders: engine.listOrders(),
    children: engine.listChildren(),
    executions: engine.listExecutions(),
    getSnapshot: engine.getSnapshot,
    listTicks: tape.list,
  }
}

describe('báo cáo hiệu quả: quyền xem', () => {
  const source = seededSource()

  it('CUSTOMER chỉ thấy lệnh, lệnh con, lần khớp của tài khoản mình', () => {
    const customer = user('khachhang')
    const report = buildExecutionReport(customer, source)
    const own = new Set(report.orders.map((order) => order.parent_order_id))
    expect(report.orders.length).toBeGreaterThan(0)
    expect(report.orders.every((order) => customer.accounts.includes(order.account_no))).toBe(true)
    expect(report.children.every((child) => own.has(child.parent_order_id))).toBe(true)
    expect(report.executions.every((execution) => own.has(execution.parent_order_id))).toBe(true)
    expect(Object.keys(report.market).every((id) => own.has(id))).toBe(true)
    expect(source.orders.some((order) => !customer.accounts.includes(order.account_no))).toBe(true)
  })

  it('DEALER thấy mọi lệnh của các tài khoản quản lý; OPS thấy tất cả', () => {
    expect(buildExecutionReport(user('dealer'), source).orders).toHaveLength(source.orders.length)
    expect(buildExecutionReport(user('vanhanh'), source).orders).toHaveLength(source.orders.length)
  })
})

describe('lệnh mẫu cho báo cáo hiệu quả', () => {
  const rows = buildReportRows(buildExecutionReport(user('vanhanh'), seededSource()))
  const completed = rows.filter((row) => row.order.status === 'COMPLETED')

  it('có ít nhất 5 lệnh đã hoàn tất, đủ 5 chiến lược, cả mua và bán', () => {
    expect(completed.length).toBeGreaterThanOrEqual(5)
    const strategies = new Set(completed.map((row) => row.order.strategy_type))
    for (const type of ['ICEBERG', 'TWAP', 'POV', 'VWAP', 'HUNT'] as const) {
      expect(strategies.has(type), STRATEGIES[type].label).toBe(true)
    }
    expect(new Set(completed.map((row) => row.order.side))).toEqual(new Set(['BUY', 'SELL']))
  })

  it('có cả lệnh có lợi và bất lợi; mọi lệnh hoàn tất đều có VWAP và tỷ lệ tham gia trong (0, 100%]', () => {
    expect(completed.some((row) => row.arrivalFavorable === true)).toBe(true)
    expect(completed.some((row) => row.arrivalFavorable === false)).toBe(true)
    for (const row of completed) {
      expect(row.vwap).not.toBeNull()
      expect(row.participation).toBeGreaterThan(0)
      expect(row.participation).toBeLessThanOrEqual(1)
      expect(row.order.updated_at > row.order.created_at).toBe(true)
    }
  })

  it('lệnh đã hoàn tất nằm trong 5 phiên gần nhất', () => {
    for (const row of completed) expect(row.completedAt?.slice(0, 10) >= '2026-11-05').toBe(true)
  })
})
