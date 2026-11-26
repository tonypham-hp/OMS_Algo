// Lưu / khôi phục bố cục Bàn làm việc (Đợt 10A). Hàm thuần + localStorage bọc try/catch; test ở layouts.test.ts.
import type { SerializedDockview } from 'dockview-react'
import { LINK_GROUPS, isPanelKind, type PanelKind } from './panelTypes'

export const WORKSPACE_SCHEMA_VERSION = 2
/** Tên bố cục đầu tiên của mỗi tài khoản. */
export const DEFAULT_LAYOUT_NAME = 'Mặc định'

type GroupKey = (typeof LINK_GROUPS)[number]
export type SavedGroups = Partial<Record<GroupKey, { symbol?: string; orderId?: string | null }>>

export interface SavedLayout {
  dock: SerializedDockview
  /** Mã và lệnh đang xem của từng nhóm liên kết. */
  groups: SavedGroups
}

/** Dạng lưu trong localStorage và file xuất/nhập. */
export interface WorkspaceFile {
  schemaVersion: typeof WORKSPACE_SCHEMA_VERSION
  active: string
  layouts: Record<string, SavedLayout>
}

export const workspaceKey = (username: string) => `oms-workspace:${username}`

/**
 * Đổi ID panel giữa các phiên bản schema. v1 (bản nháp đầu của Bàn làm việc) đặt tên component theo tên file;
 * v2 dùng tên loại panel ngắn. Thêm dòng ở đây khi đổi tên loại panel, kèm tăng schemaVersion.
 */
export const V1_PANEL_RENAMES: Record<string, PanelKind> = {
  priceBoard: 'watchlist',
  orderTicket: 'ticket',
  book3: 'depth',
  orderBook: 'blotter',
  detail: 'order-detail',
  runningAlgos: 'algos',
  notifications: 'notifications',
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Bỏ id panel khỏi các nhóm (lá của cây lưới), đệ quy. */
function pruneViews(node: unknown, keep: Set<string>): void {
  if (!isObject(node)) return
  if (node.type === 'leaf' && isObject(node.data) && Array.isArray(node.data.views)) {
    const views = (node.data.views as unknown[]).filter((view): view is string => typeof view === 'string' && keep.has(view))
    node.data.views = views
    if (typeof node.data.activeView === 'string' && !keep.has(node.data.activeView)) node.data.activeView = views[0]
    return
  }
  if (node.type === 'branch' && Array.isArray(node.data)) for (const child of node.data) pruneViews(child, keep)
}

/**
 * Kiểm và làm sạch một bố cục dockview: đổi tên component cũ (`renames`), bỏ panel không còn loại nào khớp,
 * bỏ nhóm tách cửa sổ (Đợt 10B mới có). Trả null nếu không còn panel nào hoặc dữ liệu không đúng dạng.
 */
export function sanitizeDock(raw: unknown, renames: Record<string, PanelKind> = {}): SerializedDockview | null {
  if (!isObject(raw) || !isObject(raw.grid) || !isObject(raw.grid.root) || !isObject(raw.panels)) return null
  const dock = structuredClone(raw) as Record<string, unknown> & { grid: { root: unknown }; panels: Record<string, unknown> }
  const keep = new Set<string>()
  for (const [id, value] of Object.entries(dock.panels)) {
    if (!isObject(value)) {
      delete dock.panels[id]
      continue
    }
    const component = typeof value.contentComponent === 'string' ? (renames[value.contentComponent] ?? value.contentComponent) : undefined
    if (!isPanelKind(component)) {
      delete dock.panels[id]
      continue
    }
    value.contentComponent = component
    const params = isObject(value.params) ? value.params : {}
    const group = params.group
    value.params = { ...params, group: group === 'none' || (LINK_GROUPS as readonly unknown[]).includes(group) ? group : '1' }
    keep.add(id)
  }
  if (keep.size === 0) return null
  pruneViews(dock.grid.root, keep)
  if (Array.isArray(dock.floatingGroups)) {
    dock.floatingGroups = dock.floatingGroups.filter((floating) => {
      if (!isObject(floating)) return false
      pruneViews({ type: 'leaf', data: floating.data }, keep)
      return isObject(floating.data) && Array.isArray(floating.data.views) && floating.data.views.length > 0
    })
  }
  delete dock.popoutGroups
  return dock as unknown as SerializedDockview
}

function sanitizeGroups(raw: unknown): SavedGroups {
  const groups: SavedGroups = {}
  if (!isObject(raw)) return groups
  for (const key of LINK_GROUPS) {
    const value = raw[key]
    if (!isObject(value)) continue
    groups[key] = {
      symbol: typeof value.symbol === 'string' ? value.symbol : undefined,
      orderId: typeof value.orderId === 'string' ? value.orderId : null,
    }
  }
  return groups
}

export type MigrateResult = { ok: true; file: WorkspaceFile; migratedFrom?: number } | { ok: false; reason: string }

/**
 * Đọc dữ liệu đã lưu (mọi phiên bản schema) thành WorkspaceFile v2.
 * - v1: `{ version: 1, layout, name? }` một bố cục, tên component cũ → đổi theo V1_PANEL_RENAMES.
 * - v2: kiểm lại từng bố cục; bố cục hỏng thì bỏ riêng bố cục đó.
 */
export function migrateWorkspace(raw: unknown): MigrateResult {
  if (!isObject(raw)) return { ok: false, reason: 'Không phải dữ liệu bố cục' }
  if (raw.version === 1 || raw.schemaVersion === 1) {
    const dock = sanitizeDock(raw.layout, V1_PANEL_RENAMES)
    if (!dock) return { ok: false, reason: 'Bố cục v1 không còn panel hợp lệ' }
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : DEFAULT_LAYOUT_NAME
    return { ok: true, migratedFrom: 1, file: { schemaVersion: WORKSPACE_SCHEMA_VERSION, active: name, layouts: { [name]: { dock, groups: {} } } } }
  }
  if (raw.schemaVersion !== WORKSPACE_SCHEMA_VERSION) return { ok: false, reason: `Phiên bản bố cục không hỗ trợ: ${String(raw.schemaVersion)}` }
  if (!isObject(raw.layouts)) return { ok: false, reason: 'Thiếu danh sách bố cục' }
  const layouts: Record<string, SavedLayout> = {}
  for (const [name, value] of Object.entries(raw.layouts)) {
    if (!isObject(value)) continue
    const dock = sanitizeDock(value.dock)
    if (dock) layouts[name] = { dock, groups: sanitizeGroups(value.groups) }
  }
  const names = Object.keys(layouts)
  if (names.length === 0) return { ok: false, reason: 'Không có bố cục hợp lệ' }
  const active = typeof raw.active === 'string' && raw.active in layouts ? raw.active : names[0]
  return { ok: true, file: { schemaVersion: WORKSPACE_SCHEMA_VERSION, active, layouts } }
}

/** Chuỗi JSON (file nhập, localStorage) → WorkspaceFile; JSON hỏng trả lỗi, không ném. */
export function parseWorkspaceJson(text: string): MigrateResult {
  try {
    return migrateWorkspace(JSON.parse(text))
  } catch {
    return { ok: false, reason: 'JSON hỏng' }
  }
}

const browserStorage = (): Storage | undefined => (typeof window === 'undefined' ? undefined : window.localStorage)

export type LoadResult = { file: WorkspaceFile | null; notice: string | null }

/**
 * Đọc bố cục đã lưu của một tài khoản. Chưa lưu: file null, không báo gì. Hỏng: file null kèm câu báo nhẹ
 * (trang dùng bố cục mặc định, không trắng trang). Lưu trữ bị chặn: coi như chưa lưu.
 */
export function loadWorkspace(username: string): LoadResult {
  let text: string | null
  try {
    text = browserStorage()?.getItem(workspaceKey(username)) ?? null
  } catch {
    return { file: null, notice: null }
  }
  if (text === null) return { file: null, notice: null }
  const result = parseWorkspaceJson(text)
  if (!result.ok) return { file: null, notice: 'Bố cục đã lưu bị hỏng nên Bàn làm việc dùng bố cục mặc định.' }
  return { file: result.file, notice: null }
}

export function saveWorkspace(username: string, file: WorkspaceFile): boolean {
  try {
    browserStorage()?.setItem(workspaceKey(username), JSON.stringify(file))
    return true
  } catch {
    return false
  }
}

/** Tên bố cục mới không trùng: "Bố cục 2", "Bố cục 3"… */
export function nextLayoutName(names: Iterable<string>, base = 'Bố cục'): string {
  const taken = new Set(names)
  for (let index = 2; ; index += 1) if (!taken.has(`${base} ${index}`)) return `${base} ${index}`
}
