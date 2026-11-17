import { describe, expect, it } from 'vitest'
import { formatBps, formatClock, formatDate, formatDateTime, formatNumber, formatPercent, formatSigned } from './format'

describe('Định dạng kiểu Việt Nam', () => {
  it('số nguyên dùng dấu chấm phân cách nghìn', () => {
    expect(formatNumber(1_000_000)).toBe('1.000.000')
    expect(formatNumber(118_300)).toBe('118.300')
  })

  it('tăng có dấu +, giảm có dấu −, không đổi thì không dấu', () => {
    expect(formatSigned(500)).toBe('+500')
    expect(formatSigned(-1_500)).toBe('-1.500')
    expect(formatSigned(0)).toBe('0')
  })

  it('phần trăm dùng dấu phẩy thập phân, có dấu khi khác 0', () => {
    expect(formatPercent(1.256)).toBe('+1,26%')
    expect(formatPercent(-0.5)).toBe('-0,50%')
    expect(formatPercent(0)).toBe('0,00%')
  })

  it('bps dùng dấu phẩy thập phân', () => {
    expect(formatBps(12.34)).toBe('+12,3 bps')
    expect(formatBps(-3)).toBe('-3,0 bps')
  })

  it('giờ HH:mm:ss, ngày dd/MM/yyyy', () => {
    expect(formatClock(9 * 3600 + 5 * 60 + 7)).toBe('09:05:07')
    expect(formatDate('2026-11-06')).toBe('06/11/2026')
    expect(formatDateTime('2026-11-06T09:15:30')).toBe('06/11 09:15:30')
  })
})
