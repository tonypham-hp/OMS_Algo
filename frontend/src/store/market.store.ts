import { create } from 'zustand'
import type { MarketState } from '@/types'

interface MarketStore extends MarketState {
  setMarket: (state: MarketState) => void
}

export const useMarketStore = create<MarketStore>()((set) => ({
  trading_date: '',
  sim_seconds: 0,
  session: 'PRE_OPEN',
  speed: 1,
  quotes: [],
  setMarket: (state) => set(state),
}))
