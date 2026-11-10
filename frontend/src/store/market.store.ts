import { create } from 'zustand'
import type { MarketState } from '@/types'

interface MarketStore extends MarketState {
  /** Giờ thật (ms) lần cuối nhận dữ liệu giá; 0 khi chưa nhận lần nào. Chỉ phục vụ hiển thị. */
  received_at: number
  setMarket: (state: MarketState) => void
}

export const useMarketStore = create<MarketStore>()((set) => ({
  trading_date: '',
  sim_seconds: 0,
  quote_age_seconds: 0,
  session: 'PRE_OPEN',
  speed: 1,
  quotes: [],
  received_at: 0,
  setMarket: (state) => set({ ...state, received_at: Date.now() }),
}))
