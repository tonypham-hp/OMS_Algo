import { describe, expect, it } from 'vitest'
import { createOrderEngine } from '@/mocks/engine'
import { DEMO_USERS } from '@/mocks/data'
import { buildHistory } from '@/mocks/historyApi'
import { createSeedData } from '@/mocks/seedOrders'
import type { HistoryData, OrderEvent, ParentOrder } from '@/types'
import { CSV_BOM, CSV_DELIMITER } from './csv'
import { ALL } from './execQuality'
import {
  buildHistoryCsv,
  buildHistoryRows,
  countSessions,
  DEFAULT_HISTORY_FILTERS,
  filterHistoryRows,
  formatCompletionRate,
  getHistoryTotals,
  HISTORY_COLUMNS,
  isHistoryOrder,
  paginate,
  sortHistoryRows,
  type HistoryFilters,
} from './history'

const TODAY = '2026-11-16'
const order = (overrides: Partial<ParentOrder>): ParentOrder => ({
  parent_order_id: 'P',
  client_request_id: 'r',
  account_no: '058C123456',
  symbol: 'FPT',
  side: 'BUY',
  total_qty: 1_000,
  executed_qty: 0,
  limit_price: 100_000,
  strategy_type: 'ICEBERG',
  status: 'COMPLETED',
  reason_code: null,
  valid_from: `${TODAY}T09:15:00`,
  valid_to: TODAY,
  persistence_mode: 'DAY',
  version: 1,
  created_at: `${TODAY}T09:15:00`,
  updated_at: `${TODAY}T10:00:00`,
  ...overrides,
})
const carry = (parentId: string, day: string): OrderEvent => ({
  event_id: `E-${parentId}-${day}`,
  parent_order_id: parentId,
  child_order_id: null,
  action: 'DECISION',
  user_id: 'SYSTEM',
  channel: 'ENGINE',
  old_value: `SESSION:${day}`,
  new_value: 'CARRY_OVER:500',
  event_time: `${day}T15:00:00`,
})

/** 3 lệnh: hoàn tất 11/11, hủy 13/11, nhiều phiên chạy từ 12/11 tới hôm nay (2 lần mang sang phiên sau). */
function sample(): HistoryData {
  return {
    trading_date: TODAY,
    orders: [
      order({ parent_order_id: 'A', created_at: '2026-11-11T09:30:00', updated_at: '2026-11-11T10:00:00', total_qty: 1_000, executed_qty: 1_000 }),
      order({ parent_order_id: 'B', symbol: 'HPG', status: 'CANCELLED', created_at: '2026-11-13T09:30:00', updated_at: '2026-11-13T10:00:00' }),
      order({
        parent_order_id: 'C',
        status: 'PARTIALLY_EXECUTED',
        persistence_mode: 'MULTI_SESSION',
        created_at: '2026-11-12T09:30:00',
        updated_at: '2026-11-13T14:00:00',
        total_qty: 2_000,
      }),
      // Lệnh trong ngày đang chạy: không thuộc lịch sử.
      order({ parent_order_id: 'D', status: 'ACTIVE' }),
    ],
    children: [],
    executions: [
      { execution_id: 'X1', child_order_id: 'A-1', parent_order_id: 'A', exchange_match_id: 'M1', price: 100_000, qty: 1_000, match_time: '2026-11-11T09:40:00' },
      { execution_id: 'X2', child_order_id: 'C-1', parent_order_id: 'C', exchange_match_id: 'M2', price: 100_000, qty: 500, match_time: '2026-11-12T09:40:00' },
    ],
    snapshots: {},
    events: [carry('C', '2026-11-12'), carry('C', '2026-11-13')],
  }
}

const withFilters = (patch: Partial<HistoryFilters>): HistoryFilters => ({ ...DEFAULT_HISTORY_FILTERS, ...patch })
const ids = (rows: ReturnType<typeof buildHistoryRows>) => rows.map((row) => row.order.parent_order_id).sort()

describe('Lịch sử lệnh', () => {
  it('chỉ lấy lệnh đã kết thúc và lệnh nhiều phiên còn chạy', () => {
    expect(isHistoryOrder(order({ status: 'EXPIRED' }))).toBe(true)
    expect(isHistoryOrder(order({ status: 'ACTIVE' }))).toBe(false)
    expect(isHistoryOrder(order({ status: 'PAUSED_USER', persistence_mode: 'GTD' }))).toBe(true)
    expect(ids(buildHistoryRows(sample()))).toEqual(['A', 'B', 'C'])
  })

  it('số phiên đã chạy = 1 + số lần mang sang phiên sau', () => {
    const data = sample()
    expect(countSessions('C', data.events)).toBe(3)
    expect(countSessions('A', data.events)).toBe(1)
    const c = buildHistoryRows(data).find((row) => row.order.parent_order_id === 'C')!
    expect(c).toMatchObject({ firstDate: '2026-11-12', date: TODAY, isLive: true, sessions: 3 })
  })

  it('lọc nhiều phiên đúng: lệnh nhiều phiên thuộc mọi khoảng có giao với các phiên nó chạy', () => {
    const rows = buildHistoryRows(sample())
    expect(ids(filterHistoryRows(rows, withFilters({ range: { preset: 'FIVE_SESSIONS', from: '', to: '' } }), TODAY))).toEqual(['A', 'B', 'C'])
    expect(ids(filterHistoryRows(rows, withFilters({ range: { preset: 'TODAY', from: '', to: '' } }), TODAY))).toEqual(['C'])
    expect(ids(filterHistoryRows(rows, withFilters({ range: { preset: 'CUSTOM', from: '2026-11-11', to: '2026-11-11' } }), TODAY))).toEqual(['A'])
    expect(ids(filterHistoryRows(rows, withFilters({ range: { preset: 'CUSTOM', from: '2026-11-12', to: '2026-11-12' } }), TODAY))).toEqual(['C'])
    // Nhập ngược thì đổi chỗ.
    expect(ids(filterHistoryRows(rows, withFilters({ range: { preset: 'CUSTOM', from: '2026-11-13', to: '2026-11-11' } }), TODAY))).toEqual(['A', 'B', 'C'])
  })

  it('lọc theo trạng thái (gồm Đang chạy nhiều phiên), mã CK', () => {
    const rows = buildHistoryRows(sample())
    expect(ids(filterHistoryRows(rows, withFilters({ status: 'RUNNING' }), TODAY))).toEqual(['C'])
    expect(ids(filterHistoryRows(rows, withFilters({ status: 'CANCELLED' }), TODAY))).toEqual(['B'])
    expect(ids(filterHistoryRows(rows, withFilters({ symbol: 'HPG', status: ALL }), TODAY))).toEqual(['B'])
  })

  it('dòng tổng đúng: số lệnh, tổng KL khớp, tỷ lệ hoàn tất trên lệnh đã kết thúc', () => {
    const totals = getHistoryTotals(buildHistoryRows(sample()))
    expect(totals).toEqual({ count: 3, filledQty: 1_500, completionRate: 0.5 })
    expect(formatCompletionRate(totals.completionRate)).toBe('50,0%')
    expect(getHistoryTotals([]).completionRate).toBeNull()
  })

  it('sắp xếp theo cột, phân trang 50 dòng', () => {
    const rows = buildHistoryRows(sample())
    expect(sortHistoryRows(rows, 'sessions', 'desc')[0].order.parent_order_id).toBe('C')
    expect(sortHistoryRows(rows, 'date', 'asc').map((row) => row.order.parent_order_id)).toEqual(['A', 'B', 'C'])
    const many = Array.from({ length: 120 }, (_, index) => index)
    expect(paginate(many, 1)).toMatchObject({ page: 1, pageCount: 3, total: 120, size: 50 })
    expect(paginate(many, 3).rows).toHaveLength(20)
    expect(paginate(many, 9).page).toBe(3)
  })

  it('CSV có BOM, đúng cột và đúng các dòng của bộ lọc', () => {
    const rows = filterHistoryRows(buildHistoryRows(sample()), withFilters({ status: 'RUNNING' }), TODAY)
    const csv = buildHistoryCsv(rows)
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines).toHaveLength(rows.length + 1)
    expect(lines[0].split(CSV_DELIMITER)).toHaveLength(HISTORY_COLUMNS.length + 1)
    expect(lines[0]).toContain('Số phiên')
    expect(lines[1]).toContain('C')
    expect(lines[1]).toContain('(đang chạy)')
  })

  it('dữ liệu mẫu: 5 phiên có đủ hoàn tất, hủy, hết hạn và lệnh nhiều phiên', () => {
    const engine = createOrderEngine()
    engine.load(createSeedData(new Date(2026, 10, 16, 9, 10)))
    const data = buildHistory(engine, DEMO_USERS.find((user) => user.username === 'vanhanh')!, TODAY)
    const rows = filterHistoryRows(buildHistoryRows(data), DEFAULT_HISTORY_FILTERS, TODAY)
    const statuses = new Set(rows.map((row) => row.order.status))
    for (const status of ['COMPLETED', 'CANCELLED', 'EXPIRED'] as const) expect(statuses.has(status), status).toBe(true)
    expect(rows.some((row) => row.isLive && row.sessions >= 2)).toBe(true)
    expect(rows.some((row) => !row.isLive && row.sessions >= 2)).toBe(true)
    expect(new Set(rows.map((row) => row.date)).size).toBeGreaterThanOrEqual(5)
  })
})
