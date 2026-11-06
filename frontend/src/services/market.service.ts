import { resetDemoDay } from '@/mocks/runtime'
import { marketSimulator } from '@/mocks/simulator'
import type { MarketState, SimSpeed } from '@/types'

// Hiện lấy giá từ bộ giả lập chạy trong trình duyệt. Khi có backend, chỉ cần đổi phần ruột
// của `subscribe` sang WebSocket; component và hook không phải sửa.
export const marketService = {
  subscribe(listener: (state: MarketState) => void) {
    const unsubscribe = marketSimulator.subscribe(listener)
    marketSimulator.start()
    return () => {
      unsubscribe()
      marketSimulator.stop()
    }
  },
  setSpeed: (speed: SimSpeed) => marketSimulator.setSpeed(speed),
  resetDay: () => resetDemoDay(),
  nextDay: () => marketSimulator.nextDay(),
}
