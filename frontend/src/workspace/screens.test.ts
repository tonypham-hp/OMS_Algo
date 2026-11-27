import { describe, expect, it } from 'vitest'
import { pickDefaultScreen, placeOnScreen, requestScreens, screenLabel, supportsScreenDetails, type ScreenInfo } from './screens'

const laptop: ScreenInfo = { label: 'Built-in', availLeft: 0, availTop: 0, availWidth: 1920, availHeight: 1040, isPrimary: true }
const monitor: ScreenInfo = { label: 'DELL U2720Q', availLeft: 1920, availTop: 0, availWidth: 2560, availHeight: 1400 }
const small: ScreenInfo = { availLeft: -1366, availTop: 200, availWidth: 1366, availHeight: 728 }

describe('đặt cửa sổ lên màn hình', () => {
  it('cửa sổ giữa vùng dùng được của màn hình đã chọn', () => {
    expect(placeOnScreen(monitor)).toEqual({ width: 960, height: 720, left: 1920 + (2560 - 960) / 2, top: (1400 - 720) / 2 })
  })

  it('màn hình nhỏ: thu cửa sổ cho vừa (chừa lề), toạ độ âm (màn bên trái) vẫn đúng', () => {
    const box = placeOnScreen(small)
    // Rộng 960 vẫn vừa; cao 720 thì không (728 - 80 lề = 648).
    expect(box.width).toBe(960)
    expect(box.height).toBe(728 - 80)
    expect(box.left).toBe(-1366 + (1366 - 960) / 2)
    expect(box.top).toBe(200 + 40)
  })

  it('chọn sẵn màn KHÁC màn đang mở bàn làm việc; chỉ một màn thì dùng màn đó', () => {
    expect(pickDefaultScreen([laptop, monitor], laptop)).toBe(monitor)
    expect(pickDefaultScreen([laptop], laptop)).toBe(laptop)
  })

  it('tên màn hình: nhãn hệ điều hành hoặc "Màn hình n", kèm độ phân giải', () => {
    expect(screenLabel(laptop, 0)).toBe('Built-in · 1920×1040 · màn chính')
    expect(screenLabel(small, 2)).toBe('Màn hình 3 · 1366×728')
  })
})

describe('khi trình duyệt không có Window Management API hoặc từ chối quyền', () => {
  it('không có API: không hỗ trợ, requestScreens trả null (mở cửa sổ bình thường)', async () => {
    expect(supportsScreenDetails({})).toBe(false)
    expect(supportsScreenDetails(undefined)).toBe(false)
    await expect(requestScreens({})).resolves.toBeNull()
  })

  it('người dùng từ chối quyền (Promise bị từ chối): null, không ném lỗi', async () => {
    const win = { getScreenDetails: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) }
    expect(supportsScreenDetails(win)).toBe(true)
    await expect(requestScreens(win)).resolves.toBeNull()
  })

  it('có quyền: trả danh sách màn hình và màn hiện tại', async () => {
    const win = { getScreenDetails: async () => ({ screens: [laptop, monitor], currentScreen: laptop }) }
    await expect(requestScreens(win)).resolves.toEqual({ screens: [laptop, monitor], currentScreen: laptop })
  })
})
