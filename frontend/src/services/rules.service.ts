import type { Board, RulePack } from '@/rules/types'
import { http } from './http'

/** Danh sách gói luật cho trang Luật giao dịch (chỉ đọc). */
export interface RulePacksResponse {
  trading_date: string
  packs: RulePack[]
  /** Pack đang áp dụng theo bảng giao dịch, cho ngày mô phỏng hiện tại. */
  active: Partial<Record<Board, string>>
  /** Pack thử nghiệm đang nạp, null là không có. */
  experimental_id: string | null
}

export const rulesService = {
  getPacks: () => http.get<RulePacksResponse>('/api/rules'),
  /** Nạp hoặc bỏ (null) pack thử nghiệm. */
  setExperimental: (packId: string | null) =>
    http.post<RulePacksResponse>('/api/rules/experimental', { pack_id: packId }),
}
