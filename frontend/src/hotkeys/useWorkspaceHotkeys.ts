import type { DockviewApi } from 'dockview-react'
import { useEffect, type RefObject } from 'react'
import { useHotkeys, useHotkeysContext } from 'react-hotkeys-hook'
import { useUiStore } from '@/store/ui.store'
import { focusPanelAt, openTicket, showPanel } from '@/workspace/commands'
import { useHotkeyOptions } from './useHotkeyOptions'

/**
 * Các phím của Bàn làm việc gắn vào MỘT document: B / S mở phiếu Mua / Bán, O Sổ lệnh, D Sổ lệnh 3 mức, N Thông báo,
 * Alt+1..9 chuyển panel. Không phím nào gửi lệnh.
 * `doc`: cửa sổ tách (Đợt 10B); bỏ trống là cửa sổ chính. Panel ở cửa sổ tách vẫn chạy trong cây React của cửa sổ
 * chính, nên phím gõ ở cửa sổ đó phải được nghe trên chính document của nó.
 */
export function useWorkspaceHotkeyBindings(apiRef: RefObject<DockviewApi | null>, doc?: Document) {
  const base = useHotkeyOptions('workspace')
  const options = doc ? { ...base, document: doc } : base
  useHotkeys('b', () => apiRef.current && openTicket(apiRef.current, 'BUY'), options)
  useHotkeys('s', () => apiRef.current && openTicket(apiRef.current, 'SELL'), options)
  useHotkeys('o', () => apiRef.current && showPanel(apiRef.current, 'blotter'), options)
  useHotkeys('d', () => apiRef.current && showPanel(apiRef.current, 'depth'), options)
  useHotkeys('n', () => apiRef.current && showPanel(apiRef.current, 'notifications'), options)
  useHotkeys(
    'alt+1, alt+2, alt+3, alt+4, alt+5, alt+6, alt+7, alt+8, alt+9',
    (event) => {
      const digit = Number(event.code.replace('Digit', '').replace('Numpad', ''))
      if (apiRef.current && digit >= 1 && digit <= 9) focusPanelAt(apiRef.current, digit - 1)
    },
    options,
  )
  // Cửa sổ tách: "?" / "/" mở bảng phím tắt ngay trong cửa sổ đó (cửa sổ chính đã có ShortcutSheet tự nghe).
  const global = useHotkeyOptions('global')
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)
  useHotkeys('shift+slash, slash', () => setShortcutsOpen(true, doc?.body), { ...global, document: doc, enabled: Boolean(doc) && global.enabled })
}

/** Phím tắt của Bàn làm việc ở cửa sổ chính (scope "workspace", chỉ bật khi đang ở màn này). */
export function useWorkspaceHotkeys(apiRef: RefObject<DockviewApi | null>) {
  const { enableScope, disableScope } = useHotkeysContext()
  useEffect(() => {
    enableScope('workspace')
    return () => disableScope('workspace')
  }, [enableScope, disableScope])
  useWorkspaceHotkeyBindings(apiRef)
}
