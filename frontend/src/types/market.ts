export type SessionCode = 'PRE_OPEN' | 'ATO' | 'CONTINUOUS' | 'LUNCH' | 'ATC' | 'CLOSED'

export type SimSpeed = 1 | 10 | 60

/** Một dòng bảng giá. Không có trong ERD, chỉ phục vụ hiển thị. Mọi giá là số nguyên đồng. */
export interface SymbolQuote {
  symbol: string
  ref_price: number
  ceiling_price: number
  floor_price: number
  /** Giá khớp gần nhất. Trong ATO, ATC đứng yên cho tới lúc khớp định kỳ. */
  last_price: number
  /** Giá dự kiến khớp, chỉ có trong phiên ATO, ATC. Ngoài hai phiên này là null. */
  indicative_price: number | null
  last_qty: number
  total_volume: number
  bid_price: number
  ask_price: number
  /** Hướng của lần đổi giá gần nhất, dùng để nháy màu: 1 tăng, -1 giảm, 0 chưa đổi. */
  tick_direction: -1 | 0 | 1
  /** Sổ lệnh nhiều mức, chỉ có khi được cung cấp (Demo). Không có thì engine dựng sổ lệnh tất định từ bid, ask. */
  depth?: OrderBookDepth
}

/** Một mức giá trong sổ lệnh. */
export interface BookLevel {
  price: number
  qty: number
  /** KL lệnh của mình vừa lấy ở mức này (cộng dồn), để hiển thị số âm. Tự xóa sau vài nhịp. */
  own_taken?: number
  /** Số nhịp đã giữ dấu `own_taken`. */
  own_taken_age?: number
}

/** Sổ lệnh: bids giảm dần từ giá mua tốt nhất, asks tăng dần từ giá bán tốt nhất. */
export interface OrderBookDepth {
  bids: BookLevel[]
  asks: BookLevel[]
}

export interface MarketState {
  /** Ngày giao dịch giả lập, dạng YYYY-MM-DD. */
  trading_date: string
  /** Giờ giả lập, tính bằng số giây kể từ 00:00. */
  sim_seconds: number
  /** Số giây thật kể từ lần cuối nhận được giá, không phụ thuộc tốc độ tua. Bình thường là 0. */
  quote_age_seconds: number
  session: SessionCode
  speed: SimSpeed
  quotes: SymbolQuote[]
}

/** Một lần khớp trên toàn thị trường của một mã (tick khớp). Giá là số nguyên đồng. */
export interface MarketTrade {
  symbol: string
  /** Thời điểm khớp theo đồng hồ giả lập, dạng YYYY-MM-DDTHH:mm:ss. */
  time: string
  price: number
  qty: number
}

/** Tổng hợp tick khớp của một mã trong một khoảng thời gian. */
export interface MarketWindowStats {
  /** Tổng KL khớp toàn thị trường. */
  volume: number
  /** Tổng giá trị khớp: Σ(giá × KL), đồng. */
  value: number
}
