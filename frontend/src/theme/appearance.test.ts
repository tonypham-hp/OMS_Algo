import { describe, expect, it } from 'vitest'
import { DEFAULT_APPEARANCE, parseAppearance, resolveAppearance, type MediaEnvironment } from './appearance'
import { BOOTSTRAP_SCRIPT, injectBootstrap } from './bootstrap'

const NO_PREF: MediaEnvironment = { prefersDark: false, prefersMoreContrast: false, forcedColors: false }

/** Chạy script khởi động với document/window giả; trả về các thuộc tính nó đặt lên <html>. */
function runBootstrap(stored: string | null | 'throw', env: MediaEnvironment) {
  const attrs: Record<string, string> = {}
  const style: { colorScheme?: string } = {}
  const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v), style } }
  const window = {
    localStorage: {
      getItem: () => {
        if (stored === 'throw') throw new Error('SecurityError')
        return stored
      },
    },
    matchMedia: (q: string) => ({
      matches:
        (q === '(prefers-color-scheme: dark)' && env.prefersDark) ||
        (q === '(prefers-contrast: more)' && env.prefersMoreContrast) ||
        (q === '(forced-colors: active)' && env.forcedColors),
    }),
  }
  new Function('window', 'document', BOOTSTRAP_SCRIPT)(window, document)
  return { attrs, colorScheme: style.colorScheme }
}

describe('resolveAppearance', () => {
  it('mặc định Tối khi chưa lưu gì', () => {
    expect(resolveAppearance(DEFAULT_APPEARANCE, NO_PREF).theme).toBe('dark')
    expect(resolveAppearance(parseAppearance(undefined), { ...NO_PREF, prefersDark: false }).theme).toBe('dark')
  })

  it('Theo hệ thống: theo prefers-color-scheme', () => {
    const system = { ...DEFAULT_APPEARANCE, mode: 'system' as const }
    expect(resolveAppearance(system, { ...NO_PREF, prefersDark: true }).theme).toBe('dark')
    expect(resolveAppearance(system, NO_PREF).theme).toBe('light')
  })

  it('prefers-contrast: more bật tương phản cao khi chưa chọn; lựa chọn đã lưu thắng hệ thống', () => {
    const more = { ...NO_PREF, prefersMoreContrast: true }
    expect(resolveAppearance(DEFAULT_APPEARANCE, more).theme).toBe('hc-dark')
    expect(resolveAppearance({ ...DEFAULT_APPEARANCE, mode: 'light' }, more).theme).toBe('hc-light')
    expect(resolveAppearance({ ...DEFAULT_APPEARANCE, highContrast: false }, more).theme).toBe('dark')
    expect(resolveAppearance({ ...DEFAULT_APPEARANCE, mode: 'light', highContrast: true }, NO_PREF).theme).toBe('hc-light')
  })

  it('forced-colors được ghi nhận, color-scheme theo nền sáng/tối', () => {
    const r = resolveAppearance({ ...DEFAULT_APPEARANCE, mode: 'light', highContrast: true }, { ...NO_PREF, forcedColors: true })
    expect(r.forcedColors).toBe(true)
    expect(r.colorScheme).toBe('light')
  })

  it('parseAppearance bỏ giá trị lạ, giữ giá trị hợp lệ', () => {
    expect(parseAppearance({ mode: 'blue', fontScale: 120, flash: 'yes', palette: 'cvd', density: 'compact' })).toEqual({
      ...DEFAULT_APPEARANCE,
      palette: 'cvd',
      density: 'compact',
    })
    expect(parseAppearance('rác')).toEqual(DEFAULT_APPEARANCE)
  })
})

describe('script khởi động trong index.html', () => {
  const cases: Array<[string, unknown, MediaEnvironment]> = [
    ['chưa lưu', null, NO_PREF],
    ['sáng', { mode: 'light' }, { ...NO_PREF, prefersDark: true }],
    ['hệ thống tối', { mode: 'system' }, { ...NO_PREF, prefersDark: true }],
    ['hệ thống sáng + tương phản', { mode: 'system' }, { ...NO_PREF, prefersMoreContrast: true }],
    ['tắt tương phản dù hệ thống bật', { mode: 'light', highContrast: false }, { ...NO_PREF, prefersMoreContrast: true }],
    ['đủ tùy chọn', { mode: 'dark', highContrast: true, palette: 'cvd', density: 'compact', fontScale: 110, flash: false }, NO_PREF],
    ['giá trị lạ', { mode: 'x', palette: 'y', fontScale: 75 }, { ...NO_PREF, forcedColors: true }],
  ]

  it.each(cases)('%s: cùng kết quả với resolveAppearance', (_name, saved, env) => {
    const { attrs, colorScheme } = runBootstrap(saved === null ? null : JSON.stringify(saved), env)
    const expected = resolveAppearance(parseAppearance(saved), env)
    expect(attrs['data-theme']).toBe(expected.theme)
    expect(attrs['data-palette']).toBe(expected.palette)
    expect(attrs['data-density']).toBe(expected.density)
    expect(attrs['data-font-scale']).toBe(String(expected.fontScale))
    expect(attrs['data-flash']).toBe(expected.flash)
    expect(attrs['data-forced-colors']).toBe(expected.forcedColors ? 'active' : undefined)
    expect(colorScheme).toBe(expected.colorScheme)
  })

  it('localStorage ném lỗi hoặc JSON hỏng: không văng lỗi, rơi về Tối', () => {
    expect(runBootstrap('throw', NO_PREF).attrs['data-theme']).toBe('dark')
    expect(runBootstrap('{hỏng', NO_PREF).attrs['data-theme']).toBe('dark')
  })

  it('được chèn vào chỗ đánh dấu trong index.html', () => {
    const html = injectBootstrap('<head><!-- theme-bootstrap --></head>')
    expect(html).toContain("localStorage.getItem('oms-appearance:last')")
    expect(html).not.toContain('<!-- theme-bootstrap -->')
  })
})
