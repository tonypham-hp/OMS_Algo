import { create } from 'zustand'
import type { DemoResult, RunnerSnapshot } from '@/demo/runner'

export interface ControllerPosition {
  x: number
  y: number
}

interface DemoStoreState {
  /** Hộp chọn kịch bản đang mở. */
  pickerOpen: boolean
  /** Snapshot của runner đang chạy; null khi không ở Chế độ Demo. */
  snapshot: RunnerSnapshot | null
  /** Số thứ tự kịch bản đang chạy (Scenario n). */
  scenarioNumber: number | null
  scenarioTitle: string | null
  /** Kết quả khi kịch bản chạy xong; hộp kết quả hiện khi khác null. */
  result: DemoResult | null
  checksOpen: boolean
  /** Vị trí khung điều khiển sau khi kéo; null là giữa đáy màn hình. */
  position: ControllerPosition | null
  setPickerOpen: (open: boolean) => void
  setChecksOpen: (open: boolean) => void
  setPosition: (position: ControllerPosition | null) => void
}

/** Trạng thái giao diện của Chế độ Demo. Không lưu vào localStorage: tải lại trang là thoát Demo. */
export const useDemoStore = create<DemoStoreState>()((set) => ({
  pickerOpen: false,
  snapshot: null,
  scenarioNumber: null,
  scenarioTitle: null,
  result: null,
  checksOpen: true,
  position: null,
  setPickerOpen: (pickerOpen) => set({ pickerOpen }),
  setChecksOpen: (checksOpen) => set({ checksOpen }),
  setPosition: (position) => set({ position }),
}))
