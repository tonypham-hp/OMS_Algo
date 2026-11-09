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
