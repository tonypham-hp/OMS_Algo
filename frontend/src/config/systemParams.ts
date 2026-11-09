import { MAX_ORDER_QTY, QTY_LOT_SIZE } from '@/config/hose'
import { STRATEGIES, STRATEGY_TYPES } from '@/config/strategies'
import { formatNumber } from '@/lib/format'
import type {
  ChangeRequestStatus,
  ParameterChangeRequest,
  OrderRules,
  StrategyType,
  SystemParameterCode,
  SystemParameterDataType,
  SystemParameterScope,
  SystemParameterValue,
  SystemParameterValues,
} from '@/types'

export interface SystemParameterDefinition {
  code: SystemParameterCode
  label: string
  description: string
  data_type: SystemParameterDataType
  scope: SystemParameterScope
  unit: string | null
  min: number | null
  max: number | null
  step: number | null
}

/** Nguồn duy nhất của tham số hệ thống: engine, form đặt lệnh, API và màn cấu hình đều đọc từ đây. */
export const SYSTEM_PARAMETERS: readonly SystemParameterDefinition[] = [
  {
    code: 'MAX_CONSECUTIVE_REJECTS',
    label: 'Số lần Core từ chối liên tiếp tối đa',
    description: 'Core từ chối liên tiếp từng này lệnh con của một lệnh cha thì hệ thống tạm dừng lệnh cha (PAUSED_SYSTEM).',
    data_type: 'INTEGER',
    scope: 'ENGINE',
    unit: 'lần',
    min: 1,
    max: 10,
    step: null,
  },
  {
    code: 'MAX_DATA_DELAY_SECONDS',
    label: 'Độ trễ dữ liệu giá tối đa',
    description: 'Không có giá mới quá từng này giây thật thì coi là dữ liệu giá trễ: lệnh đang chạy bị tạm dừng, không phụ thuộc tốc độ tua.',
    data_type: 'INTEGER',
    scope: 'ENGINE',
    unit: 'giây',
    min: 1,
    max: 60,
    step: null,
  },
  {
    code: 'ACK_TIMEOUT_SECONDS',
    label: 'Thời gian chờ ACK từ Core',
    description: 'Lệnh con đã gửi mà chưa có phản hồi từ Core sau từng này giây thì chuyển UNKNOWN và chờ đối soát.',
    data_type: 'INTEGER',
    scope: 'ENGINE',
    unit: 'giây',
    min: 1,
    max: 60,
    step: null,
  },
  {
    code: 'POV_MAX_PARTICIPATION_PCT',
    label: 'Tỷ lệ tham gia tối đa của POV',
    description: 'Trần cho tỷ lệ tham gia và tỷ lệ tối đa khi đặt lệnh POV. Lệnh đang chạy giữ tham số lúc đặt.',
    data_type: 'INTEGER',
    scope: 'ORDER_ENTRY',
    unit: '%',
    min: 1,
    max: 100,
    step: null,
  },
  {
    code: 'ICEBERG_MIN_SLICE',
    label: 'KL mỗi phần Iceberg tối thiểu',
    description: 'KL mỗi phần nhỏ nhất được phép khi đặt lệnh Iceberg. Lệnh đang chạy giữ tham số lúc đặt.',
    data_type: 'INTEGER',
    scope: 'ORDER_ENTRY',
    unit: 'CP',
    min: QTY_LOT_SIZE,
    max: MAX_ORDER_QTY,
    step: QTY_LOT_SIZE,
  },
  {
    code: 'ICEBERG_MAX_SLICE',
    label: 'KL mỗi phần Iceberg tối đa',
    description: 'KL mỗi phần lớn nhất được phép khi đặt lệnh Iceberg. Lệnh đang chạy giữ tham số lúc đặt.',
    data_type: 'INTEGER',
    scope: 'ORDER_ENTRY',
    unit: 'CP',
    min: QTY_LOT_SIZE,
    max: MAX_ORDER_QTY,
    step: QTY_LOT_SIZE,
  },
  {
    code: 'ENABLED_STRATEGIES',
    label: 'Loại lệnh được bật',
    description: 'Chỉ các loại lệnh này được đặt mới. Tắt một loại không dừng các lệnh đang chạy của loại đó.',
    data_type: 'STRATEGY_LIST',
    scope: 'ORDER_ENTRY',
    unit: null,
    min: 1,
    max: null,
    step: null,
  },
]

export const SYSTEM_PARAM_DEFAULTS: Readonly<SystemParameterValues> = {
  MAX_CONSECUTIVE_REJECTS: 2,
  MAX_DATA_DELAY_SECONDS: 5,
  ACK_TIMEOUT_SECONDS: 3,
  POV_MAX_PARTICIPATION_PCT: 50,
  ICEBERG_MIN_SLICE: QTY_LOT_SIZE,
  ICEBERG_MAX_SLICE: MAX_ORDER_QTY,
  ENABLED_STRATEGIES: [...STRATEGY_TYPES],
}

export function getParameterDefinition(code: SystemParameterCode): SystemParameterDefinition {
  const definition = SYSTEM_PARAMETERS.find((item) => item.code === code)
  if (!definition) throw new Error(`Không có tham số ${code}`)
  return definition
}

export const DEFAULT_ORDER_RULES: Readonly<OrderRules> = toOrderRules(SYSTEM_PARAM_DEFAULTS)

export function toOrderRules(values: SystemParameterValues): OrderRules {
  return {
    enabledStrategies: [...values.ENABLED_STRATEGIES],
    povMaxPct: values.POV_MAX_PARTICIPATION_PCT,
    icebergMinSlice: values.ICEBERG_MIN_SLICE,
    icebergMaxSlice: values.ICEBERG_MAX_SLICE,
  }
}

function isStrategyList(value: SystemParameterValue): value is StrategyType[] {
  return Array.isArray(value)
}

export function isSameValue(a: SystemParameterValue, b: SystemParameterValue): boolean {
  if (isStrategyList(a) && isStrategyList(b)) {
    return a.length === b.length && a.every((item) => b.includes(item))
  }
  return a === b
}

/** Hiển thị giá trị theo kiểu tham số: số kiểu Việt Nam kèm đơn vị, hoặc tên các loại lệnh. */
export function formatParameterValue(code: SystemParameterCode, value: SystemParameterValue): string {
  if (isStrategyList(value)) {
    if (value.length === STRATEGY_TYPES.length) return 'Tất cả loại lệnh'
    return STRATEGY_TYPES.filter((type) => value.includes(type))
      .map((type) => STRATEGIES[type].label)
      .join(', ')
  }
  const unit = getParameterDefinition(code).unit
  return unit ? `${formatNumber(value)} ${unit}` : formatNumber(value)
}

/** Giới hạn hiển thị ở màn cấu hình, ví dụ "1 – 10 lần" hoặc "Ít nhất 1 loại". */
export function formatParameterLimit(definition: SystemParameterDefinition): string {
  if (definition.data_type === 'STRATEGY_LIST') return `Ít nhất ${definition.min ?? 1} loại`
  const unit = definition.unit ? ` ${definition.unit}` : ''
  const range = `${formatNumber(definition.min ?? 0)} – ${formatNumber(definition.max ?? 0)}${unit}`
  return definition.step ? `${range}, bội số ${formatNumber(definition.step)}` : range
}

/**
 * Kiểm tra giá trị mới của một tham số, gồm cả ràng buộc với tham số khác (min ≤ max của slice Iceberg).
 * `current` là giá trị đang áp dụng của mọi tham số. Trả về null nếu hợp lệ.
 */
export function validateParameterValue(
  code: SystemParameterCode,
  value: unknown,
  current: SystemParameterValues,
): string | null {
  const definition = getParameterDefinition(code)

  if (definition.data_type === 'STRATEGY_LIST') {
    if (!Array.isArray(value) || value.some((item) => !STRATEGY_TYPES.includes(item as StrategyType))) {
      return 'Danh sách loại lệnh không hợp lệ'
    }
    if (new Set(value).size !== value.length) return 'Danh sách loại lệnh bị trùng'
    if (value.length < (definition.min ?? 1)) return 'Phải bật ít nhất một loại lệnh'
    return null
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) return 'Giá trị phải là số nguyên'
  const unit = definition.unit ? ` ${definition.unit}` : ''
  if (definition.min !== null && value < definition.min) {
    return `Giá trị nhỏ nhất là ${formatNumber(definition.min)}${unit}`
  }
  if (definition.max !== null && value > definition.max) {
    return `Giá trị lớn nhất là ${formatNumber(definition.max)}${unit}`
  }
  if (definition.step !== null && value % definition.step !== 0) {
    return `Giá trị phải là bội số của ${formatNumber(definition.step)}`
  }
  if (code === 'ICEBERG_MIN_SLICE' && value > current.ICEBERG_MAX_SLICE) {
    return `Không được lớn hơn KL mỗi phần tối đa đang áp dụng (${formatNumber(current.ICEBERG_MAX_SLICE)} CP)`
  }
  if (code === 'ICEBERG_MAX_SLICE' && value < current.ICEBERG_MIN_SLICE) {
    return `Không được nhỏ hơn KL mỗi phần tối thiểu đang áp dụng (${formatNumber(current.ICEBERG_MIN_SLICE)} CP)`
  }
  return null
}

/** Ai được Duyệt / Từ chối: yêu cầu còn chờ và người xem không phải người tạo. Màn cấu hình và API dùng chung luật này. */
export function canDecideRequest(request: Pick<ParameterChangeRequest, 'status' | 'maker'>, username: string | undefined) {
  return request.status === 'PENDING' && username !== undefined && request.maker !== username
}

export const CHANGE_STATUS_STYLES: Record<ChangeRequestStatus, { label: string; className: string }> = {
  PENDING: { label: 'Chờ duyệt', className: 'bg-amber-500/20 text-amber-300' },
  APPROVED: { label: 'Đã duyệt', className: 'bg-green-500/20 text-green-300' },
  REJECTED: { label: 'Từ chối', className: 'bg-red-500/20 text-red-300' },
}

export const DATA_TYPE_LABELS: Record<SystemParameterDataType, string> = {
  INTEGER: 'Số nguyên',
  STRATEGY_LIST: 'Danh sách loại lệnh',
}

export const SCOPE_LABELS: Record<SystemParameterScope, string> = {
  ENGINE: 'Áp ngay cho quyết định mới',
  ORDER_ENTRY: 'Áp cho lệnh đặt mới',
}
