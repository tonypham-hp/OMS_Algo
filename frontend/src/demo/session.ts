import type { EngineState, OrderEngine } from '@/mocks/engine'
import type { MarketTape, TapeState } from '@/mocks/marketTape'
import type { MarketSimulator, SimulatorState } from '@/mocks/simulator'

// Cô lập dữ liệu của Chế độ Demo: trước khi vào lưu nguyên trạng thái của app (engine, giá, băng tick,
// cấu hình, localStorage của app, store), lúc thoát nạp lại đúng như cũ. Kịch bản chạy gì cũng không đổi
// dữ liệu của người dùng.

/** Tiền tố khóa localStorage của app. */
export const APP_STORAGE_PREFIX = 'oms-'

export interface StorageLike {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Một store cần lưu lại (ví dụ thông báo): đọc và ghi toàn bộ state. */
export interface StoreHandle {
  get: () => unknown
  set: (value: unknown) => void
}

export interface DemoSessionDeps {
  engine: OrderEngine
  simulator: MarketSimulator
  tape: MarketTape
  config?: { exportState: () => unknown; importState: (state: never) => void }
  /** Lấy localStorage. Trả null hoặc ném lỗi thì bỏ qua phần này (trình duyệt chặn). */
  storage?: () => StorageLike | null
  stores?: StoreHandle[]
  /** Bật, tắt cờ "đang Demo" (chặn ghi trạng thái giả lập). */
  setGuard?: (on: boolean) => void
  /** Sau khi vào và sau khi thoát: đặt lại các mốc phụ thuộc dữ liệu engine, làm mới cache. */
  onSwap?: () => void
  /** Random của engine khi không Demo. Mặc định Math.random. */
  defaultRandom?: () => number
}

interface Snapshot {
  engine: string
  simulator: string
  tape: string
  config: string | null
  storage: Array<[string, string]> | null
  stores: string[]
}

function readStorage(deps: DemoSessionDeps): StorageLike | null {
  try {
    return deps.storage?.() ?? null
  } catch {
    return null
  }
}

function appEntries(storage: StorageLike): Array<[string, string]> {
  const entries: Array<[string, string]> = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key === null || !key.startsWith(APP_STORAGE_PREFIX)) continue
    const value = storage.getItem(key)
    if (value !== null) entries.push([key, value])
  }
  return entries
}

export function createDemoSession(deps: DemoSessionDeps) {
  let snapshot: Snapshot | null = null

  function takeSnapshot(): Snapshot {
    const storage = readStorage(deps)
    // Ghi ra chuỗi JSON: bản sao sâu, kịch bản sửa dữ liệu thế nào cũng không chạm vào bản lưu.
    return {
      engine: JSON.stringify(deps.engine.exportState()),
      simulator: JSON.stringify(deps.simulator.exportState()),
      tape: JSON.stringify(deps.tape.exportState()),
      config: deps.config ? JSON.stringify(deps.config.exportState()) : null,
      storage: storage ? appEntries(storage) : null,
      stores: (deps.stores ?? []).map((store) => JSON.stringify(store.get() ?? null)),
    }
  }

  function restore(saved: Snapshot) {
    deps.engine.importState(JSON.parse(saved.engine) as EngineState)
    deps.simulator.importState(JSON.parse(saved.simulator) as SimulatorState)
    deps.simulator.setScripted(false)
    deps.tape.importState(JSON.parse(saved.tape) as TapeState)
    if (deps.config && saved.config !== null) deps.config.importState(JSON.parse(saved.config) as never)
    // Store trước, localStorage sau: store có persist sẽ ghi vào localStorage, rồi được ghi đè bằng bản gốc.
    deps.stores?.forEach((store, index) => store.set(JSON.parse(saved.stores[index]) as unknown))
    const storage = readStorage(deps)
    if (storage && saved.storage) {
      const keep = new Map(saved.storage)
      for (const [key] of appEntries(storage)) if (!keep.has(key)) storage.removeItem(key)
      for (const [key, value] of saved.storage) storage.setItem(key, value)
    }
  }

  return {
    isActive: () => snapshot !== null,

    /** Lưu nguyên trạng thái app rồi bật cờ Demo. Gọi lại khi đang Demo thì giữ bản lưu đầu tiên. */
    enter() {
      if (snapshot) return
      snapshot = takeSnapshot()
      deps.setGuard?.(true)
      deps.onSwap?.()
    },

    /** Nạp lại đúng trạng thái lúc vào Demo, trả random về như cũ, tắt cờ. */
    exit() {
      if (!snapshot) return
      const saved = snapshot
      snapshot = null
      deps.engine.setRandom(deps.defaultRandom ?? Math.random)
      restore(saved)
      deps.setGuard?.(false)
      deps.onSwap?.()
    },
  }
}

export type DemoSession = ReturnType<typeof createDemoSession>
