import { formatNumber } from '@/lib/format'
import type { PersistenceMode, Side, StrategyType } from '@/types'

export const SIDE_LABELS: Record<Side, string> = { BUY: 'Mua', SELL: 'Bán' }

export const PERSISTENCE_LABELS: Record<PersistenceMode, string> = {
  DAY: 'Trong ngày',
  GTD: 'Đến ngày chỉ định (GTD)',
  MULTI_SESSION: 'Nhiều phiên',
}

export type StrategyFieldName =
  | 'limit_price'
  | 'trigger_price'
  | 'trailing_value'
  | 'tp_price'
  | 'sl_price'
  | 'slice_qty'
  | 'start_time'
  | 'end_time'
  | 'interval_min'
  | 'participation_pct'
  | 'max_pct'
  | 'hunt_price'
  | 'max_wait_min'
  | 'max_levels'
  | 'remainder_passive'

export type StrategyFieldKind = 'price' | 'money' | 'qty' | 'number' | 'time' | 'select'

export interface StrategyField {
  name: StrategyFieldName
  label: string
  kind: StrategyFieldKind
  unit?: string
  min?: number
  max?: number
  /** Ô không bắt buộc: để trống thì không gửi tham số này. */
  optional?: boolean
  /** Gợi ý ngắn dưới ô. */
  hint?: string
  /** Chỉ cho kind = 'select': các giá trị (số nguyên) được chọn. */
  options?: Array<{ value: number; label: string }>
}

/** Số mức tối đa HUNT được quét: bằng số mức sổ lệnh hiển thị. */
export const HUNT_MAX_LEVELS = 3

/** Cách xử lý phần còn lại sau khi HUNT quét: 1 = chờ (LO bị động), 0 = hủy. */
export const REMAINDER_OPTIONS = [
  { value: 1, label: 'Chờ ở giá tốt nhất' },
  { value: 0, label: 'Hủy phần còn lại' },
]

const LIMIT_PRICE: StrategyField = { name: 'limit_price', label: 'Giá giới hạn', kind: 'price', unit: 'đ' }
const TRIGGER_PRICE: StrategyField = { name: 'trigger_price', label: 'Giá kích hoạt', kind: 'price', unit: 'đ' }
const TP_PRICE: StrategyField = { name: 'tp_price', label: 'Giá chốt lời (TP)', kind: 'price', unit: 'đ' }
const SL_PRICE: StrategyField = { name: 'sl_price', label: 'Giá cắt lỗ (SL)', kind: 'price', unit: 'đ' }
const START_TIME: StrategyField = { name: 'start_time', label: 'Bắt đầu', kind: 'time' }
const END_TIME: StrategyField = { name: 'end_time', label: 'Kết thúc', kind: 'time' }

export interface StrategyConfig {
  label: string
  description: string
  fields: StrategyField[]
  /**
   * Khi kích hoạt có thể sinh lệnh con MTL (Stop, Trailing Stop, và nhánh cắt lỗ của OCO, Bracket).
   * Đặt ngoài phiên liên tục chỉ cảnh báo, không chặn, vì lệnh cha mới ở trạng thái chờ.
   */
  usesMtl: boolean
}

// Khai báo tham số ở một chỗ: form, kiểm tra và hộp xác nhận đều đọc từ bảng này.
export const STRATEGIES: Record<StrategyType, StrategyConfig> = {
  STOP: {
    label: 'Stop',
    description: 'Giá chạm mức kích hoạt thì gửi lệnh thị trường.',
    fields: [TRIGGER_PRICE],
    usesMtl: true,
  },
  STOP_LIMIT: {
    label: 'Stop Limit',
    description: 'Giá chạm mức kích hoạt thì gửi lệnh giới hạn.',
    fields: [TRIGGER_PRICE, LIMIT_PRICE],
    usesMtl: false,
  },
  TAKE_PROFIT: {
    label: 'Take Profit',
    description: 'Giá đạt mức chốt lời thì gửi lệnh giới hạn.',
    fields: [TRIGGER_PRICE, LIMIT_PRICE],
    usesMtl: false,
  },
  TRAILING_STOP: {
    label: 'Trailing Stop',
    description: 'Giá kích hoạt bám theo thị trường với một khoảng cách cố định.',
    fields: [{ name: 'trailing_value', label: 'Khoảng trượt', kind: 'money', unit: 'đ' }],
    usesMtl: true,
  },
  OCO: {
    label: 'OCO',
    description: 'Một cặp chốt lời và cắt lỗ: một bên kích hoạt thì bên kia bị hủy.',
    fields: [TP_PRICE, SL_PRICE],
    usesMtl: true,
  },
  BRACKET: {
    label: 'Bracket',
    description: 'Lệnh vào kèm sẵn cặp chốt lời và cắt lỗ.',
    fields: [{ ...LIMIT_PRICE, label: 'Giá vào lệnh' }, TP_PRICE, SL_PRICE],
    usesMtl: true,
  },
  ICEBERG: {
    label: 'Iceberg',
    description: 'Chia lệnh lớn thành nhiều phần, mỗi lần chỉ hiện một phần.',
    fields: [{ name: 'slice_qty', label: 'KL mỗi phần', kind: 'qty', unit: 'CP' }, LIMIT_PRICE],
    usesMtl: false,
  },
  TWAP: {
    label: 'TWAP',
    description: 'Chia đều khối lượng theo thời gian.',
    fields: [
      START_TIME,
      END_TIME,
      { name: 'interval_min', label: 'Chu kỳ', kind: 'number', unit: 'phút', min: 1 },
      LIMIT_PRICE,
    ],
    usesMtl: false,
  },
  VWAP: {
    label: 'VWAP',
    description: 'Chia khối lượng theo phân bố thanh khoản trong ngày.',
    fields: [START_TIME, END_TIME, LIMIT_PRICE],
    usesMtl: false,
  },
  POV: {
    label: 'POV',
    description: 'Khớp theo một tỷ lệ của khối lượng thị trường.',
    fields: [
      { name: 'participation_pct', label: 'Tỷ lệ tham gia', kind: 'number', unit: '%', min: 1, max: 100 },
      { name: 'max_pct', label: 'Tỷ lệ tối đa', kind: 'number', unit: '%', min: 1, max: 100 },
      LIMIT_PRICE,
    ],
    usesMtl: false,
  },
  HUNT: {
    label: 'HUNT',
    description: 'Chờ giá về mức săn trong thời gian cho phép rồi vào lệnh; có thể quét nhiều mức của sổ lệnh.',
    fields: [
      { name: 'hunt_price', label: 'Giá săn', kind: 'price', unit: 'đ' },
      { name: 'max_wait_min', label: 'Thời gian chờ tối đa', kind: 'number', unit: 'phút', min: 1 },
      { ...LIMIT_PRICE, hint: 'Tối đa khi mua, tối thiểu khi bán.' },
      {
        name: 'max_levels',
        label: 'Số mức quét tối đa',
        kind: 'number',
        unit: 'mức',
        min: 1,
        max: HUNT_MAX_LEVELS,
        optional: true,
        hint: 'Để trống: vào một lệnh tại giá giới hạn như cũ.',
      },
      {
        name: 'remainder_passive',
        label: 'Phần còn lại sau khi quét',
        kind: 'select',
        options: REMAINDER_OPTIONS,
        optional: true,
      },
    ],
    usesMtl: false,
  },
}

export const STRATEGY_TYPES = Object.keys(STRATEGIES) as StrategyType[]

/** Định dạng giá trị một tham số để hiển thị (hộp xác nhận, chi tiết lệnh, thẻ mẫu). */
export function formatStrategyFieldValue(field: StrategyField, raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return field.optional ? 'Mặc định' : '—'
  if (field.kind === 'time') return String(raw)
  if (field.kind === 'select') return field.options?.find((option) => option.value === Number(raw))?.label ?? String(raw)
  const text = formatNumber(Number(raw))
  return field.unit ? `${text} ${field.unit}` : text
}
