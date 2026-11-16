import { useEffect } from 'react'
import { useUiStore } from '@/store/ui.store'
import { isEditableTarget, isPaletteHotkey } from '@/utils/hotkey'

/** Ctrl+K / Cmd+K mở hộp tìm nhanh, trừ khi đang gõ trong một ô nhập khác. Bấm lại thì đóng. */
export function usePaletteHotkey() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isPaletteHotkey(event)) return
      const { paletteOpen, setPaletteOpen } = useUiStore.getState()
      // Ô tìm của chính hộp này cũng là ô nhập: cho phép Ctrl+K để đóng.
      if (!paletteOpen && isEditableTarget(event.target)) return
      event.preventDefault()
      setPaletteOpen(!paletteOpen)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
