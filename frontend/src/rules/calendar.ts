import { HOLIDAYS } from './config/holidays'

const pad = (value: number) => String(value).padStart(2, '0')
const toDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}
const toText = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** Ngày giao dịch: không phải thứ Bảy, Chủ nhật, không nằm trong danh sách ngày nghỉ. */
export function isTradingDay(date: string, holidays: readonly string[] = HOLIDAYS): boolean {
  const day = toDate(date).getDay()
  return day !== 0 && day !== 6 && !holidays.includes(date)
}

/** Dịch `days` ngày giao dịch (âm là lùi). Ngày xuất phát không cần là ngày giao dịch. */
export function shiftTradingDays(date: string, days: number, holidays: readonly string[] = HOLIDAYS): string {
  const cursor = toDate(date)
  const step = days >= 0 ? 1 : -1
  for (let moved = 0; moved < Math.abs(days); ) {
    cursor.setDate(cursor.getDate() + step)
    if (isTradingDay(toText(cursor), holidays)) moved += 1
  }
  return toText(cursor)
}

export function nextTradingDate(date: string): string {
  return shiftTradingDays(date, 1)
}

export function previousTradingDate(date: string): string {
  return shiftTradingDays(date, -1)
}

/** Ngày giao dịch `days` phiên trước `date`. */
export function tradingDaysAgo(date: string, days: number): string {
  return shiftTradingDays(date, -days)
}

/** `count` ngày giao dịch gần nhất tính tới `date` (gồm `date`), mới nhất trước. */
export function sessionDates(date: string, count: number): string[] {
  const dates: string[] = []
  let cursor = date
  if (!isTradingDay(cursor)) cursor = previousTradingDate(cursor)
  while (dates.length < count) {
    dates.push(cursor)
    cursor = previousTradingDate(cursor)
  }
  return dates
}

/** Ngày giao dịch gần nhất từ `date` trở đi (chính nó nếu là ngày giao dịch). */
export function onOrAfterTradingDay(date: string): string {
  return isTradingDay(date) ? date : nextTradingDate(date)
}
