import { describe, expect, it } from 'vitest'
import { getParentStatusLabel } from '@/config/orderStatus'
import type { CreateOrderRequest, MarketState, SymbolQuote } from '@/types'
import { getSessionAt } from '@/utils/hose'
import { createOrderEngine } from './engine'

// Engine theo luật KRX (Đợt 8A): room ngoại, hết hiệu lực 14:45, lô lẻ, kiểm lệnh theo gói luật.

const TODAY = '2026-11-16'
const FOREIGN = '058C345678'
const DOMESTIC = '058C123456'
const hhmm = (hour: number, minute: number) => hour * 3600 + minute * 60

const MWG: SymbolQuote = {
  symbol: 'MWG',
  ref_price: 62_400,
  ceiling_price: 66_700,
  floor_price: 58_100,
  last_price: 62_400,
  indicative_price: null,
  last_qty: 100,
  total_volume: 0,
  bid_price: 62_300,
  ask_price: 62_500,
  tick_direction: 0,
  board: 'STO',
  sec_type: 'STOCK',
  foreign_room: 5_000,
}

function marketAt(seconds: number, room = 5_000): MarketState {
  return {
    trading_date: TODAY,
    sim_seconds: seconds,
    quote_age_seconds: 0,
    session: getSessionAt(seconds),
    speed: 1,
    quotes: [{ ...MWG, foreign_room: room }],
  }
}

const request = (extra: Partial<CreateOrderRequest> = {}): CreateOrderRequest => ({
  client_request_id: `req-${Math.random()}`,
  account_no: FOREIGN,
  symbol: 'MWG',
  side: 'BUY',
  total_qty: 3_000,
  limit_price: 60_000,
  strategy_type: 'LIMIT',
  persistence_mode: 'DAY',
  valid_to: null,
  parameters: [],
  ...extra,
})

function setup() {
  const engine = createOrderEngine({ random: () => 0, enforceRules: true })
  engine.onMarketTick(marketAt(hhmm(10, 0)))
  return engine
}

describe('room ngoại', () => {
  it('lệnh mua của nhà đầu tư nước ngoài giữ room ngay khi đặt; vượt room còn lại bị từ chối đúng lý do', () => {
    const engine = setup()
    expect(() => engine.createOrder(request({ total_qty: 6_000 }), 'dealer')).toThrow('Room ngoại của MWG chỉ còn 5.000 CP')
    const first = engine.createOrder(request(), 'dealer')
    expect(first.foreign_room_held).toBe(true)
    expect(engine.getForeignRoom('MWG')).toBe(2_000)
    // Lần thứ hai: room còn 2.000 (gồm phần vừa giữ mà bảng giá chưa phản ánh).
    expect(() => engine.createOrder(request(), 'dealer')).toThrow('chỉ còn 2.000 CP')
    expect(engine.drainRoomChanges()).toEqual([{ symbol: 'MWG', delta: -3_000 }])
  })

  it('hủy, hết hạn trả lại phần chưa khớp; giảm KL trả, tăng KL giữ thêm', () => {
    const engine = setup()
    const order = engine.createOrder(request(), 'dealer')
    engine.updateOrder(order.parent_order_id, { version: 1, total_qty: 2_000, limit_price: 60_000 }, 'dealer')
    expect(engine.getForeignRoom('MWG')).toBe(3_000)
    expect(() => engine.updateOrder(order.parent_order_id, { version: 2, total_qty: 6_000, limit_price: 60_000 }, 'dealer')).toThrow('Room ngoại')
    engine.cancelOrder(order.parent_order_id, 'dealer')
    engine.onMarketTick(marketAt(hhmm(10, 0) + 1))
    expect(engine.getOrder(order.parent_order_id).status).toBe('CANCELLED')
    expect(engine.drainRoomChanges().reduce((sum, change) => sum + change.delta, 0)).toBe(0)
  })

  it('lệnh bán, hoặc tài khoản trong nước, không bị giới hạn room', () => {
    const engine = setup()
    expect(engine.createOrder(request({ side: 'SELL', total_qty: 8_000, limit_price: 65_000 }), 'dealer').foreign_room_held).toBeUndefined()
    expect(engine.createOrder(request({ account_no: DOMESTIC, total_qty: 8_000 }), 'dealer').foreign_room_held).toBeUndefined()
    expect(engine.drainRoomChanges()).toEqual([])
  })
})

describe('hết hiệu lực 14:45, lô lẻ, kiểm lệnh trong engine', () => {
  it('lệnh LO trong ngày chưa khớp hết hiệu lực lúc 14:45 (DAY_END), nhãn "Hết hiệu lực 14:45"', () => {
    const engine = setup()
    const order = engine.createOrder(request({ account_no: DOMESTIC }), 'tester')
    engine.onMarketTick(marketAt(hhmm(14, 44)))
    expect(engine.getOrder(order.parent_order_id).status).toBe('ACTIVE')
    engine.onMarketTick(marketAt(hhmm(14, 45)))
    const expired = engine.getOrder(order.parent_order_id)
    expect(expired).toMatchObject({ status: 'EXPIRED', expire_reason: 'DAY_END' })
    expect(getParentStatusLabel(expired)).toBe('Hết hiệu lực 14:45')
  })

  it('lô lẻ: LO 50 CP được nhận, lệnh con đúng 50 CP; lô lẻ 150 CP hoặc lệnh thuật toán bị từ chối', () => {
    const engine = setup()
    const odd = engine.createOrder(request({ account_no: DOMESTIC, total_qty: 50, lot_type: 'ODD' }), 'tester')
    engine.onMarketTick(marketAt(hhmm(10, 0) + 1))
    expect(odd.lot_type).toBe('ODD')
    expect(engine.getChildren(odd.parent_order_id).map((child) => [child.order_type, child.quantity])).toEqual([['LO', 50]])
    expect(() => engine.createOrder(request({ account_no: DOMESTIC, total_qty: 150, lot_type: 'ODD' }), 'tester')).toThrow('Lô lẻ')
    expect(() =>
      engine.createOrder(
        request({
          account_no: DOMESTIC,
          total_qty: 50,
          lot_type: 'ODD',
          strategy_type: 'STOP_LIMIT',
          limit_price: 62_600,
          parameters: [{ parameter_code: 'trigger_price', parameter_value: '62500', data_type: 'INTEGER' }],
        }),
        'tester',
      ),
    ).toThrow('chỉ đặt lệnh LO')
  })

  it('LIMIT không đặt được trong giờ nghỉ trưa (lệnh gửi ngay chịu luật phiên); lệnh thuật toán vẫn được nhận', () => {
    const engine = setup()
    engine.onMarketTick(marketAt(hhmm(12, 0)))
    expect(() => engine.createOrder(request({ account_no: DOMESTIC }), 'tester')).toThrow('không nhận lệnh trong giờ nghỉ trưa')
    const iceberg = engine.createOrder(
      request({ account_no: DOMESTIC, strategy_type: 'ICEBERG', parameters: [{ parameter_code: 'slice_qty', parameter_value: '1000', data_type: 'INTEGER' }] }),
      'tester',
    )
    expect(iceberg.status).toBe('ACTIVE')
  })

  it('lỗi kiểm tra có mã lý do theo trường', () => {
    const engine = setup()
    try {
      engine.createOrder(request({ account_no: DOMESTIC, limit_price: 70_000 }), 'tester')
      expect.unreachable()
    } catch (error) {
      expect((error as { status: number }).status).toBe(422)
      expect((error as { errors: Array<{ field: string; message: string }> }).errors[0]).toMatchObject({
        field: 'limit_price',
        message: 'Giá không được vượt giá trần 66.700 (tham chiếu 62.400, biên ±7%).',
      })
    }
  })
})
