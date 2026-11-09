import type { StrategyType } from './order'

export type SystemParameterCode =
  | 'MAX_CONSECUTIVE_REJECTS'
  | 'MAX_DATA_DELAY_SECONDS'
  | 'ACK_TIMEOUT_SECONDS'
  | 'POV_MAX_PARTICIPATION_PCT'
  | 'ICEBERG_MIN_SLICE'
  | 'ICEBERG_MAX_SLICE'
  | 'ENABLED_STRATEGIES'

export type SystemParameterDataType = 'INTEGER' | 'STRATEGY_LIST'

/** ENGINE: áp ngay cho quyết định mới của engine. ORDER_ENTRY: áp cho lệnh mới và lần sửa lệnh mới. */
export type SystemParameterScope = 'ENGINE' | 'ORDER_ENTRY'

/** Giá trị của tham số: số nguyên, hoặc danh sách loại lệnh. */
export type SystemParameterValue = number | StrategyType[]

export interface SystemParameterValues {
  MAX_CONSECUTIVE_REJECTS: number
  MAX_DATA_DELAY_SECONDS: number
  ACK_TIMEOUT_SECONDS: number
  POV_MAX_PARTICIPATION_PCT: number
  ICEBERG_MIN_SLICE: number
  ICEBERG_MAX_SLICE: number
  ENABLED_STRATEGIES: StrategyType[]
}

export interface SystemParameter {
  parameter_code: SystemParameterCode
  label: string
  description: string
  data_type: SystemParameterDataType
  scope: SystemParameterScope
  unit: string | null
  min: number | null
  max: number | null
  /** Giá trị phải là bội số của số này. */
  step: number | null
  value: SystemParameterValue
  default_value: SystemParameterValue
  /** Người tạo yêu cầu của lần đổi gần nhất. null khi vẫn là giá trị mặc định. */
  updated_by: string | null
  approved_by: string | null
  updated_at: string | null
  pending_request: ParameterChangeRequest | null
}

export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface ParameterChangeRequest {
  request_id: string
  parameter_code: SystemParameterCode
  /** Giá trị lúc tạo yêu cầu; khi duyệt ghi lại đúng giá trị bị thay. */
  old_value: SystemParameterValue
  new_value: SystemParameterValue
  reason: string
  maker: string
  checker: string | null
  note: string | null
  status: ChangeRequestStatus
  created_at: string
  decided_at: string | null
}

export interface CreateChangeRequest {
  parameter_code: SystemParameterCode
  new_value: SystemParameterValue
  reason: string
}

export interface DecideChangeRequest {
  note: string
}

export interface ChangeRequestFilter {
  parameter_code?: SystemParameterCode
  /** Khớp người tạo hoặc người duyệt. */
  user?: string
  status?: ChangeRequestStatus
}

/** Luật đặt lệnh lấy từ cấu hình, dùng chung cho form và API. */
export interface OrderRules {
  enabledStrategies: StrategyType[]
  povMaxPct: number
  icebergMinSlice: number
  icebergMaxSlice: number
}
