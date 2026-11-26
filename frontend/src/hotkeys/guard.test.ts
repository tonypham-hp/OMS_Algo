import { describe, expect, it } from 'vitest'
import { hotkeysEnabled, isDialogOpen, shouldIgnoreHotkey } from './guard'
import { SHORTCUTS } from './shortcuts'

/** Phần tử giả đủ cho bộ lọc: tagName, type, contenteditable, role. */
function element(tagName: string, extra: { type?: string; role?: string; editable?: boolean } = {}) {
  return {
    tagName: tagName.toUpperCase(),
    type: extra.type,
    isContentEditable: extra.editable ?? false,
    getAttribute: (name: string) => (name === 'role' ? (extra.role ?? null) : null),
  } as unknown as HTMLElement
}

const noDialog = { querySelector: () => null }
const withDialog = { querySelector: () => ({}) as Element }

describe('phím tắt không chạy khi đang gõ', () => {
  it.each([
    ['ô nhập chữ', element('input', { type: 'text' })],
    ['ô tìm kiếm', element('input', { type: 'search' })],
    ['ô số', element('input', { type: 'number' })],
    ['textarea', element('textarea')],
    ['select', element('select')],
    ['contenteditable', element('div', { editable: true })],
    ['combobox (ô chọn mã)', element('button', { role: 'combobox' })],
    ['mục menu', element('div', { role: 'menuitem' })],
  ])('%s: bỏ qua phím', (_name, target) => {
    expect(shouldIgnoreHotkey({ target }, noDialog)).toBe(true)
  })

  it.each([
    ['nền trang', element('body')],
    ['nút', element('button')],
    ['ô đánh dấu', element('input', { type: 'checkbox' })],
    ['khung panel', element('section')],
  ])('%s: phím tắt chạy', (_name, target) => {
    expect(shouldIgnoreHotkey({ target }, noDialog)).toBe(false)
  })

  it('đang có hộp thoại mở: bỏ qua phím (Esc, Tab thuộc về hộp thoại)', () => {
    expect(isDialogOpen(withDialog)).toBe(true)
    expect(shouldIgnoreHotkey({ target: element('body') }, withDialog)).toBe(true)
  })
})

describe('bật/tắt phím tắt', () => {
  it('tắt trong Cài đặt hoặc đang chạy Demo thì không chạy', () => {
    expect(hotkeysEnabled({ setting: true, demoActive: false })).toBe(true)
    expect(hotkeysEnabled({ setting: false, demoActive: false })).toBe(false)
    expect(hotkeysEnabled({ setting: true, demoActive: true })).toBe(false)
  })
})

describe('danh sách phím tắt', () => {
  const keys = SHORTCUTS.flatMap((shortcut) => shortcut.keys.split(',').map((key) => key.trim().toLowerCase())).filter(Boolean)

  it('không dùng F1 và không chặn Ctrl+W / Ctrl+T / Ctrl+R', () => {
    for (const forbidden of ['f1', 'ctrl+w', 'ctrl+t', 'ctrl+r', 'meta+w', 'meta+t', 'meta+r']) expect(keys).not.toContain(forbidden)
  })

  it('không có phím nào mang nghĩa gửi lệnh', () => {
    for (const shortcut of SHORTCUTS) expect(shortcut.description).not.toMatch(/gửi lệnh(?! vẫn)|xác nhận đặt/i)
  })

  it('mỗi phím chỉ gắn một việc', () => {
    expect(new Set(keys).size).toBe(keys.length)
  })
})
