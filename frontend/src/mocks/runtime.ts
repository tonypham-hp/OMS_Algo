import { createOrderEngine } from './engine'
import { createSeedData } from './seedOrders'
import { marketSimulator } from './simulator'

/** Engine dùng chung của app: nhận từng nhịp giá từ bộ giả lập. */
export const orderEngine = createOrderEngine()

orderEngine.load(createSeedData(new Date()))
marketSimulator.subscribe(orderEngine.onMarketTick)

/** Về đầu ngày: nạp lại lệnh mẫu, bỏ lệnh đã đặt, đồng hồ và giá về lúc mở app. */
export function resetDemoDay() {
  orderEngine.load(createSeedData(new Date()))
  marketSimulator.reset()
}
