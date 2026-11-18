/** Giá trị `?tab=` của từng tab màn Lịch sử và đối soát. */
export const HISTORY_TABS = { history: 'lich-su', audit: 'nhat-ky', recon: 'doi-soat' } as const

export type HistoryTabValue = (typeof HISTORY_TABS)[keyof typeof HISTORY_TABS]

/** Tab trên URL. Giá trị lạ, hoặc tab Đối soát khi không có quyền, thì về Lịch sử lệnh. */
export function resolveTab(requested: string | null, canReconcile: boolean): HistoryTabValue {
  if (requested === HISTORY_TABS.audit) return requested
  if (requested === HISTORY_TABS.recon && canReconcile) return requested
  return HISTORY_TABS.history
}
