import { createOrderEngine } from './engine'
import { clearSimState, loadSimState, saveSimState } from './persistence'
import { createSeedData } from './seedOrders'
import { marketSimulator } from './simulator'

/** Lưu định kỳ theo số nhịp, thêm một lần lúc rời trang, vì mỗi lần lưu phải ghi lại toàn bộ dữ liệu. */
const SAVE_EVERY_TICKS = 3

/** Engine dùng chung của app: nhận từng nhịp giá từ bộ giả lập. */
export const orderEngine = createOrderEngine()

function persist() {
  const saved = saveSimState(marketSimulator.exportState(), orderEngine.exportState())
  if (!saved) console.warn('Không lưu được trạng thái giả lập vào localStorage')
}

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

/** Về đầu ngày: xóa dữ liệu đã lưu, nạp lại lệnh mẫu, đồng hồ và giá về lúc mở app. */
export function resetDemoDay() {
  clearSimState()
  orderEngine.load(createSeedData(new Date()))
  marketSimulator.reset()
}
