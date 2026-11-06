import { describe, expect, it } from 'vitest'
import type { ParentOrder } from '@/types'
import { validateEditOrder } from './editOrderSchema'
import { ALL, EMPTY_FILTERS, filterOrders } from './filterOrders'

function order(extra: Partial<ParentOrder>): ParentOrder {
  return {
    parent_order_id: 'PO-1',
    client_request_id: 'req',
    account_no: '058C123456',
    symbol: 'FPT',
    side: 'BUY',
    total_qty: 1_000,
    executed_qty: 0,
    limit_price: 100_000,
    strategy_type: 'ICEBERG',
    status: 'ACTIVE',
    valid_from: '',
    valid_to: '',
    persistence_mode: 'DAY',
    version: 1,
    created_at: '',
    updated_at: '',
    ...extra,
  }
}

describe('lọc sổ lệnh', () => {
  const orders = [
    order({ parent_order_id: 'A' }),
    order({ parent_order_id: 'B', symbol: 'HPG', side: 'SELL', status: 'COMPLETED', strategy_type: 'TWAP' }),
    order({ parent_order_id: 'C', account_no: '058C234567', status: 'COMPLETED' }),
  ]
  const ids = (filters: Partial<typeof EMPTY_FILTERS>) =>
    filterOrders(orders, { ...EMPTY_FILTERS, ...filters }).map((item) => item.parent_order_id)

  it('không lọc thì giữ nguyên', () => {
    expect(ids({})).toEqual(['A', 'B', 'C'])
    expect(ids({ status: ALL })).toEqual(['A', 'B', 'C'])
  })

  it('lọc theo từng tiêu chí', () => {
    expect(ids({ status: 'COMPLETED' })).toEqual(['B', 'C'])
    expect(ids({ symbol: 'HPG' })).toEqual(['B'])
    expect(ids({ side: 'SELL' })).toEqual(['B'])
    expect(ids({ strategy_type: 'TWAP' })).toEqual(['B'])
    expect(ids({ account_no: '058C234567' })).toEqual(['C'])
  })

  it('nhiều tiêu chí cùng lúc là phép VÀ', () => {
    expect(ids({ status: 'COMPLETED', symbol: 'FPT' })).toEqual(['C'])
    expect(ids({ status: 'ACTIVE', symbol: 'HPG' })).toEqual([])
  })
})

describe('kiểm tra form Sửa', () => {
  const fields = (...args: Parameters<typeof validateEditOrder>) =>
    validateEditOrder(...args).map((error) => error.field)

  it('hợp lệ', () => {
    expect(fields({ total_qty: 2_000, limit_price: 100_100 }, order({}), 100_000)).toEqual([])
  })

  it('KL sai luật HOSE hoặc nhỏ hơn phần đã khớp', () => {
    expect(fields({ total_qty: 150, limit_price: 100_000 }, order({}), 100_000)).toEqual(['total_qty'])
    expect(fields({ total_qty: 500, limit_price: 100_000 }, order({ executed_qty: 600 }), 100_000)).toEqual(['total_qty'])
    expect(fields({ total_qty: 600, limit_price: 100_000 }, order({ executed_qty: 600 }), 100_000)).toEqual([])
  })

  it('giá sai bước hoặc vượt trần', () => {
    expect(fields({ total_qty: 1_000, limit_price: 100_050 }, order({}), 100_000)).toEqual(['limit_price'])
    expect(fields({ total_qty: 1_000, limit_price: 107_100 }, order({}), 100_000)).toEqual(['limit_price'])
  })

  it('loại lệnh không có giá giới hạn thì không bắt nhập giá', () => {
    expect(fields({ total_qty: 1_000, limit_price: null }, order({ strategy_type: 'STOP', limit_price: null }), 100_000)).toEqual([])
  })

  it('báo thiếu', () => {
    expect(fields({ total_qty: null, limit_price: null }, order({}), 100_000)).toEqual(['total_qty', 'limit_price'])
  })
})
