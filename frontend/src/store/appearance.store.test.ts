import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** localStorage giả trong bộ nhớ; `broken` làm mọi lệnh ném lỗi như trình duyệt chặn lưu trữ. */
function fakeStorage(initial: Record<string, string> = {}, broken = false) {
  const data = new Map(Object.entries(initial))
  const guard = () => {
    if (broken) throw new DOMException('blocked', 'SecurityError')
  }
  return {
    data,
    getItem: (key: string) => (guard(), data.get(key) ?? null),
    setItem: (key: string, value: string) => (guard(), void data.set(key, value)),
    removeItem: (key: string) => (guard(), void data.delete(key)),
  }
}

function stubWindow(storage: ReturnType<typeof fakeStorage>, media: Record<string, boolean> = {}) {
  vi.stubGlobal('window', {
    localStorage: storage,
    matchMedia: (query: string) => ({ matches: media[query] ?? false }),
  })
}

async function loadStore() {
  vi.resetModules()
  return (await import('./appearance.store')).useAppearanceStore
}

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('appearance store', () => {
  it('chưa lưu gì: Tối', async () => {
    stubWindow(fakeStorage())
    const store = await loadStore()
    expect(store.getState().resolved.theme).toBe('dark')
  })

  it('khởi tạo từ bản `:last` (cùng nguồn với script khởi động)', async () => {
    stubWindow(fakeStorage({ 'oms-appearance:last': JSON.stringify({ mode: 'light' }) }))
    const store = await loadStore()
    expect(store.getState().resolved.theme).toBe('light')
  })

  it('Theo hệ thống + prefers-contrast: more', async () => {
    stubWindow(fakeStorage({ 'oms-appearance:last': JSON.stringify({ mode: 'system' }) }), {
      '(prefers-color-scheme: dark)': false,
      '(prefers-contrast: more)': true,
    })
    const store = await loadStore()
    expect(store.getState().resolved.theme).toBe('hc-light')
    store.getState().setEnv({ prefersDark: true, prefersMoreContrast: false, forcedColors: false })
    expect(store.getState().resolved.theme).toBe('dark')
  })

  it('lưu riêng từng tài khoản và cập nhật `:last` khi đổi tài khoản', async () => {
    const storage = fakeStorage()
    stubWindow(storage)
    const store = await loadStore()
    store.getState().loadFor('dealer01')
    store.getState().update({ mode: 'light', palette: 'cvd' })
    store.getState().loadFor('trader02')
    expect(store.getState().resolved.theme).toBe('dark')
    expect(store.getState().settings.palette).toBe('default')
    store.getState().update({ highContrast: true })
    store.getState().loadFor('dealer01')
    expect(store.getState().resolved).toMatchObject({ theme: 'light', palette: 'cvd' })
    expect(JSON.parse(storage.data.get('oms-appearance:trader02')!)).toMatchObject({ highContrast: true })
    expect(JSON.parse(storage.data.get('oms-appearance:last')!)).toMatchObject({ mode: 'light', palette: 'cvd' })
  })

  it('localStorage ném lỗi: vẫn chạy, mặc định Tối, đổi được trong phiên', async () => {
    stubWindow(fakeStorage({}, true))
    const store = await loadStore()
    expect(store.getState().resolved.theme).toBe('dark')
    store.getState().loadFor('dealer01')
    expect(store.getState().resolved.theme).toBe('dark')
    store.getState().toggleMode()
    expect(store.getState().resolved.theme).toBe('light')
  })

  it('dữ liệu hỏng: mặc định Tối', async () => {
    stubWindow(fakeStorage({ 'oms-appearance:last': '{hỏng' }))
    const store = await loadStore()
    expect(store.getState().resolved.theme).toBe('dark')
  })

  it('toggleMode: Theo hệ thống đang sáng → Tối; giữ tương phản cao', async () => {
    stubWindow(fakeStorage({ 'oms-appearance:last': JSON.stringify({ mode: 'system', highContrast: true }) }))
    const store = await loadStore()
    expect(store.getState().resolved.theme).toBe('hc-light')
    store.getState().toggleMode()
    expect(store.getState().settings.mode).toBe('dark')
    expect(store.getState().resolved.theme).toBe('hc-dark')
  })
})
