import type { Options } from 'react-hotkeys-hook'
import { useAppearanceStore } from '@/store/appearance.store'
import { useDemoStore } from '@/store/demo.store'
import { hotkeysEnabled, shouldIgnoreHotkey } from './guard'

/**
 * Tùy chọn chung cho mọi phím tắt: tắt khi người dùng tắt trong Cài đặt hoặc đang chạy Demo; bỏ qua khi đang gõ
 * trong ô nhập, combobox, menu, hoặc khi có hộp thoại mở.
 */
export function useHotkeyOptions(scope: 'workspace' | 'global'): Options {
  const setting = useAppearanceStore((state) => state.settings.shortcuts)
  const demoActive = useDemoStore((state) => state.snapshot !== null)
  return {
    scopes: scope,
    enabled: hotkeysEnabled({ setting, demoActive }),
    enableOnFormTags: false,
    enableOnContentEditable: false,
    ignoreEventWhen: (event) => shouldIgnoreHotkey(event),
    preventDefault: true,
  }
}
