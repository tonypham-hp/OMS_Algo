import { formatClock } from '@/lib/format'
import type { Execution, MarketTrade } from '@/types'
import { isDemoActive } from './demoGuard'
import { createOrderEngine } from './engine'
import { createMarketTape } from './marketTape'
import {
  clearConfigState,
  clearSimState,
  clearTapeState,
  loadConfigState,
  loadSimState,
  loadTapeState,
  saveConfigState,
  saveSimState,
  saveTapeState,
} from './persistence'
import { createSeedData } from './seedOrders'
import { marketSimulator } from './simulator'
import { createConfigStore } from './systemConfig'

/** Lưu định kỳ theo số nhịp, thêm một lần lúc rời trang, vì mỗi lần lưu phải ghi lại toàn bộ dữ liệu. */
const SAVE_EVERY_TICKS = 3

/** Cấu hình hệ thống dùng chung. Thời điểm ghi nhật ký theo đồng hồ giả lập, cùng cách ghi với OrderEvent. */
export const configStore = createConfigStore({
  now: () => {
    const state = marketSimulator.getState()
    return `${state.trading_date}T${formatClock(state.sim_seconds)}`
  },
})

/** Engine dùng chung của app: nhận từng nhịp giá từ bộ giả lập, đọc tham số từ cấu hình hệ thống. */
export const orderEngine = createOrderEngine({ config: configStore })

/** Băng tick khớp toàn thị trường cho báo cáo hiệu quả thực hiện (VWAP, tỷ lệ tham gia). */
export const marketTape = createMarketTape()

/** Số lần khớp của engine đã ghi vào băng tick. */
let recordedExecutions = 0

function toTrade(execution: Execution): MarketTrade {
  const symbol = orderEngine.getOrder(execution.parent_order_id).symbol
  return { symbol, time: execution.match_time, price: execution.price, qty: execution.qty }
}

/** Lần khớp mới của OMS cũng là KL khớp của thị trường, nên ghi vào băng để tỷ lệ tham gia không vượt 100%. */
function recordNewExecutions() {
  const executions = orderEngine.listExecutions()
  if (executions.length > recordedExecutions) {
    marketTape.record(executions.slice(recordedExecutions).map(toTrade))
  }
  recordedExecutions = executions.length
}

/**
 * Đặt lại mốc đếm lần khớp đã ghi vào băng tick. Gọi sau khi nạp lại toàn bộ trạng thái engine (vào, thoát Demo),
 * để không ghi lại các lần khớp cũ thành tick mới.
 */
export function resyncTapeCursor() {
  recordedExecutions = orderEngine.listExecutions().length
}

function loadSeed() {
  const seed = createSeedData(new Date())
  orderEngine.load(seed)
  marketTape.load(seed.tape ?? [])
  resyncTapeCursor()
}

function persist() {
  // Đang Demo: dữ liệu là của kịch bản, không được ghi đè dữ liệu đã lưu của người dùng.
  if (isDemoActive()) return
  const saved = saveSimState(marketSimulator.exportState(), orderEngine.exportState())
  const tapeSaved = saveTapeState(marketTape.exportState())
  if (!saved || !tapeSaved) console.warn('Không lưu được trạng thái giả lập vào localStorage')
}

/** Cấu hình ít đổi nhưng phải giữ chắc: lưu ngay sau mỗi thao tác. */
export function persistConfig() {
  if (isDemoActive()) return
  if (!saveConfigState(configStore.exportState())) console.warn('Không lưu được cấu hình hệ thống vào localStorage')
}

const savedConfig = loadConfigState()
if (savedConfig) configStore.importState(savedConfig)

const savedState = loadSimState()
if (savedState) {
  marketSimulator.importState(savedState.market)
  orderEngine.importState(savedState.engine)
  const savedTape = loadTapeState()
  if (savedTape) marketTape.importState(savedTape)
  else marketTape.load(createSeedData(new Date()).tape ?? [])
  recordedExecutions = orderEngine.listExecutions().length
} else {
  loadSeed()
}

marketSimulator.onTrades((trades) => marketTape.record(trades))

let ticksSinceSave = 0
marketSimulator.subscribe((state) => {
  orderEngine.onMarketTick(state)
  recordNewExecutions()
  ticksSinceSave += 1
  if (ticksSinceSave >= SAVE_EVERY_TICKS) {
    ticksSinceSave = 0
    persist()
  }
})

window.addEventListener('pagehide', persist)

/** Về đầu ngày: xóa dữ liệu đã lưu, nạp lại lệnh mẫu, cấu hình về mặc định, đồng hồ và giá về lúc mở app. */
export function resetDemoDay() {
  clearSimState()
  clearTapeState()
  clearConfigState()
  configStore.reset()
  loadSeed()
  marketSimulator.reset()
}
