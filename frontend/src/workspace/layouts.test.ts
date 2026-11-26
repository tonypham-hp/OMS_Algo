import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  WORKSPACE_SCHEMA_VERSION,
  loadWorkspace,
  migrateWorkspace,
  nextLayoutName,
  parseWorkspaceJson,
  sanitizeDock,
  saveWorkspace,
  workspaceKey,
  type WorkspaceFile,
} from './layouts'

/** Bố cục dockview tối thiểu: một nhóm trái (Danh mục + Phiếu lệnh), một nhóm phải (Sổ lệnh 3 mức). */
function dock(panels: Record<string, { component: string; group?: unknown }>, views: [string[], string[]]) {
  return {
    grid: {
      root: {
        type: 'branch',
        data: [
          { type: 'leaf', data: { id: 'g1', views: views[0], activeView: views[0][0] }, size: 600 },
          { type: 'leaf', data: { id: 'g2', views: views[1], activeView: views[1][0] }, size: 400 },
        ],
        size: 800,
      },
      width: 1000,
      height: 800,
      orientation: 'HORIZONTAL',
    },
    panels: Object.fromEntries(
      Object.entries(panels).map(([id, panel]) => [id, { id, contentComponent: panel.component, title: id, params: { group: panel.group ?? '1' } }]),
    ),
    activeGroup: 'g1',
  }
}

const V2_FILE: WorkspaceFile = {
  schemaVersion: WORKSPACE_SCHEMA_VERSION,
  active: 'Phiên sáng',
  layouts: {
    'Phiên sáng': {
      dock: dock({ 'watchlist-1': { component: 'watchlist' }, 'ticket-1': { component: 'ticket', group: '2' }, 'depth-1': { component: 'depth' } }, [
        ['watchlist-1', 'ticket-1'],
        ['depth-1'],
      ]) as never,
      groups: { '1': { symbol: 'HPG', orderId: null }, '2': { symbol: 'FPT', orderId: 'PO-1' } },
    },
    'Theo dõi HUNT': {
      dock: dock({ 'blotter-1': { component: 'blotter' }, 'order-detail-1': { component: 'order-detail' } }, [['blotter-1'], ['order-detail-1']]) as never,
      groups: {},
    },
  },
}

function stubStorage(initial: Record<string, string> = {}, broken = false) {
  const data = new Map(Object.entries(initial))
  const guard = () => {
    if (broken) throw new DOMException('blocked', 'SecurityError')
  }
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => (guard(), data.get(key) ?? null),
      setItem: (key: string, value: string) => (guard(), void data.set(key, value)),
    },
  })
  return data
}

afterEach(() => vi.unstubAllGlobals())

describe('lưu và khôi phục bố cục', () => {
  it('v2: JSON đi rồi về giữ nguyên (nhiều bố cục có tên, nhóm liên kết)', () => {
    const result = parseWorkspaceJson(JSON.stringify(V2_FILE))
    expect(result).toEqual({ ok: true, file: V2_FILE })
  })

  it('lưu theo từng tài khoản, đọc lại đúng tài khoản', () => {
    const data = stubStorage()
    expect(saveWorkspace('dealer', V2_FILE)).toBe(true)
    expect(data.has(workspaceKey('dealer'))).toBe(true)
    expect(loadWorkspace('dealer')).toEqual({ file: V2_FILE, notice: null })
    expect(loadWorkspace('vanhanh')).toEqual({ file: null, notice: null })
  })

  it('JSON hỏng → không có bố cục (trang dùng mặc định) và câu báo nhẹ, không ném lỗi', () => {
    stubStorage({ [workspaceKey('dealer')]: '{hỏng' })
    const result = loadWorkspace('dealer')
    expect(result.file).toBeNull()
    expect(result.notice).toMatch(/bị hỏng/)
  })

  it('localStorage bị chặn → coi như chưa lưu, lưu trả false, không ném lỗi', () => {
    stubStorage({}, true)
    expect(loadWorkspace('dealer')).toEqual({ file: null, notice: null })
    expect(saveWorkspace('dealer', V2_FILE)).toBe(false)
  })

  it('phiên bản lạ hoặc không còn bố cục hợp lệ → lỗi có lý do', () => {
    expect(migrateWorkspace({ schemaVersion: 99, layouts: {} })).toMatchObject({ ok: false })
    expect(migrateWorkspace({ schemaVersion: 2, active: 'x', layouts: { x: { dock: { grid: {} } } } })).toMatchObject({ ok: false })
    expect(parseWorkspaceJson('null')).toMatchObject({ ok: false })
  })

  it('một bố cục hỏng trong file v2 chỉ bỏ bố cục đó; active trỏ bố cục đã mất thì mở bố cục còn lại', () => {
    const raw = structuredClone(V2_FILE) as unknown as { layouts: Record<string, unknown>; active: string }
    raw.layouts['Phiên sáng'] = { dock: 'hỏng' }
    const result = migrateWorkspace(raw)
    expect(result.ok && Object.keys(result.file.layouts)).toEqual(['Theo dõi HUNT'])
    expect(result.ok && result.file.active).toBe('Theo dõi HUNT')
  })
})

describe('migrate schema v1 → v2', () => {
  const v1 = {
    version: 1,
    name: 'Bố cục cũ',
    layout: dock(
      {
        p1: { component: 'priceBoard' },
        p2: { component: 'book3' },
        p3: { component: 'chartWidget' },
        p4: { component: 'detail', group: 'xanh' },
      },
      [
        ['p3', 'p1'],
        ['p2', 'p4'],
      ],
    ),
  }

  it('đổi ID panel cũ sang loại mới, bỏ panel không còn tồn tại, sửa nhóm lạ về Nhóm 1', () => {
    const result = migrateWorkspace(v1)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.migratedFrom).toBe(1)
    expect(result.file.schemaVersion).toBe(2)
    expect(result.file.active).toBe('Bố cục cũ')
    const migrated = result.file.layouts['Bố cục cũ'].dock as unknown as ReturnType<typeof dock>
    expect(Object.fromEntries(Object.entries(migrated.panels).map(([id, panel]) => [id, panel.contentComponent]))).toEqual({
      p1: 'watchlist',
      p2: 'depth',
      p4: 'order-detail',
    })
    expect(migrated.panels.p4.params.group).toBe('1')
    const [left] = migrated.grid.root.data as Array<{ data: { views: string[]; activeView: string } }>
    // Panel lạ bị bỏ khỏi nhóm; panel đang mở của nhóm chuyển sang panel còn lại.
    expect(left.data.views).toEqual(['p1'])
    expect(left.data.activeView).toBe('p1')
  })

  it('v1 không còn panel nào hợp lệ → lỗi, trang dùng bố cục mặc định', () => {
    expect(migrateWorkspace({ version: 1, layout: dock({ x: { component: 'chartWidget' } }, [['x'], []]) })).toMatchObject({ ok: false })
  })

  it('không đụng vào dữ liệu gốc', () => {
    const copy = structuredClone(v1)
    migrateWorkspace(v1)
    expect(v1).toEqual(copy)
  })
})

describe('sanitizeDock và tên bố cục', () => {
  it('bỏ nhóm tách cửa sổ (chưa hỗ trợ đến Đợt 10B) và nhóm nổi rỗng', () => {
    const raw = {
      ...dock({ 'watchlist-1': { component: 'watchlist' } }, [['watchlist-1'], []]),
      popoutGroups: [{ data: { views: ['watchlist-1'] } }],
      floatingGroups: [{ data: { id: 'f', views: ['ghost'] }, position: {} }],
    }
    const cleaned = sanitizeDock(raw) as unknown as Record<string, unknown>
    expect(cleaned.popoutGroups).toBeUndefined()
    expect(cleaned.floatingGroups).toEqual([])
  })

  it('tên bố cục mới không trùng', () => {
    expect(nextLayoutName(['Mặc định'])).toBe('Bố cục 2')
    expect(nextLayoutName(['Mặc định', 'Bố cục 2'])).toBe('Bố cục 3')
  })
})
