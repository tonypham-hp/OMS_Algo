import type { DockviewApi } from 'dockview-react'
import { useEffect, type RefObject } from 'react'
import { useHotkeys, useHotkeysContext } from 'react-hotkeys-hook'
import { focusPanelAt, openTicket, showPanel } from '@/workspace/commands'
import { useHotkeyOptions } from './useHotkeyOptions'

/**
 * Phím tắt của Bàn làm việc (scope "workspace", chỉ bật khi đang ở màn này):
 * B / S mở phiếu Mua / Bán, O Sổ lệnh, D Sổ lệnh 3 mức, N Thông báo, Alt+1..9 chuyển panel.
 * Không phím nào gửi lệnh.
 */
export function useWorkspaceHotkeys(apiRef: RefObject<DockviewApi | null>) {
  const { enableScope, disableScope } = useHotkeysContext()
  useEffect(() => {
    enableScope('workspace')
    return () => disableScope('workspace')
  }, [enableScope, disableScope])

  const options = useHotkeyOptions('workspace')
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
}
