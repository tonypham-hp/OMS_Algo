import { formatClock } from '@/lib/format'
import { createOrderEngine } from './engine'
import {
  clearConfigState,
  clearSimState,
  loadConfigState,
  loadSimState,
  saveConfigState,
  saveSimState,
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

function persist() {
  const saved = saveSimState(marketSimulator.exportState(), orderEngine.exportState())
  if (!saved) console.warn('Không lưu được trạng thái giả lập vào localStorage')
}

/** Cấu hình ít đổi nhưng phải giữ chắc: lưu ngay sau mỗi thao tác. */
export function persistConfig() {
  if (!saveConfigState(configStore.exportState())) console.warn('Không lưu được cấu hình hệ thống vào localStorage')
}

const savedConfig = loadConfigState()
if (savedConfig) configStore.importState(savedConfig)

const savedState = loadSimState()
if (savedState) {
  marketSimulator.importState(savedState.market)
  orderEngine.importState(savedState.engine)
} else {
  orderEngine.load(createSeedData(new Date()))
}

let ticksSinceSave = 0
marketSimulator.subscribe((state) => {
  orderEngine.onMarketTick(state)
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
  clearConfigState()
  configStore.reset()
  orderEngine.load(createSeedData(new Date()))
  marketSimulator.reset()
}
