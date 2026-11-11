import type { EngineState } from './engine'
import type { TapeState } from './marketTape'
import type { SimulatorState } from './simulator'
import type { ConfigState } from './systemConfig'

// Đổi số phiên bản khi cấu trúc dữ liệu đổi, để dữ liệu cũ bị bỏ qua thay vì làm hỏng app.
export const SIM_STATE_KEY = 'oms-sim-state-v1'
// 7: lệnh mẫu có thêm lệnh đã hoàn tất ở các phiên trước, cho báo cáo hiệu quả thực hiện.
const SIM_STATE_VERSION = 7

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
    Array.isArray(saved.engine.pendingAcks) &&
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

// Cấu hình hệ thống lưu riêng, giống một bảng riêng ở backend: đổi cấu trúc sim state không làm mất cấu hình.
export const CONFIG_STATE_KEY = 'oms-config-state-v1'
const CONFIG_STATE_VERSION = 1

function isSavedConfigState(value: unknown): value is { version: number; config: ConfigState } {
  const saved = value as { version?: number; config?: ConfigState } | null
  return (
    saved?.version === CONFIG_STATE_VERSION &&
    typeof saved.config?.values === 'object' &&
    Array.isArray(saved.config.lastChanges) &&
    Array.isArray(saved.config.requests) &&
    typeof saved.config.requestSequence === 'number'
  )
}

export function loadConfigState(getStorage: GetStorage = getBrowserStorage): ConfigState | null {
  try {
    const raw = getStorage().getItem(CONFIG_STATE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return isSavedConfigState(parsed) ? parsed.config : null
  } catch {
    return null
  }
}

export function saveConfigState(config: ConfigState, getStorage: GetStorage = getBrowserStorage): boolean {
  try {
    getStorage().setItem(CONFIG_STATE_KEY, JSON.stringify({ version: CONFIG_STATE_VERSION, config }))
    return true
  } catch {
    return false
  }
}

export function clearConfigState(getStorage: GetStorage = getBrowserStorage): void {
  try {
    getStorage().removeItem(CONFIG_STATE_KEY)
  } catch {
    // Không xóa được thì thôi: lần lưu kế tiếp sẽ ghi đè.
  }
}

// Băng tick khớp thị trường lưu riêng: dữ liệu lớn, chỉ phục vụ báo cáo. Đọc lỗi thì chỉ mất VWAP và tỷ lệ tham gia.
export const TAPE_STATE_KEY = 'oms-market-tape-v1'
const TAPE_STATE_VERSION = 1

export function loadTapeState(getStorage: GetStorage = getBrowserStorage): TapeState | null {
  try {
    const raw = getStorage().getItem(TAPE_STATE_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as { version?: number; tape?: TapeState } | null
    return parsed?.version === TAPE_STATE_VERSION && Array.isArray(parsed.tape?.trades) ? parsed.tape : null
  } catch {
    return null
  }
}

export function saveTapeState(tape: TapeState, getStorage: GetStorage = getBrowserStorage): boolean {
  try {
    getStorage().setItem(TAPE_STATE_KEY, JSON.stringify({ version: TAPE_STATE_VERSION, tape }))
    return true
  } catch {
    return false
  }
}

export function clearTapeState(getStorage: GetStorage = getBrowserStorage): void {
  try {
    getStorage().removeItem(TAPE_STATE_KEY)
  } catch {
    // Không xóa được thì thôi: lần lưu kế tiếp sẽ ghi đè.
  }
}
