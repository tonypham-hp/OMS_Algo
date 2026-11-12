import { queryClient } from '@/lib/queryClient'
import { setDemoActive } from '@/mocks/demoGuard'
import { configStore, marketTape, orderEngine, resyncTapeCursor } from '@/mocks/runtime'
import { marketSimulator } from '@/mocks/simulator'
import { useAuthStore } from '@/store/auth.store'
import { useDemoStore } from '@/store/demo.store'
import { useNotificationStore } from '@/store/notification.store'
import { createRunner, type DemoRunner, type RunnerSnapshot } from './runner'
import { getScenario } from './scenarios'
import { createDemoSession } from './session'
import type { DemoEnv } from './types'

// Nối bộ chạy kịch bản vào app: dùng engine, bộ giả lập, băng tick của app (giao diện thấy đúng dữ liệu Demo),
// nhưng bọc trong một phiên cô lập để lúc thoát mọi thứ trở về như cũ.

const session = createDemoSession({
  engine: orderEngine,
  simulator: marketSimulator,
  tape: marketTape,
  config: configStore,
  storage: () => window.localStorage,
  stores: [
    {
      get: () => useNotificationStore.getState().feeds,
      set: (feeds) => useNotificationStore.setState({ feeds: feeds as ReturnType<typeof useNotificationStore.getState>['feeds'] }),
    },
  ],
  setGuard: setDemoActive,
  onSwap: () => {
    resyncTapeCursor()
    void queryClient.invalidateQueries()
  },
})

let runner: DemoRunner | null = null
let navigate: ((path: string) => void) | null = null
/** Trang người dùng đang xem lúc vào Demo, để thoát thì quay lại. */
let returnPath = '/trung-tam'

function onChange(snapshot: RunnerSnapshot) {
  useDemoStore.setState({
    snapshot,
    result: snapshot.status === 'finished' && runner ? runner.getResult() : null,
  })
  // Dữ liệu vừa đổi theo bước của kịch bản: làm mới ngay, không chờ nhịp refetch 1 giây.
  void queryClient.invalidateQueries()
}

function createEnv(): DemoEnv {
  const user = useAuthStore.getState().user
  return {
    engine: orderEngine,
    simulator: marketSimulator,
    tape: marketTape,
    account: user?.accounts[0] ?? '058C999999',
    userId: user?.username ?? 'demo',
  }
}

export const demoController = {
  /** Gắn hàm điều hướng của router (gọi từ hook trong layout). */
  setNavigate(next: ((path: string) => void) | null) {
    navigate = next
  },

  getRunner: () => runner,

  /** Bắt đầu (hoặc đổi sang) một kịch bản. Lần đầu vào Demo thì lưu nguyên dữ liệu của app. */
  start(scenarioId: string, currentPath: string) {
    const scenario = getScenario(scenarioId)
    if (!scenario) return
    if (!session.isActive()) {
      returnPath = currentPath
      session.enter()
    }
    runner = createRunner({ scenario, env: createEnv(), navigate: (path) => navigate?.(path), onChange })
    useDemoStore.setState({
      pickerOpen: false,
      scenarioNumber: scenario.number,
      scenarioTitle: scenario.title,
      result: null,
      snapshot: runner.getSnapshot(),
    })
    navigate?.('/so-lenh')
    runner.play()
  },

  /** Thoát Demo: khôi phục nguyên dữ liệu, về trang lúc vào. */
  exit() {
    if (!session.isActive()) return
    runner = null
    session.exit()
    useDemoStore.setState({ snapshot: null, result: null, scenarioNumber: null, scenarioTitle: null, pickerOpen: false })
    navigate?.(returnPath)
  },

  isActive: () => session.isActive(),
}
