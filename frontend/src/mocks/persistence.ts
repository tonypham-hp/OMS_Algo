import type { EngineState } from './engine'
import type { SimulatorState } from './simulator'

// Đổi số phiên bản khi cấu trúc dữ liệu đổi, để dữ liệu cũ bị bỏ qua thay vì làm hỏng app.
export const SIM_STATE_KEY = 'oms-sim-state-v1'
const SIM_STATE_VERSION = 5

export interface SavedSimState {
  version: number
  market: SimulatorState
  engine: EngineState
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type GetStorage = () => StorageLike

// Bản thân việc truy cập localStorage cũng có thể lỗi (trình duyệt chặn), nên lấy qua hàm trong try/catch.
const getBrowserStorage: GetStorage = () => window.localStorage

function isSavedSimState(value: unknown): value is SavedSimState {
  const saved = value as SavedSimState | null
  return (
    saved?.version === SIM_STATE_VERSION &&
    typeof saved.market?.trading_date === 'string' &&
    typeof saved.market.sim_seconds === 'number' &&
    Array.isArray(saved.market.quotes) &&
    Array.isArray(saved.engine?.parents) &&
    Array.isArray(saved.engine.children) &&
    Array.isArray(saved.engine.conditions) &&
    Array.isArray(saved.engine.executions) &&
    Array.isArray(saved.engine.events) &&
    Array.isArray(saved.engine.notifications) &&
    Array.isArray(saved.engine.parameters) &&
    Array.isArray(saved.engine.snapshots) &&
    Array.isArray(saved.engine.runtimes) &&
    Array.isArray(saved.engine.seenMatchIds) &&
    Array.isArray(saved.engine.pendingFaults) &&
    Array.isArray(saved.engine.pendingRecoveries) &&
    Array.isArray(saved.engine.killSwitch?.accounts)
  )
}

/** Đọc trạng thái đã lưu. Không có, hỏng hoặc không đọc được thì trả về null để nạp dữ liệu mẫu. */
export function loadSimState(getStorage: GetStorage = getBrowserStorage): SavedSimState | null {
  try {
    const raw = getStorage().getItem(SIM_STATE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return isSavedSimState(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** Lưu trạng thái. Trả về false nếu không lưu được, ví dụ hết dung lượng: app vẫn chạy bình thường. */
export function saveSimState(
  market: SimulatorState,
  engine: EngineState,
  getStorage: GetStorage = getBrowserStorage,
): boolean {
  try {
    const saved: SavedSimState = { version: SIM_STATE_VERSION, market, engine }
    getStorage().setItem(SIM_STATE_KEY, JSON.stringify(saved))
    return true
  } catch {
    return false
  }
}

export function clearSimState(getStorage: GetStorage = getBrowserStorage): void {
  try {
    getStorage().removeItem(SIM_STATE_KEY)
  } catch {
    // Không xóa được thì thôi: lần lưu kế tiếp sẽ ghi đè dữ liệu cũ.
  }
}
