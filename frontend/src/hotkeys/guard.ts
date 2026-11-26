import { isEditableTarget } from '@/utils/hotkey'

/** Vai trò ARIA của điều khiển đang nhận phím mũi tên/chữ: phím tắt một chữ cái không được chiếm phím của chúng. */
const TYPING_ROLES = new Set(['combobox', 'listbox', 'option', 'menu', 'menuitem', 'menuitemradio', 'menuitemcheckbox', 'textbox', 'searchbox', 'spinbutton', 'slider'])

/** Có hộp thoại (modal) đang mở: phím tắt không chạy, để Esc và Tab thuộc về hộp thoại. */
export function isDialogOpen(doc: Pick<Document, 'querySelector'> = document): boolean {
  return doc.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]') !== null
}

/**
 * Phím tắt có bị bỏ qua cho sự kiện này không: đang gõ trong ô nhập / textarea / select / contenteditable,
 * focus đang ở combobox, menu, danh sách chọn, hoặc đang có hộp thoại mở.
 */
export function shouldIgnoreHotkey(event: Pick<KeyboardEvent, 'target'>, doc: Pick<Document, 'querySelector'> = document): boolean {
  const target = event.target as HTMLElement | null
  if (isEditableTarget(target)) return true
  const role = target?.getAttribute?.('role')
  if (role && TYPING_ROLES.has(role)) return true
  return isDialogOpen(doc)
}

/** Phím tắt chỉ bật khi người dùng không tắt trong Cài đặt và không đang chạy Demo (Demo có phím riêng). */
export function hotkeysEnabled({ setting, demoActive }: { setting: boolean; demoActive: boolean }): boolean {
  return setting && !demoActive
}
