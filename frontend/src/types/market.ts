import type { Board, SecType } from '@/rules/types'

/** PUT_THROUGH: thỏa thuận sau giờ 14:45–15:00, không còn khớp lệnh (8A chỉ hiện trên đồng hồ). */
/**
 * PERIODIC, PERIODIC_LOCK (Đợt 8B): lượt khớp định kỳ của mã bị hạn chế giao dịch; PERIODIC_LOCK là 5 phút cuối lượt,
 * khóa sửa, hủy. Hai phiên này chỉ có theo từng mã (SymbolQuote.phase), không phải phiên của cả bảng.
 */
export type SessionCode =
  | 'PRE_OPEN'
  | 'ATO'
  | 'CONTINUOUS'
  | 'LUNCH'
  | 'ATC'
  | 'PUT_THROUGH'
  | 'CLOSED'
  | 'PERIODIC'
  | 'PERIODIC_LOCK'
  /** Đợt 8B: mã đang tạm ngừng giao dịch (phiên riêng theo mã). */
  | 'HALTED'
  /** Đợt 8B: phiên khớp định kỳ khi mã giao dịch lại sau tạm ngừng; chỉ nhận LO, cấm sửa/hủy. */
  | 'REOPEN'

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
  /** Bảng giao dịch của mã trong ngày (theo gói luật). null: mã ngừng giao dịch ngày này. Không có: coi là STO. */
  board?: Board | null
  /** Loại chứng khoán, quyết định bước giá. Không có: coi là cổ phiếu. */
  sec_type?: SecType
  /** Mã đã chuyển sàn, luật bảng mới là giả định (nhãn "Giả định"). */
  transferred?: boolean
  /** Room ngoại còn lại, cổ phiếu. Không có: không giới hạn. */
  foreign_room?: number
  /** Trạng thái giao dịch của mã (Đợt 8B). Không có: bình thường. */
  trading_status?: SymbolTradingStatus
  /**
   * Phiên riêng của mã khi khác phiên của bảng (mã hạn chế: lượt khớp định kỳ). Có thì engine, phiếu lệnh dùng phiên này.
   * `call_end`: giây trong ngày lúc khớp lượt hiện tại; `call_id` đổi là đã sang lượt mới.
   */
  phase?: SymbolPhase
  /** Mã đang tạm ngừng, hoặc đang trong phiên khớp định kỳ sau tạm ngừng (Đợt 8B). Không có: bình thường. */
  halt?: SymbolHalt
}

/** Tạm ngừng giao dịch một mã. `since`, `reopen_end`: giây trong ngày theo đồng hồ giả lập. */
export interface SymbolHalt {
  status: 'HALTED' | 'REOPEN'
  since: number
  /** Giờ khớp của phiên định kỳ sau khi giao dịch lại; null khi đang tạm ngừng. */
  reopen_end: number | null
}

export type SymbolTradingStatus = 'NORMAL' | 'RESTRICTED'

export interface SymbolPhase {
  session: SessionCode
  call_end: number | null
  call_id: string | null
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
  /** Phiên của bảng HOSE (đồng hồ phiên chung). */
  session: SessionCode
  /** Phiên theo từng bảng giao dịch: HNX, UPCoM có lịch phiên khác HOSE. Không có: mọi bảng theo `session`. */
  board_sessions?: Partial<Record<Board, SessionCode>>
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
