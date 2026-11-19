// Danh mục mã: sở niêm yết gốc, loại chứng khoán. Giá, room ngoại là dữ liệu mô phỏng, nằm ở src/mocks/data.ts.
import type { Board, Listing, SecType } from './types'

export interface SymbolListing {
  symbol: string
  /** Tên hiển thị. Mã thêm ở Đợt 8A đều là mã MÔ PHỎNG, tên ghi rõ "(mô phỏng)". */
  name: string
  listing: Listing
  secType: SecType
  /** Ngày giao dịch đầu tiên (biên độ ngày đầu). Không có là đã giao dịch từ lâu. */
  firstTradingDate?: string
  /** Chứng quyền: mã cơ sở và tỷ lệ chuyển đổi (số chứng quyền cho 1 cổ phiếu). */
  cw?: { underlying: string; ratio: number }
}

export const SYMBOL_LISTINGS: readonly SymbolListing[] = [
  { symbol: 'ACB', name: 'Ngân hàng ACB', listing: 'HOSE', secType: 'STOCK' },
  { symbol: 'FPT', name: 'FPT', listing: 'HOSE', secType: 'STOCK' },
  { symbol: 'HPG', name: 'Hòa Phát', listing: 'HOSE', secType: 'STOCK' },
  { symbol: 'MBB', name: 'Ngân hàng MB', listing: 'HOSE', secType: 'STOCK' },
  { symbol: 'MWG', name: 'Thế Giới Di Động', listing: 'HOSE', secType: 'STOCK' },
  { symbol: 'SSI', name: 'Chứng khoán SSI', listing: 'HOSE', secType: 'STOCK' },
  { symbol: 'TCB', name: 'Techcombank', listing: 'HOSE', secType: 'STOCK' },
  { symbol: 'VCB', name: 'Vietcombank', listing: 'HOSE', secType: 'STOCK' },
  { symbol: 'VHM', name: 'Vinhomes', listing: 'HOSE', secType: 'STOCK' },
  { symbol: 'VNM', name: 'Vinamilk', listing: 'HOSE', secType: 'STOCK' },
  { symbol: 'XHA', name: 'Cổ phiếu HNX A (mô phỏng)', listing: 'HNX', secType: 'STOCK' },
  { symbol: 'XHB', name: 'Cổ phiếu HNX B (mô phỏng)', listing: 'HNX', secType: 'STOCK' },
  { symbol: 'XHC', name: 'Cổ phiếu HNX C (mô phỏng)', listing: 'HNX', secType: 'STOCK' },
  { symbol: 'XUA', name: 'Cổ phiếu UPCoM A (mô phỏng)', listing: 'UPCOM', secType: 'STOCK' },
  { symbol: 'XUB', name: 'Cổ phiếu UPCoM B (mô phỏng)', listing: 'UPCOM', secType: 'STOCK' },
  { symbol: 'XETF30', name: 'Quỹ ETF 30 (mô phỏng)', listing: 'HOSE', secType: 'ETF' },
  {
    symbol: 'CFPT2699',
    name: 'Chứng quyền FPT (mô phỏng)',
    listing: 'HOSE',
    secType: 'CW',
    cw: { underlying: 'FPT', ratio: 10 },
  },
]

/**
 * Lịch chuyển sàn: cổ phiếu niêm yết HNX giao dịch phiên cuối 23/12/2026, nghỉ 24–25/12,
 * giao dịch trên HOSE (bảng STO) từ 28/12/2026 (Thông tư 139/2025/TT-BTC).
 */
export interface ListingTransfer {
  from: Listing
  toBoard: Board
  lastTradingDate: string
  haltDates: string[]
  firstTradingDate: string
}

export const LISTING_TRANSFERS: readonly ListingTransfer[] = [
  {
    from: 'HNX',
    toBoard: 'STO',
    lastTradingDate: '2026-12-23',
    haltDates: ['2026-12-24', '2026-12-25'],
    firstTradingDate: '2026-12-28',
  },
]

const LISTING_BOARD: Record<Listing, Board> = { HOSE: 'STO', HNX: 'STX', UPCOM: 'UPX' }

export function getListing(symbol: string): SymbolListing | undefined {
  return SYMBOL_LISTINGS.find((item) => item.symbol === symbol)
}

export interface SymbolBoardStatus {
  /** null: mã ngừng giao dịch ngày này. */
  board: Board | null
  /** Mã đã chuyển sàn: luật bảng mới là giả định (nhãn "Giả định"). */
  transferred: boolean
  halted: boolean
}

export function symbolBoardStatus(symbol: string, simDate: string): SymbolBoardStatus {
  const listing = getListing(symbol)?.listing ?? 'HOSE'
  const transfer = LISTING_TRANSFERS.find((item) => item.from === listing)
  if (transfer) {
    if (transfer.haltDates.includes(simDate) || (simDate > transfer.lastTradingDate && simDate < transfer.firstTradingDate)) {
      return { board: null, transferred: false, halted: true }
    }
    if (simDate >= transfer.firstTradingDate) return { board: transfer.toBoard, transferred: true, halted: false }
  }
  return { board: LISTING_BOARD[listing], transferred: false, halted: false }
}

/** Bảng giao dịch của mã vào ngày `simDate`; null là ngừng giao dịch ngày đó. */
export function symbolBoard(symbol: string, simDate: string): Board | null {
  return symbolBoardStatus(symbol, simDate).board
}

export const BOARD_LABELS: Record<Board, string> = { STO: 'HOSE', STX: 'HNX', UPX: 'UPCoM' }

export function boardLabel(board: Board | null | undefined): string {
  return board ? BOARD_LABELS[board] : 'Ngừng GD'
}

export const SEC_TYPE_LABELS: Record<SecType, string> = {
  STOCK: 'Cổ phiếu',
  CLOSED_FUND: 'Chứng chỉ quỹ đóng',
  ETF: 'ETF',
  CW: 'Chứng quyền',
}
