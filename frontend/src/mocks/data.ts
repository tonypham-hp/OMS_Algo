import type { DemoUser } from '@/types'

/** Mã demo và giá tham chiếu (đồng). Các con số là giả lập, không phải giá thật. */
export const DEMO_SYMBOLS: ReadonlyArray<{ symbol: string; ref_price: number }> = [
  { symbol: 'ACB', ref_price: 24_900 },
  { symbol: 'FPT', ref_price: 118_000 },
  { symbol: 'HPG', ref_price: 27_500 },
  { symbol: 'MBB', ref_price: 23_700 },
  { symbol: 'MWG', ref_price: 62_400 },
  { symbol: 'SSI', ref_price: 26_150 },
  { symbol: 'TCB', ref_price: 24_350 },
  { symbol: 'VCB', ref_price: 61_200 },
  { symbol: 'VHM', ref_price: 41_200 },
  { symbol: 'VNM', ref_price: 63_800 },
]

/**
 * Mã MÔ PHỎNG thêm ở Đợt 8A (không phải mã thật): 3 mã niêm yết HNX, 2 mã UPCoM, 1 ETF, 1 chứng quyền.
 * Giá tham chiếu đúng bước giá của bảng hiện tại. Tên, loại chứng khoán ở src/rules/symbols.ts.
 * Tách khỏi DEMO_SYMBOLS để bộ giả lập sinh giá cho chúng bằng dãy random riêng, không làm lệch giá của 10 mã cũ.
 */
export const EXTRA_SYMBOLS: ReadonlyArray<{ symbol: string; ref_price: number }> = [
  { symbol: 'XHA', ref_price: 32_400 },
  { symbol: 'XHB', ref_price: 15_600 },
  { symbol: 'XHC', ref_price: 8_700 },
  { symbol: 'XUA', ref_price: 12_300 },
  { symbol: 'XUB', ref_price: 5_400 },
  { symbol: 'XETF30', ref_price: 21_350 },
  { symbol: 'CFPT2699', ref_price: 1_230 },
]

/**
 * Mã MÔ PHỎNG thêm ở Đợt 8B. Mỗi mã sinh giá bằng dãy random riêng của nó, nên giá các mã cũ không đổi.
 * XRS: cổ phiếu HOSE bị hạn chế giao dịch (chỉ khớp định kỳ 15 phút).
 */
export const SPECIAL_SYMBOLS: ReadonlyArray<{ symbol: string; ref_price: number }> = [{ symbol: 'XRS', ref_price: 14_250 }]

export const ALL_SYMBOLS = [...DEMO_SYMBOLS, ...EXTRA_SYMBOLS, ...SPECIAL_SYMBOLS]

/** Mã đang bị hạn chế giao dịch (mô phỏng danh sách Sở công bố). Đánh dấu thêm mã ở đây. */
export const RESTRICTED_SYMBOLS: readonly string[] = ['XRS']

/** Room ngoại còn lại lúc đầu ngày (cổ phiếu), mô phỏng. Mã không có trong bảng: không giới hạn. */
export const FOREIGN_ROOM: Readonly<Record<string, number>> = {
  ACB: 0,
  FPT: 1_200_000,
  HPG: 3_500_000,
  MBB: 0,
  MWG: 5_000,
  SSI: 900_000,
  TCB: 0,
  VCB: 2_400_000,
  VHM: 4_100_000,
  VNM: 1_800_000,
  XHA: 250_000,
  XHB: 80_000,
  XHC: 40_000,
  XUA: 60_000,
  XUB: 20_000,
  XETF30: 500_000,
  CFPT2699: 1_000_000,
  XRS: 300_000,
}

/** Thuộc tính tài khoản demo. Chỉ có cờ nhà đầu tư nước ngoài; tài khoản không có trong bảng là trong nước. */
export const ACCOUNTS: Readonly<Record<string, { is_foreign: boolean }>> = {
  '058C123456': { is_foreign: false },
  '058C234567': { is_foreign: false },
  /** Tài khoản của dealer, là nhà đầu tư nước ngoài: lệnh mua bị trừ room. */
  '058C345678': { is_foreign: true },
  '058C999999': { is_foreign: false },
}

export function isForeignAccount(accountNo: string): boolean {
  return ACCOUNTS[accountNo]?.is_foreign ?? false
}

export const DEMO_USERS: DemoUser[] = [
  {
    username: 'khachhang',
    display_name: 'Khách hàng demo',
    role: 'CUSTOMER',
    accounts: ['058C123456'],
  },
  {
    username: 'dealer',
    display_name: 'Dealer demo',
    role: 'DEALER',
    accounts: ['058C123456', '058C234567', '058C345678'],
    foreign_accounts: ['058C345678'],
  },
  {
    username: 'vanhanh',
    display_name: 'Vận hành demo',
    role: 'OPS',
    accounts: ['058C999999'],
  },
  {
    // Người thứ hai của maker-checker: duyệt yêu cầu đổi cấu hình do vanhanh tạo, và ngược lại.
    username: 'vanhanh2',
    display_name: 'Vận hành demo 2',
    role: 'OPS',
    accounts: ['058C999999'],
  },
]
