// Gói luật giao dịch: luật của một bảng giao dịch trong một khoảng ngày hiệu lực, viết dưới dạng dữ liệu.
// Đổi giờ phiên, biên độ, bước giá... chỉ cần thêm hoặc sửa một pack, không sửa code.
import type { SessionCode, Side } from '@/types'

/** Bảng giao dịch theo KRX: STO (cổ phiếu HOSE), STX (cổ phiếu HNX), UPX (UPCoM). */
export type Board = 'STO' | 'STX' | 'UPX'

/** Sở niêm yết gốc của mã, dùng để biết mã sẽ thuộc bảng nào theo ngày. */
export type Listing = 'HOSE' | 'HNX' | 'UPCOM'

/** Loại chứng khoán: bước giá và cách tính trần/sàn khác nhau theo loại. */
export type SecType = 'STOCK' | 'CLOSED_FUND' | 'ETF' | 'CW'

/** Loại lệnh gửi lên sàn. MOK, MAK là FOK, FAK theo tên gọi của HNX. */
export type OrderType = 'LO' | 'MTL' | 'ATO' | 'ATC' | 'MOK' | 'MAK'

export type LotKind = 'ROUND' | 'ODD'

/** Loại một lần sửa lệnh: mỗi lần chỉ đổi giá hoặc khối lượng. */
export type AmendKind = 'PRICE' | 'QTY_UP' | 'QTY_DOWN'

/**
 * Phiên có giờ bắt đầu, kết thúc trong pack (không gồm PRE_OPEN, CLOSED là phần ngoài các phiên;
 * phiên riêng theo mã như lượt khớp định kỳ của mã hạn chế không khai trong `sessions`).
 */
export type TradingSessionCode = Exclude<SessionCode, 'PRE_OPEN' | 'CLOSED' | 'PERIODIC' | 'PERIODIC_LOCK' | 'HALTED' | 'REOPEN'>

/** Một phiên trong ngày. Giờ dạng "HH:MM", gồm giờ bắt đầu, không gồm giờ kết thúc. */
export interface SessionWindow {
  code: TradingSessionCode
  start: string
  end: string
}

/** Một dòng bảng bước giá: áp cho giá nhỏ hơn `below`; `below: null` là mọi mức giá còn lại. */
export interface TickRule {
  below: number | null
  tick: number
}

/** Loại lệnh được nhận trong một phiên, tách theo lô chẵn và lô lẻ. */
export interface SessionOrderTypes {
  round: OrderType[]
  odd: OrderType[]
}

/** Các cờ cấu hình cho những điểm chưa rõ. Mỗi cờ có trạng thái kiểm chứng và nhãn hiện trên giao diện. */
export type RuleFlag = 'MOK_MAK' | 'AMEND_CANCEL_IN_AUCTION_LOCK' | 'TRANSFERRED_SYMBOL_RULES'

export interface FlagState {
  enabled: boolean
  verified: boolean
  /** Nhãn ngắn hiện cạnh chức năng, ví dụ "Chưa kiểm chứng", "Giả định". */
  label: string
  /** Mô tả để hiện ở trang Luật giao dịch. */
  note: string
}

// ===== Phiên giao dịch đặc biệt (Đợt 8B) =====

/**
 * Mã bị hạn chế giao dịch: chỉ khớp định kỳ, chỉ lô chẵn. ATO, rồi các lượt định kỳ `callIntervalMinutes` phút trong giờ
 * khớp liên tục (chỉ LO), rồi ATC. Khóa sửa, hủy `lockSecondsBeforeCall` giây cuối mỗi lượt.
 */
export interface RestrictedSpec {
  /** Độ dài một lượt khớp định kỳ, phút. */
  callIntervalMinutes: number
  /** Số giây cuối lượt không được sửa, hủy. */
  lockSecondsBeforeCall: number
  /** Loại lệnh nhận theo phiên của mã hạn chế (chỉ lô chẵn). */
  orderTypes: Partial<Record<SessionCode, OrderType[]>>
}

/** Phiên khớp định kỳ khi mã giao dịch lại sau tạm ngừng: chỉ nhận LO, cấm sửa/hủy (REOPEN trong lockedSessions). */
export interface HaltResumeSpec {
  /** Độ dài phiên khớp định kỳ khi mở lại, phút. */
  reopenAuctionMinutes: number
  /** Loại lệnh nhận trong phiên mở lại. */
  orderTypes: SessionOrderTypes
}

/** Lệnh thỏa thuận. 8A chỉ dùng `window` để hiện trên đồng hồ phiên, chưa có phiếu thỏa thuận. */
export interface PutThroughSpec {
  window: { start: string; end: string }
  /** Có cho thỏa thuận trong giờ khớp lệnh hay không (8B). */
  duringContinuous?: boolean
}

export interface RulePack {
  id: string
  board: Board
  /** Ngày bắt đầu hiệu lực, YYYY-MM-DD (gồm). */
  effectiveFrom: string
  /** Ngày cuối còn hiệu lực, YYYY-MM-DD (gồm). Không có là chưa có ngày kết thúc. */
  effectiveTo?: string
  /** Pack thử nghiệm: không tự chọn theo ngày, chỉ dùng khi nạp ở trang Luật giao dịch. */
  experimental?: boolean
  title: string
  sessions: SessionWindow[]
  orderTypesBySession: Partial<Record<SessionCode, SessionOrderTypes>>
  /** Biên độ dao động, %: ngày thường và ngày giao dịch đầu tiên. */
  priceBand: { normal: number; firstDay: number }
  tickTable: Record<SecType, TickRule[]>
  /** Giá đặt thấp nhất, đồng (chứng quyền có thể hiện giá sàn 0 nhưng lệnh phải từ mức này). */
  minPrice: number
  lots: { round: number; odd: { min: number; max: number } }
  maxQty: { round: number; odd: number }
  amendPolicy: {
    /** Mỗi lần sửa chỉ đổi giá hoặc khối lượng. */
    oneFieldPerAmend: boolean
    lockedSessions: SessionCode[]
    /** Loại sửa làm mất ưu tiên thời gian. */
    losesPriority: AmendKind[]
  }
  cancelPolicy: { lockedSessions: SessionCode[] }
  /** Giờ lệnh trong ngày chưa khớp hết hiệu lực, "HH:MM". */
  expiryTime: string
  /** Phần chưa khớp của MTL: chuyển thành LO tại giá khớp gần nhất ± 1 bước giá, hoặc hủy. */
  mtlRemainder: 'LO_LAST_PLUS_TICK' | 'CANCEL'
  /** ATO, ATC có được ưu tiên trước LO mua giá trần, LO bán giá sàn đặt trước hay không. */
  auctionPriorityOverLimit: boolean
  /** Giá tham chiếu: giá đóng cửa phiên trước, hoặc bình quân gia quyền phiên trước (UPCoM). */
  referencePrice: 'CLOSE' | 'VWAP_PREV'
  flags: Partial<Record<RuleFlag, FlagState>>
  /** Cả pack đã kiểm chứng từ nguồn gốc hay chưa. */
  verified: boolean
  /** Tên nguồn công khai, không chép nguyên văn. */
  sourceNote: string
  restricted?: RestrictedSpec
  haltResume?: HaltResumeSpec
  putThrough?: PutThroughSpec
}

// ===== Kiểm tra lệnh =====

export type RuleCode =
  | 'SYMBOL_TRANSFER_HALT'
  | 'RESTRICTED_ROUND_LOT_ONLY'
  | 'RESTRICTED_NO_MTL'
  | 'RESTRICTED_NO_HUNT'
  | 'RESTRICTED_LOCKED'
  | 'SYMBOL_TRADING_HALTED'
  | 'BOARD_CLOSED'
  | 'ORDER_TYPE_NOT_IN_SESSION'
  | 'ORDER_TYPE_DISABLED'
  | 'MTL_CONTINUOUS_ONLY'
  | 'PRICE_REQUIRED'
  | 'PRICE_NOT_ALLOWED'
  | 'PRICE_INVALID'
  | 'PRICE_OUT_OF_BAND'
  | 'PRICE_TICK'
  | 'PRICE_BELOW_MIN'
  | 'QTY_INVALID'
  | 'LOT_ROUND_MULTIPLE'
  | 'LOT_ODD_RANGE'
  | 'ODD_LOT_LO_ONLY'
  | 'MAX_QTY'
  | 'FOREIGN_ROOM_EXCEEDED'
  | 'AMEND_ONE_FIELD'
  | 'AMEND_NO_CHANGE'
  | 'AMEND_LOCKED_SESSION'
  | 'CANCEL_LOCKED_SESSION'

export type RuleField = 'symbol' | 'orderType' | 'price' | 'qty' | 'account' | 'session'

export interface RuleViolation {
  code: RuleCode
  field: RuleField
  /** `warn`: chỉ cảnh báo (ví dụ MTL của lệnh thuật toán đặt ngoài phiên liên tục, sẽ gửi khi vào phiên). */
  severity: 'error' | 'warn'
  /** Số liệu cụ thể để dựng câu tiếng Việt (src/explain/reasons.ts, RULE_REASONS). */
  params: Record<string, number | string>
}

/** Thông tin của mã mà bộ kiểm tra cần, lấy từ bảng giá. */
export interface SymbolInfo {
  symbol: string
  secType: SecType
  ref: number
  ceiling: number
  /** Giá sàn hiển thị. Chứng quyền có thể là 0; lệnh vẫn phải từ `minPrice` của pack. */
  floor: number
  /** Ngừng giao dịch trong ngày (ví dụ 24–25/12/2026 với mã niêm yết HNX). */
  halted: boolean
  /** Room ngoại còn lại, cổ phiếu. Không có là không giới hạn. */
  foreignRoom?: number
  /** Mã bị hạn chế giao dịch: chỉ khớp định kỳ, chỉ lô chẵn, không MTL, không HUNT. */
  restricted?: boolean
  /** Giờ khớp của lượt định kỳ hiện tại (giây trong ngày), để câu khóa sửa, hủy nêu giờ. */
  callEnd?: number
  /** Mã đang tạm ngừng giao dịch (vận hành tạm ngừng; khác `halted` là ngừng cả ngày vì chuyển sàn). */
  tradingHalted?: boolean
}

export interface AccountInfo {
  /** Nhà đầu tư nước ngoài: lệnh mua bị trừ room. */
  isForeign: boolean
}

export interface OrderInput {
  side: Side
  orderType: OrderType
  /** null với lệnh thị trường (MTL, ATO, ATC, MOK, MAK). */
  price: number | null
  qty: number
  lot: LotKind
  /**
   * Lệnh gửi ngay lên sàn (LO thường, lô lẻ). Lệnh thuật toán chỉ gửi lệnh con khi tới lúc,
   * nên với chúng luật phiên chỉ là cảnh báo.
   */
  immediate?: boolean
}

export interface AmendInput {
  from: { price: number | null; qty: number }
  to: { price: number | null; qty: number }
}
