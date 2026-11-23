import type { OrderEvent } from './event'
import type { Side } from './order'

/**
 * Lệnh thỏa thuận (Đợt 8B, ngoài ERD): hai bên tự thỏa thuận giá, KL; gửi → bên đối ứng xác nhận hoặc từ chối → khớp.
 * Không đi qua sổ lệnh khớp lệnh: không đổi OrderBook3, không tính vào VWAP khớp lệnh.
 */
export type PutThroughStatus = 'PENDING_CONFIRM' | 'MATCHED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'

export interface PutThroughDeal {
  deal_id: string
  account_no: string
  /** Tài khoản bên đối ứng (mô phỏng, không phải tài khoản thật). */
  counterparty_account: string
  symbol: string
  side: Side
  qty: number
  /** Giá thỏa thuận, số nguyên đồng (bước giá 1 đ). */
  price: number
  status: PutThroughStatus
  user_id: string
  created_at: string
  updated_at: string
  matched_at: string | null
}

export interface CreatePutThroughRequest {
  account_no: string
  counterparty_account: string
  symbol: string
  side: Side
  qty: number
  price: number
}

export interface PutThroughData {
  deals: PutThroughDeal[]
  /** Nhật ký của các deal (OrderEvent, parent_order_id là deal_id), tách khỏi nhật ký lệnh cha. */
  events: OrderEvent[]
}
