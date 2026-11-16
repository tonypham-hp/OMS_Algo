/** Phần tử đang nhận chữ gõ: phím tắt toàn cục không được chiếm phím của ô này. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false
  const element = target as HTMLElement
  const tag = element.tagName.toLowerCase()
  if (tag === 'textarea' || tag === 'select') return true
  if (tag === 'input') {
    const type = ((element as HTMLInputElement).type ?? 'text').toLowerCase()
    return !['button', 'checkbox', 'radio', 'submit', 'reset', 'range', 'color', 'file'].includes(type)
  }
  return element.isContentEditable === true
}

/** Ctrl+K (Windows, Linux) hoặc Cmd+K (Mac), không kèm Shift, Alt. */
export function isPaletteHotkey(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k'
}

/** Nhãn phím tắt theo hệ điều hành. */
export function paletteShortcutLabel(platform: string = typeof navigator === 'undefined' ? '' : navigator.platform): string {
  return /mac|iphone|ipad/i.test(platform) ? '⌘ K' : 'Ctrl K'
}
