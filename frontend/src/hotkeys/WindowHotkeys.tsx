import type { DockviewApi } from 'dockview-react'
import type { RefObject } from 'react'
import { useWindowsStore } from '@/workspace/windows'
import { useWorkspaceHotkeyBindings } from './useWorkspaceHotkeys'

function OneWindow({ apiRef, doc }: { apiRef: RefObject<DockviewApi | null>; doc: Document }) {
  useWorkspaceHotkeyBindings(apiRef, doc)
  return null
}

/** Gắn phím tắt của Bàn làm việc vào từng cửa sổ tách đang mở (Đợt 10B). */
export function WindowHotkeys({ apiRef }: { apiRef: RefObject<DockviewApi | null> }) {
  const windows = useWindowsStore((state) => state.windows)
  return (
    <>
      {windows
        .filter((entry) => entry.kind === 'popout' && !entry.window.closed)
        .map((entry) => (
          <OneWindow key={entry.id} apiRef={apiRef} doc={entry.window.document} />
        ))}
    </>
  )
}
