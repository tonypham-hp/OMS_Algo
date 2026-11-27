import type { DockviewApi } from 'dockview-react'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useWorkspaceStore } from '@/store/workspace.store'
import type { Role } from '@/types'
import { LINK_GROUPS } from './panelTypes'
import {
  DEFAULT_LAYOUT_NAME,
  WORKSPACE_SCHEMA_VERSION,
  loadWorkspace,
  parseWorkspaceJson,
  saveWorkspace,
  type SavedGroups,
  type SavedLayout,
  type WorkspaceFile,
  splitPopouts,
  type PendingPopout,
} from './layouts'
import { applyPreset, type PresetId } from './presets'

const SAVE_DELAY_MS = 500

export const defaultPresetFor = (role: Role | undefined): PresetId => (role === 'CUSTOMER' ? 'basic' : 'pro')

function snapshotGroups(): SavedGroups {
  const groups = useWorkspaceStore.getState().groups
  return Object.fromEntries(LINK_GROUPS.map((key) => [key, { symbol: groups[key].symbol, orderId: groups[key].orderId }]))
}

function snapshot(api: DockviewApi): SavedLayout {
  return { dock: api.toJSON(), groups: snapshotGroups() }
}

/** Dựng lại một bố cục đã lưu. Ném lỗi nếu dockview không đọc được (để nơi gọi dùng bố cục mặc định). */
/**
 * Dựng lại một bố cục đã lưu. Ném lỗi nếu dockview không đọc được (để nơi gọi dùng bố cục mặc định).
 * Panel đang ở cửa sổ tách lúc lưu được đưa về lưới (mỗi cửa sổ thành một nhóm ở mép phải) và trả về để người dùng
 * bấm "Mở lại cửa sổ tách": trình duyệt chặn mở cửa sổ khi không có thao tác.
 */
function restore(api: DockviewApi, layout: SavedLayout): ReturnedPopout[] {
  const { dock, pending } = splitPopouts(layout.dock)
  api.fromJSON(dock)
  useWorkspaceStore.getState().loadGroups(layout.groups)
  return pending.map((popout) => {
    const [first, ...others] = popout.panels
    const head = api.addPanel({ id: first.id, component: first.contentComponent, title: first.title, params: first.params, position: { direction: 'right' } })
    for (const panel of others) {
      api.addPanel({ id: panel.id, component: panel.contentComponent, title: panel.title, params: panel.params, position: { referencePanel: head, direction: 'within' } })
    }
    return { panelId: first.id, position: popout.position }
  })
}

/** Cửa sổ tách đã được đưa về bàn làm việc khi khôi phục bố cục, chờ người dùng mở lại. */
export interface ReturnedPopout {
  /** Một panel của nhóm (tách cả nhóm chứa panel này). */
  panelId: string
  position: PendingPopout['position']
}

export interface LayoutMenuState {
  names: string[]
  active: string
}

/**
 * Bố cục của Bàn làm việc theo tài khoản: khôi phục khi mở, tự lưu (sau 500ms yên lặng) khi kéo thả / đổi kích thước /
 * đổi mã của nhóm, nhiều bố cục có tên, mẫu Cơ bản / Chuyên nghiệp, xuất / nhập file JSON.
 * Dữ liệu hỏng thì dùng bố cục mặc định và báo nhẹ (`notice`), không làm trắng trang.
 */
export function useWorkspaceLayouts(apiRef: RefObject<DockviewApi | null>, username: string | undefined, role: Role | undefined) {
  const fileRef = useRef<WorkspaceFile | null>(null)
  const timer = useRef<number | null>(null)
  const [menu, setMenu] = useState<LayoutMenuState>({ names: [DEFAULT_LAYOUT_NAME], active: DEFAULT_LAYOUT_NAME })
  const [notice, setNotice] = useState<string | null>(null)
  const [returned, setReturned] = useState<ReturnedPopout[]>([])
  /** Khôi phục bố cục; panel từng ở cửa sổ tách thì ghi vào danh sách chờ mở lại. */
  const restoreLayout = useCallback((api: DockviewApi, layout: SavedLayout) => {
    const back = restore(api, layout)
    setReturned(back)
    return back
  }, [])

  const syncMenu = useCallback(() => {
    const file = fileRef.current
    if (file) setMenu({ names: Object.keys(file.layouts), active: file.active })
  }, [])

  const flush = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    const api = apiRef.current
    const file = fileRef.current
    if (!api || !file || !username) return
    file.layouts[file.active] = snapshot(api)
    saveWorkspace(username, file)
  }, [apiRef, username])

  const scheduleSave = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS)
  }, [flush])

  /** Gọi trong onReady của dockview. */
  const initialize = useCallback(
    (api: DockviewApi) => {
      const loaded = username ? loadWorkspace(username) : { file: null, notice: null }
      let file = loaded.file
      let message = loaded.notice
      if (file) {
        try {
          restoreLayout(api, file.layouts[file.active])
        } catch {
          file = null
          message = 'Bố cục đã lưu bị hỏng nên Bàn làm việc dùng bố cục mặc định.'
        }
      }
      if (!file) {
        applyPreset(api, defaultPresetFor(role))
        useWorkspaceStore.getState().loadGroups({})
        file = { schemaVersion: WORKSPACE_SCHEMA_VERSION, active: DEFAULT_LAYOUT_NAME, layouts: { [DEFAULT_LAYOUT_NAME]: snapshot(api) } }
      }
      fileRef.current = file
      setNotice(message)
      syncMenu()
      api.onDidLayoutChange(scheduleSave)
    },
    [username, role, syncMenu, scheduleSave, restoreLayout],
  )

  // Đổi mã / lệnh của nhóm cũng là một phần của bố cục.
  useEffect(() => useWorkspaceStore.subscribe(scheduleSave), [scheduleSave])
  // Rời trang: lưu ngay phần còn đang chờ.
  useEffect(() => () => flush(), [flush])

  const switchTo = useCallback(
    (name: string) => {
      const api = apiRef.current
      const file = fileRef.current
      if (!api || !file || !(name in file.layouts) || name === file.active) return
      flush()
      file.active = name
      try {
        restoreLayout(api, file.layouts[name])
      } catch {
        applyPreset(api, defaultPresetFor(role))
        setNotice(`Bố cục "${name}" bị hỏng nên đã thay bằng bố cục mặc định.`)
      }
      flush()
      syncMenu()
    },
    [apiRef, flush, role, syncMenu, restoreLayout],
  )

  const saveAs = useCallback(
    (name: string) => {
      const api = apiRef.current
      const file = fileRef.current
      if (!api || !file) return
      flush()
      file.layouts[name] = snapshot(api)
      file.active = name
      flush()
      syncMenu()
    },
    [apiRef, flush, syncMenu],
  )

  const remove = useCallback(
    (name: string) => {
      const file = fileRef.current
      if (!file || Object.keys(file.layouts).length <= 1) return
      const wasActive = file.active === name
      delete file.layouts[name]
      if (wasActive) {
        // Mở bố cục còn lại đầu tiên (không lưu đè bố cục vừa xóa).
        const next = Object.keys(file.layouts)[0]
        file.active = next
        const api = apiRef.current
        if (api) restoreLayout(api, file.layouts[next])
      }
      flush()
      syncMenu()
    },
    [apiRef, flush, syncMenu, restoreLayout],
  )

  /** Áp bố cục mẫu vào bố cục đang mở (Về mặc định = mẫu theo vai trò, mã các nhóm về mặc định). */
  const applyTemplate = useCallback(
    (preset: PresetId | 'default') => {
      const api = apiRef.current
      if (!api) return
      applyPreset(api, preset === 'default' ? defaultPresetFor(role) : preset)
      if (preset === 'default') useWorkspaceStore.getState().loadGroups({})
      flush()
    },
    [apiRef, flush, role],
  )

  /** Nội dung file xuất (đã gồm thay đổi mới nhất). */
  const exportJson = useCallback(() => {
    flush()
    return JSON.stringify(fileRef.current, null, 2)
  }, [flush])

  /** Nhập file JSON: thêm các bố cục trong file (trùng tên thì thêm hậu tố), mở bố cục đang chọn của file. */
  const importJson = useCallback(
    (text: string): { ok: boolean; message: string } => {
      const api = apiRef.current
      const file = fileRef.current
      const result = parseWorkspaceJson(text)
      if (!result.ok || !api || !file) return { ok: false, message: `Không nhập được bố cục: ${result.ok ? 'bàn làm việc chưa sẵn sàng' : result.reason}.` }
      flush()
      let opened = file.active
      for (const [name, layout] of Object.entries(result.file.layouts)) {
        let target = name
        for (let index = 2; target in file.layouts; index += 1) target = `${name} (${index})`
        file.layouts[target] = layout
        if (name === result.file.active) opened = target
      }
      file.active = opened
      try {
        restoreLayout(api, file.layouts[opened])
      } catch {
        applyPreset(api, defaultPresetFor(role))
      }
      flush()
      syncMenu()
      const count = Object.keys(result.file.layouts).length
      return { ok: true, message: `Đã nhập ${count} bố cục, đang mở "${opened}".` }
    },
    [apiRef, flush, role, syncMenu, restoreLayout],
  )

  return { initialize, menu, notice, setNotice, switchTo, saveAs, remove, applyTemplate, exportJson, importJson, returned, setReturned }
}
