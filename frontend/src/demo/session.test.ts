import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOrderEngine } from '@/mocks/engine'
import { createMarketTape } from '@/mocks/marketTape'
import { createSeedData } from '@/mocks/seedOrders'
import { createMarketSimulator } from '@/mocks/simulator'
import { createConfigStore } from '@/mocks/systemConfig'
import { createRunner } from './runner'
import { SCENARIOS } from './scenarios'
import { createDemoSession, type StorageLike } from './session'
import type { DemoEnv } from './types'

function fakeStorage(entries: Record<string, string>): StorageLike & { dump: () => Record<string, string> } {
  const data = new Map(Object.entries(entries))
  return {
    get length() {
      return data.size
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
    dump: () => Object.fromEntries([...data.entries()].sort()),
  }
}

/** App giả: engine có lệnh mẫu, giá đã chạy vài nhịp, băng tick, cấu hình đã đổi, localStorage và store có dữ liệu. */
function userApp() {
  const engine = createOrderEngine()
  const seed = createSeedData(new Date(2026, 10, 12))
  engine.load(seed)
  const simulator = createMarketSimulator({ startDate: new Date(2026, 10, 12), random: () => 0.3 })
  simulator.subscribe((state) => engine.onMarketTick(state))
  for (let index = 0; index < 5; index += 1) simulator.tick()
  const tape = createMarketTape()
  tape.load(seed.tape ?? [])
  const config = createConfigStore({ now: () => '2026-11-12T10:00:00' })
  const storage = fakeStorage({ 'oms-auth': '{"user":"vanhanh"}', 'oms-sim-state-v1': '{"v":7}', 'other-app': 'giữ nguyên' })
  let notifications: unknown = { vanhanh: { items: [1, 2, 3], seen: ['a'] } }
  const store = { get: () => notifications, set: (value: unknown) => (notifications = value) }
  return { engine, simulator, tape, config, storage, store, getNotifications: () => notifications }
}

function fingerprint(app: ReturnType<typeof userApp>) {
  return JSON.stringify({
    engine: app.engine.exportState(),
    market: app.simulator.exportState(),
    tape: app.tape.exportState(),
    config: app.config.exportState(),
    storage: app.storage.dump(),
    notifications: app.getNotifications(),
    scripted: app.simulator.isScripted(),
  })
}

describe('cô lập dữ liệu khi chạy Demo', () => {
  afterEach(() => vi.restoreAllMocks())

  it('vào Demo, chạy kịch bản, thoát: mọi dữ liệu của người dùng giống hệt trước', () => {
    const app = userApp()
    const guard: boolean[] = []
    const session = createDemoSession({
      engine: app.engine,
      simulator: app.simulator,
      tape: app.tape,
      config: app.config,
      storage: () => app.storage,
      stores: [app.store],
      setGuard: (on) => guard.push(on),
    })
    const before = fingerprint(app)

    session.enter()
    expect(session.isActive()).toBe(true)
    const env: DemoEnv = { engine: app.engine, simulator: app.simulator, tape: app.tape, account: '058C999999', userId: 'demo' }
    createRunner({ scenario: SCENARIOS[4], env }).runToEnd()
    // Trong lúc Demo, dữ liệu đã đổi hẳn: sổ lệnh chỉ còn lệnh của kịch bản; app cũng ghi thêm vào storage, store.
    expect(app.engine.listOrders()).toHaveLength(1)
    app.storage.setItem('oms-notifications', '{"demo":true}')
    app.storage.setItem('oms-sim-state-v1', '{"demo":true}')
    app.store.set({ demo: true })

    session.exit()
    expect(session.isActive()).toBe(false)
    expect(fingerprint(app)).toBe(before)
    expect(guard).toEqual([true, false])
  })

  it('thoát trả random của engine về mặc định; vào lần hai khi đang Demo thì giữ bản lưu đầu', () => {
    const app = userApp()
    const session = createDemoSession({ engine: app.engine, simulator: app.simulator, tape: app.tape, defaultRandom: () => 0 })
    const spy = vi.spyOn(app.engine, 'setRandom')
    const before = JSON.stringify(app.engine.exportState())
    session.enter()
    app.engine.load({ ...createSeedData(new Date(2026, 10, 12)), orders: [] })
    session.enter()
    session.exit()
    expect(JSON.stringify(app.engine.exportState())).toBe(before)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('storage bị chặn (ném lỗi) thì vẫn vào, thoát được, phần còn lại vẫn khôi phục', () => {
    const app = userApp()
    const session = createDemoSession({
      engine: app.engine,
      simulator: app.simulator,
      tape: app.tape,
      storage: () => {
        throw new Error('Trình duyệt chặn localStorage')
      },
    })
    const before = JSON.stringify(app.engine.exportState())
    session.enter()
    app.engine.load({ ...createSeedData(new Date(2026, 10, 12)), orders: [] })
    expect(() => session.exit()).not.toThrow()
    expect(JSON.stringify(app.engine.exportState())).toBe(before)
  })
})

describe('runtime không ghi trạng thái giả lập khi đang Demo', () => {
  it('lúc rời trang (pagehide) đang Demo thì không ghi gì vào localStorage; hết Demo thì ghi lại bình thường', async () => {
    const written: string[] = []
    const listeners = new Map<string, () => void>()
    const storage = fakeStorage({})
    storage.setItem = (key) => {
      written.push(key)
    }
    vi.stubGlobal('window', {
      localStorage: storage,
      addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    })
    vi.resetModules()
    const { setDemoActive } = await import('@/mocks/demoGuard')
    await import('@/mocks/runtime')

    setDemoActive(true)
    listeners.get('pagehide')?.()
    expect(written).toEqual([])

    setDemoActive(false)
    listeners.get('pagehide')?.()
    expect(written).toContain('oms-sim-state-v1')
    vi.unstubAllGlobals()
  })
})
