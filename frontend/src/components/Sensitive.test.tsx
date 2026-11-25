import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { maskAccount } from '@/utils/sensitive'
import { Sensitive, SensitiveAccount } from './Sensitive'

// Cài đặt "Ẩn số tiền và bps" lấy từ store; ở đây thay bằng cờ để kiểm phần hiển thị.
const flags = vi.hoisted(() => ({ hidden: false }))
vi.mock('@/store/appearance.store', () => ({ useHideSensitive: () => flags.hidden }))

afterEach(() => {
  flags.hidden = false
})

describe('maskAccount', () => {
  it('giữ 4 ký tự đầu và 3 ký tự cuối', () => {
    expect(maskAccount('058C123456')).toBe('058C•••456')
    expect(maskAccount('058C345678')).toBe('058C•••678')
  })
  it('chuỗi ngắn: che hết', () => {
    expect(maskAccount('1234567')).toBe('•••')
  })
})

describe('Sensitive', () => {
  it('tắt ẩn: hiện nguyên', () => {
    expect(renderToStaticMarkup(<Sensitive>+12,5 bps</Sensitive>)).toBe('+12,5 bps')
    expect(renderToStaticMarkup(<SensitiveAccount value="058C123456" />)).toBe('058C123456')
  })

  it('bật ẩn: bps thành •••, số tài khoản che giữa; không lộ giá trị trong HTML', () => {
    flags.hidden = true
    const bps = renderToStaticMarkup(<Sensitive>+12,5 bps</Sensitive>)
    expect(bps).toContain('•••')
    expect(bps).toContain('đã ẩn')
    expect(bps).not.toContain('12,5')
    const account = renderToStaticMarkup(<SensitiveAccount value="058C123456" />)
    expect(account).toContain('058C•••456')
    expect(account).not.toContain('123456')
  })
})
