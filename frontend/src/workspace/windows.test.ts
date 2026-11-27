import { beforeEach, describe, expect, it, vi } from 'vitest'
import { closeAllWindows, installWindowSafety, popoutBlockedReason, useWindowsStore } from './windows'

const fakeWindow = (closed = false) => ({ closed, close: vi.fn() }) as unknown as Window

beforeEach(() => useWindowsStore.setState({ windows: [] }))

describe('sổ đăng ký cửa sổ phụ', () => {
  it('thêm, thay (cùng id), gỡ', () => {
    const { addWindow, removeWindow } = useWindowsStore.getState()
    const first = fakeWindow()
    const second = fakeWindow()
    addWindow({ id: 'g1', kind: 'popout', window: first })
    addWindow({ id: 'g1', kind: 'popout', window: second })
    addWindow({ id: 'mini-ticket', kind: 'mini-ticket', window: fakeWindow() })
    expect(useWindowsStore.getState().windows.map((entry) => entry.id)).toEqual(['g1', 'mini-ticket'])
    expect(useWindowsStore.getState().windows[0].window).toBe(second)
    removeWindow('g1')
    expect(useWindowsStore.getState().windows.map((entry) => entry.id)).toEqual(['mini-ticket'])
  })

  it('closeAllWindows: đóng mọi cửa sổ còn mở, bỏ qua cửa sổ đã đóng hoặc ném lỗi', () => {
    const open = fakeWindow()
    const already = fakeWindow(true)
    const broken = { closed: false, close: () => { throw new Error('mất') } } as unknown as Window
    closeAllWindows([{ window: open }, { window: already }, { window: broken }])
    expect(open.close).toHaveBeenCalledOnce()
    expect(already.close).not.toHaveBeenCalled()
  })
})

describe('an toàn khi đăng xuất và khi chạy Demo', () => {
  /** Store giả: subscribe trả hàm gỡ, `emit` gọi listener. */
  function fakeSource() {
    const listeners = new Set<() => void>()
    return {
      subscribe: (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener)),
      emit: () => listeners.forEach((listener) => listener()),
      size: () => listeners.size,
    }
  }

  it('đăng xuất hoặc bắt đầu Demo thì đóng mọi cửa sổ phụ; gỡ thì thôi nghe', () => {
    const logout = fakeSource()
    const demo = fakeSource()
    const close = vi.fn()
    const stop = installWindowSafety({ onLogout: logout.subscribe, onDemoStart: demo.subscribe, close })
    logout.emit()
    demo.emit()
    expect(close).toHaveBeenCalledTimes(2)
    stop()
    expect(logout.size() + demo.size()).toBe(0)
  })

  it('đang chạy Demo: khóa tách cửa sổ, có lý do', () => {
    expect(popoutBlockedReason({ demoActive: true })).toMatch(/Demo/)
    expect(popoutBlockedReason({ demoActive: false })).toBeNull()
  })
})
