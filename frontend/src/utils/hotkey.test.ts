import { describe, expect, it } from 'vitest'
import { isEditableTarget, isPaletteHotkey, paletteShortcutLabel } from './hotkey'

const key = (overrides: Partial<Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>>) => ({
  key: 'k',
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...overrides,
})

/** Phần tử giả đủ cho isEditableTarget (môi trường test là Node, không có DOM). */
const element = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, ...extra }) as unknown as EventTarget

describe('phím tắt tìm nhanh', () => {
  it('Ctrl+K và Cmd+K mở, K thường hoặc kèm Shift thì không', () => {
    expect(isPaletteHotkey(key({ ctrlKey: true }))).toBe(true)
    expect(isPaletteHotkey(key({ metaKey: true, key: 'K' }))).toBe(true)
    expect(isPaletteHotkey(key({}))).toBe(false)
    expect(isPaletteHotkey(key({ ctrlKey: true, shiftKey: true }))).toBe(false)
  })

  it('không chiếm phím khi đang gõ trong ô nhập', () => {
    expect(isEditableTarget(element('INPUT', { type: 'text' }))).toBe(true)
    expect(isEditableTarget(element('INPUT', { type: 'search' }))).toBe(true)
    expect(isEditableTarget(element('TEXTAREA'))).toBe(true)
    expect(isEditableTarget(element('DIV', { isContentEditable: true }))).toBe(true)
    expect(isEditableTarget(element('INPUT', { type: 'checkbox' }))).toBe(false)
    expect(isEditableTarget(element('BUTTON'))).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })

  it('nhãn theo hệ điều hành', () => {
    expect(paletteShortcutLabel('MacIntel')).toBe('⌘ K')
    expect(paletteShortcutLabel('Win32')).toBe('Ctrl K')
  })
})
