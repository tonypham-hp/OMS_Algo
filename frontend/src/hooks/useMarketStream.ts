import { useEffect } from 'react'
import { marketService } from '@/services/market.service'
import { useMarketStore } from '@/store/market.store'

/** Nhận dữ liệu giá và đưa vào store. Chỉ gọi một lần, ở layout. */
export function useMarketStream() {
  const setMarket = useMarketStore((state) => state.setMarket)

  useEffect(() => marketService.subscribe(setMarket), [setMarket])
}
