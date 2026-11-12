import { useDemoRunner } from '@/demo/useDemoRunner'
import { ChecksPanel } from './ChecksPanel'
import { DemoController } from './DemoController'
import { DemoHighlight } from './DemoHighlight'
import { ScenarioPicker } from './ScenarioPicker'

/**
 * Toàn bộ phần chạy của Chế độ Demo (runner, kịch bản, khung điều khiển, bảng điều kiện, tô sáng).
 * Layout nạp chậm (lazy) file này và chỉ khi vai trò được dùng Demo, nên người dùng khác không tải phần này.
 */
export default function DemoLayer() {
  useDemoRunner()
  return (
    <>
      <ScenarioPicker />
      <DemoController />
      <DemoHighlight />
      <ChecksPanel />
    </>
  )
}
