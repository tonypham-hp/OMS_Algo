import { getSessionDates } from './execQuality'

/** Khoảng ngày của màn Lịch sử và đối soát: hôm nay, 5 phiên gần nhất, hoặc tự chọn từ – đến. */
export type DateRangePreset = 'TODAY' | 'FIVE_SESSIONS' | 'CUSTOM'

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  TODAY: 'Hôm nay',
  FIVE_SESSIONS: '5 phiên',
  CUSTOM: 'Tùy chọn',
}

export interface DateRangeValue {
  preset: DateRangePreset
  /** YYYY-MM-DD, chỉ dùng khi preset là CUSTOM. */
  from: string
  to: string
}

export interface DateRange {
  from: string
  to: string
}

/** Khoảng ngày thật (gồm cả hai đầu). Tùy chọn mà nhập ngược (từ > đến) thì đổi chỗ, ô trống lấy hôm nay. */
export function resolveDateRange(value: DateRangeValue, tradingDate: string): DateRange {
  if (value.preset === 'TODAY') return { from: tradingDate, to: tradingDate }
  if (value.preset === 'FIVE_SESSIONS') {
    const dates = getSessionDates(tradingDate, 5)
    return { from: dates[dates.length - 1], to: dates[0] }
  }
  const from = value.from || tradingDate
  const to = value.to || tradingDate
  return from <= to ? { from, to } : { from: to, to: from }
}

/** Ngày (YYYY-MM-DD) của một thời điểm `YYYY-MM-DDTHH:mm:ss` có nằm trong khoảng không. */
export function isInRange(isoDateTime: string, range: DateRange): boolean {
  const date = isoDateTime.slice(0, 10)
  return date >= range.from && date <= range.to
}

export function defaultDateRange(preset: DateRangePreset = 'FIVE_SESSIONS'): DateRangeValue {
  return { preset, from: '', to: '' }
}
