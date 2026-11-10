const integerFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 })
const percentFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const bpsFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const pad = (value: number) => String(value).padStart(2, '0')

/** 1000000 → "1.000.000" */
export function formatNumber(value: number): string {
  return integerFormatter.format(value)
}

/** 500 → "+500", -500 → "-500", 0 → "0" */
export function formatSigned(value: number): string {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value)
}

/** 1.256 → "+1,26%" */
export function formatPercent(value: number): string {
  const text = `${percentFormatter.format(value)}%`
  return value > 0 ? `+${text}` : text
}

/** 33000 → "09:10:00" */
export function formatClock(secondsOfDay: number): string {
  const total = Math.floor(secondsOfDay)
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/** Ngày theo giờ máy, dạng YYYY-MM-DD. */
export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "2026-11-06" → "06/11/2026" */
export function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split('-')
  return `${day}/${month}/${year}`
}

/** "2026-11-06T09:15:30" → "06/11 09:15:30". Có ngày vì lệnh nhiều phiên kéo dài qua nhiều ngày. */
export function formatDateTime(isoDateTime: string): string {
  const [date, time] = isoDateTime.split('T')
  return `${formatDate(date).slice(0, 5)} ${time}`
}

/** 12.34 → "+12,3 bps" */
export function formatBps(value: number): string {
  const rounded = Math.round(value * 10) / 10
  const text = `${bpsFormatter.format(rounded)} bps`
  return rounded > 0 ? `+${text}` : text
}

/** Giờ thật theo máy, dạng hh:mm:ss. */
export function formatWallClock(epochMs: number): string {
  const date = new Date(epochMs)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
