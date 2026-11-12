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

/** Chạy `fn` sau khi màn vừa điều hướng tới đã vẽ xong (hai khung hình), để màn cũ không gọi API với dữ liệu đã đổi. */
function afterRender(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn))
}

/** Số khung hình tối đa chờ màn mới thay màn cũ (khoảng 1 giây). */
const MAX_WAIT_FRAMES = 60

/**
 * Mở Sổ lệnh trước, đổi dữ liệu sau. Dùng khi nạp lại toàn bộ dữ liệu (bắt đầu, làm lại, thoát):
 * nếu còn đứng ở chi tiết của một lệnh sắp biến mất, màn đó sẽ gọi API và nhận 404.
 * Router điều hướng trong transition nên phải chờ tới khi màn mới thật sự đã vẽ (committedPath).
 */
function leaveDetailThen(path: string, fn: () => void) {
  navigate?.(path)
  let frames = 0
  const wait = () => {
    frames += 1
    if (useDemoStore.getState().committedPath === path || frames >= MAX_WAIT_FRAMES) afterRender(fn)
    else requestAnimationFrame(wait)
  }
  requestAnimationFrame(wait)
}

function onChange(snapshot: RunnerSnapshot) {
  useDemoStore.setState({
    snapshot,
    result: snapshot.status === 'finished' && runner ? runner.getResult() : null,
  })
  // Dữ liệu vừa đổi theo bước của kịch bản: làm mới ngay (sau khi màn của bước đã mở), không chờ nhịp refetch 1 giây.
  afterRender(() => void queryClient.invalidateQueries())
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
    if (!session.isActive()) returnPath = currentPath
    // Đổi số, tên kịch bản ngay khi chọn: nhãn trên thanh trên không hiện số của kịch bản cũ trong lúc chờ chuyển màn.
    useDemoStore.setState({ pickerOpen: false, result: null, scenarioNumber: scenario.number, scenarioTitle: scenario.title })
    leaveDetailThen('/so-lenh', () => {
      if (!session.isActive()) session.enter()
      runner = createRunner({ scenario, env: createEnv(), navigate: (path) => navigate?.(path), onChange })
      useDemoStore.setState({ snapshot: runner.getSnapshot() })
      runner.play()
    })
  },

  /** Làm lại kịch bản đang chạy từ đầu. `play` = phát luôn (nút Chạy lại ở hộp kết quả). */
  restart(play = false) {
    const current = runner
    if (!current) return
    useDemoStore.setState({ result: null })
    leaveDetailThen('/so-lenh', () => {
      current.reset()
      if (play) current.play()
    })
  },

  /** Thoát Demo: về trang lúc vào rồi khôi phục nguyên dữ liệu. */
  exit() {
    if (!session.isActive()) return
    runner = null
    useDemoStore.setState({ snapshot: null, result: null, scenarioNumber: null, scenarioTitle: null, pickerOpen: false })
    // Qua Sổ lệnh rồi mới khôi phục: trang lúc vào có thể là chi tiết một lệnh không có trong dữ liệu Demo, và ngược lại.
    leaveDetailThen('/so-lenh', () => {
      session.exit()
      navigate?.(returnPath)
    })
  },

  isActive: () => session.isActive(),
}
