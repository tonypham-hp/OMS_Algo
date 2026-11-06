export type SessionCode = 'PRE_OPEN' | 'ATO' | 'CONTINUOUS' | 'LUNCH' | 'ATC' | 'CLOSED'

export type SimSpeed = 1 | 10 | 60

/** Một dòng bảng giá. Không có trong ERD, chỉ phục vụ hiển thị. Mọi giá là số nguyên đồng. */
export interface SymbolQuote {
  symbol: string
  ref_price: number
  ceiling_price: number
  floor_price: number
  last_price: number
  last_qty: number
  total_volume: number
  bid_price: number
  ask_price: number
  /** Hướng của lần đổi giá gần nhất, dùng để nháy màu: 1 tăng, -1 giảm, 0 chưa đổi. */
  tick_direction: -1 | 0 | 1
}

export interface MarketState {
  /** Giờ giả lập, tính bằng số giây kể từ 00:00. */
  sim_seconds: number
  session: SessionCode
  speed: SimSpeed
  quotes: SymbolQuote[]
}
