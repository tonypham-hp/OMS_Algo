import { useMemo } from 'react'
import { useSystemParameters } from '@/hooks/useSystemConfig'
import { useAuthStore } from '@/store/auth.store'
import { useMarketStore } from '@/store/market.store'
import type { SystemParameterCode } from '@/types'
import type { ExplainMarket } from './types'

/**
 * Thị trường cho phần giải thích lệnh, lấy từ bảng giá đang chạy. Ngưỡng của cấu hình hệ thống
 * chỉ vận hành đọc được; role khác để null để câu giải thích không ghi số đoán.
 */
export function useExplainMarket(symbol: string): ExplainMarket {
  const role = useAuthStore((state) => state.user?.role)
  const session = useMarketStore((state) => state.session)
  const quoteAge = useMarketStore((state) => state.quote_age_seconds)
  const quote = useMarketStore((state) => state.quotes.find((item) => item.symbol === symbol))
  const parameters = useSystemParameters(role === 'OPS')

  return useMemo(() => {
    const valueOf = (code: SystemParameterCode) => {
      const value = parameters.data?.find((item) => item.parameter_code === code)?.value
      return typeof value === 'number' ? value : null
    }
    return {
      session,
      quote: quote ? { ref_price: quote.ref_price, last_price: quote.last_price, bid_price: quote.bid_price, ask_price: quote.ask_price } : null,
      quote_age_seconds: quoteAge,
      max_delay_seconds: valueOf('MAX_DATA_DELAY_SECONDS'),
      max_rejects: valueOf('MAX_CONSECUTIVE_REJECTS'),
    }
  }, [session, quote, quoteAge, parameters.data])
}

/** Bản không có hook, cho danh sách nhiều lệnh (Sổ lệnh, Trung tâm lệnh): không có ngưỡng cấu hình. */
export function getBriefMarket(symbol: string): ExplainMarket {
  const state = useMarketStore.getState()
  const quote = state.quotes.find((item) => item.symbol === symbol)
  return {
    session: state.session,
    quote: quote ? { ref_price: quote.ref_price, last_price: quote.last_price, bid_price: quote.bid_price, ask_price: quote.ask_price } : null,
    quote_age_seconds: state.quote_age_seconds,
    max_delay_seconds: null,
    max_rejects: null,
  }
}

/**
 * Như getBriefMarket nhưng là hook: chỉ vẽ lại khi phiên, tuổi giá hoặc 4 mức giá của đúng mã này đổi,
 * nên một dòng trong bảng nhiều lệnh không bị vẽ lại theo nhịp giá của mã khác.
 */
export function useBriefMarket(symbol: string): ExplainMarket {
  const session = useMarketStore((state) => state.session)
  const quoteAge = useMarketStore((state) => state.quote_age_seconds)
  const ref = useMarketStore((state) => state.quotes.find((item) => item.symbol === symbol)?.ref_price)
  const last = useMarketStore((state) => state.quotes.find((item) => item.symbol === symbol)?.last_price)
  const bid = useMarketStore((state) => state.quotes.find((item) => item.symbol === symbol)?.bid_price)
  const ask = useMarketStore((state) => state.quotes.find((item) => item.symbol === symbol)?.ask_price)
  return useMemo(
    () => ({
      session,
      quote:
        ref === undefined || last === undefined || bid === undefined || ask === undefined
          ? null
          : { ref_price: ref, last_price: last, bid_price: bid, ask_price: ask },
      quote_age_seconds: quoteAge,
      max_delay_seconds: null,
      max_rejects: null,
    }),
    [session, quoteAge, ref, last, bid, ask],
  )
}
