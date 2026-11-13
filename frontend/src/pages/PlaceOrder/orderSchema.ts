import { z } from 'zod'
import { MARKET_CLOSE_SECONDS, MARKET_OPEN_SECONDS } from '@/config/hose'
import { STRATEGIES, type StrategyField, type StrategyFieldName } from '@/config/strategies'
import { DEFAULT_ORDER_RULES } from '@/config/systemParams'
import { formatNumber } from '@/lib/format'
import type { CreateOrderRequest, OrderRules, StrategyParameter, SymbolQuote } from '@/types'
import { getTickSize, parseTimeToSeconds, validatePrice, validateQuantity } from '@/utils/hose'

// Mọi trường đều để optional ở đây để luôn chạy hết phần kiểm tra bên dưới
// và báo được tất cả lỗi cùng lúc, thay vì dừng ở trường thiếu đầu tiên.
const orderFormShape = z.object({
  account_no: z.string(),
  symbol: z.string(),
  side: z.enum(['BUY', 'SELL']),
  strategy_type: z.enum([
    'STOP',
    'STOP_LIMIT',
    'TAKE_PROFIT',
    'TRAILING_STOP',
    'OCO',
    'BRACKET',
    'ICEBERG',
    'TWAP',
    'VWAP',
    'POV',
    'HUNT',
  ]),
  total_qty: z.number().optional(),
  persistence_mode: z.enum(['DAY', 'GTD', 'MULTI_SESSION']),
  valid_to: z.string().optional(),
  limit_price: z.number().optional(),
  trigger_price: z.number().optional(),
  trailing_value: z.number().optional(),
  tp_price: z.number().optional(),
  sl_price: z.number().optional(),
  slice_qty: z.number().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  interval_min: z.number().optional(),
  participation_pct: z.number().optional(),
  max_pct: z.number().optional(),
  hunt_price: z.number().optional(),
  max_wait_min: z.number().optional(),
  max_levels: z.number().optional(),
  remainder_passive: z.number().optional(),
})

export type OrderFormValues = z.infer<typeof orderFormShape>

export interface OrderValidationContext {
  getQuote: (symbol: string) => SymbolQuote | undefined
  /** Ngày hiện tại, dạng YYYY-MM-DD. */
  today: string
  /** Luật đặt lệnh của cấu hình hệ thống. Không truyền thì dùng giá trị mặc định. */
  orderRules?: OrderRules
}

export interface OrderFieldError {
  field: keyof OrderFormValues
  message: string
}

function isMissing(value: unknown) {
  return value === undefined || value === null || value === ''
}

function validateField(
  field: StrategyField,
  value: number | string,
  totalQty: number | undefined,
  quote: SymbolQuote,
): string | null {
  switch (field.kind) {
    case 'price':
      return validatePrice(value as number, quote.ref_price)
    case 'money': {
      const money = value as number
      const tick = getTickSize(quote.ref_price)
      if (money <= 0) return `${field.label} phải lớn hơn 0`
      if (money % tick !== 0) return `${field.label} phải là bội số của bước giá ${formatNumber(tick)}đ`
      return null
    }
    case 'qty': {
      const error = validateQuantity(value as number)
      if (error) return error
      if (totalQty !== undefined && (value as number) > totalQty) {
        return `${field.label} không được lớn hơn khối lượng đặt`
      }
      return null
    }
    case 'select': {
      const allowed = field.options?.some((option) => option.value === value) ?? false
      return allowed ? null : `${field.label}: lựa chọn không hợp lệ`
    }
    case 'number': {
      const number = value as number
      if (field.min !== undefined && number < field.min) return `${field.label} tối thiểu là ${field.min}`
      if (field.max !== undefined && number > field.max) return `${field.label} tối đa là ${field.max}`
      return null
    }
    case 'time': {
      const seconds = parseTimeToSeconds(value as string)
      if (seconds === null) return 'Giờ không hợp lệ'
      if (seconds < MARKET_OPEN_SECONDS || seconds > MARKET_CLOSE_SECONDS) {
        return 'Giờ phải nằm trong khoảng 09:00 đến 14:45'
      }
      return null
    }
  }
}

/** Kiểm tra quan hệ giữa các trường. Chỉ gọi khi từng trường đã hợp lệ. */
function validateCrossFields(values: OrderFormValues, quote: SymbolQuote): OrderFieldError[] {
  const errors: OrderFieldError[] = []
  const add = (field: keyof OrderFormValues, message: string) => errors.push({ field, message })
  const isBuy = values.side === 'BUY'
  const last = quote.last_price
  const lastText = formatNumber(last)
  const { limit_price: limit, trigger_price: trigger, tp_price: tp, sl_price: sl } = values

  switch (values.strategy_type) {
    case 'STOP':
    case 'STOP_LIMIT':
      if (trigger !== undefined) {
        if (isBuy && trigger <= last) add('trigger_price', `Stop mua: giá kích hoạt phải cao hơn giá khớp ${lastText}`)
        if (!isBuy && trigger >= last) add('trigger_price', `Stop bán: giá kích hoạt phải thấp hơn giá khớp ${lastText}`)
      }
      break
    case 'TAKE_PROFIT':
      if (trigger !== undefined) {
        if (isBuy && trigger >= last) add('trigger_price', `Take Profit mua: giá kích hoạt phải thấp hơn giá khớp ${lastText}`)
        if (!isBuy && trigger <= last) add('trigger_price', `Take Profit bán: giá kích hoạt phải cao hơn giá khớp ${lastText}`)
      }
      break
    case 'OCO':
      if (tp !== undefined) {
        if (isBuy && tp >= last) add('tp_price', `OCO mua: giá chốt lời phải thấp hơn giá khớp ${lastText}`)
        if (!isBuy && tp <= last) add('tp_price', `OCO bán: giá chốt lời phải cao hơn giá khớp ${lastText}`)
      }
      if (sl !== undefined) {
        if (isBuy && sl <= last) add('sl_price', `OCO mua: giá cắt lỗ phải cao hơn giá khớp ${lastText}`)
        if (!isBuy && sl >= last) add('sl_price', `OCO bán: giá cắt lỗ phải thấp hơn giá khớp ${lastText}`)
      }
      break
    case 'BRACKET':
      if (limit !== undefined && tp !== undefined) {
        if (isBuy && tp <= limit) add('tp_price', 'Bracket mua: giá chốt lời phải cao hơn giá vào lệnh')
        if (!isBuy && tp >= limit) add('tp_price', 'Bracket bán: giá chốt lời phải thấp hơn giá vào lệnh')
      }
      if (limit !== undefined && sl !== undefined) {
        if (isBuy && sl >= limit) add('sl_price', 'Bracket mua: giá cắt lỗ phải thấp hơn giá vào lệnh')
        if (!isBuy && sl <= limit) add('sl_price', 'Bracket bán: giá cắt lỗ phải cao hơn giá vào lệnh')
      }
      break
    case 'HUNT':
      if (limit !== undefined && values.hunt_price !== undefined) {
        if (isBuy && limit < values.hunt_price) add('limit_price', 'HUNT mua: giá giới hạn không được thấp hơn giá săn')
        if (!isBuy && limit > values.hunt_price) add('limit_price', 'HUNT bán: giá giới hạn không được cao hơn giá săn')
      }
      break
    case 'TWAP':
    case 'VWAP': {
      const start = parseTimeToSeconds(values.start_time ?? '')
      const end = parseTimeToSeconds(values.end_time ?? '')
      if (start !== null && end !== null) {
        if (start >= end) add('end_time', 'Giờ kết thúc phải sau giờ bắt đầu')
        else if (values.interval_min !== undefined && values.interval_min * 60 > end - start) {
          add('interval_min', 'Chu kỳ không được dài hơn khoảng thời gian chạy lệnh')
        }
      }
      break
    }
    case 'POV':
      if (
        values.participation_pct !== undefined &&
        values.max_pct !== undefined &&
        values.participation_pct > values.max_pct
      ) {
        add('participation_pct', 'Tỷ lệ tham gia không được lớn hơn tỷ lệ tối đa')
      }
      break
  }

  // Stop Limit, Take Profit: khi kích hoạt, giá giới hạn phải đủ để lệnh có cơ hội khớp.
  if ((values.strategy_type === 'STOP_LIMIT' || values.strategy_type === 'TAKE_PROFIT') && limit !== undefined && trigger !== undefined) {
    if (isBuy && limit < trigger) add('limit_price', 'Lệnh mua: giá giới hạn không được thấp hơn giá kích hoạt')
    if (!isBuy && limit > trigger) add('limit_price', 'Lệnh bán: giá giới hạn không được cao hơn giá kích hoạt')
  }

  return errors
}

/** Luật kiểm tra lệnh, dùng chung cho form và API giả lập. Trả về rỗng nếu hợp lệ. */
export function validateOrderValues(
  values: OrderFormValues,
  context: OrderValidationContext,
): OrderFieldError[] {
  const errors: OrderFieldError[] = []

  if (!values.account_no) errors.push({ field: 'account_no', message: 'Vui lòng chọn tài khoản' })

  if (values.total_qty === undefined) {
    errors.push({ field: 'total_qty', message: 'Vui lòng nhập khối lượng' })
  } else {
    const qtyError = validateQuantity(values.total_qty)
    if (qtyError) errors.push({ field: 'total_qty', message: qtyError })
  }

  if (values.persistence_mode !== 'DAY') {
    if (!values.valid_to) {
      errors.push({ field: 'valid_to', message: 'Vui lòng chọn ngày hết hạn' })
    } else if (values.valid_to < context.today) {
      errors.push({ field: 'valid_to', message: 'Ngày hết hạn không được ở quá khứ' })
    }
  }

  const quote = context.getQuote(values.symbol)
  if (!quote) {
    errors.push({ field: 'symbol', message: 'Mã chứng khoán không hợp lệ' })
    return errors
  }

  const fieldErrors: OrderFieldError[] = []
  const ruleErrors = validateOrderRules(values, context.orderRules ?? DEFAULT_ORDER_RULES)
  const strategyError = ruleErrors.find((error) => error.field === 'strategy_type')
  if (strategyError) errors.push(strategyError)
  for (const field of STRATEGIES[values.strategy_type].fields) {
    const value = values[field.name]
    if (isMissing(value)) {
      if (field.optional) continue
      fieldErrors.push({ field: field.name, message: `Vui lòng nhập ${field.label.toLowerCase()}` })
      continue
    }
    const message = validateField(field, value as number | string, values.total_qty, quote)
    if (message) fieldErrors.push({ field: field.name, message })
  }
  errors.push(...fieldErrors)

  // Trường đã sai thì không so sánh tiếp, tránh báo hai lỗi cho cùng một ô.
  const invalid = new Set(fieldErrors.map((error) => error.field))
  for (const error of ruleErrors) {
    if (error.field === 'strategy_type' || invalid.has(error.field)) continue
    errors.push(error)
    invalid.add(error.field)
  }
  const crossErrors = validateCrossFields(onlyValidFields(values, invalid), quote)
  errors.push(...crossErrors)

  return errors
}

/**
 * Luật đặt lệnh của cấu hình hệ thống: loại lệnh đang bật, khoảng KL mỗi phần Iceberg, trần tỷ lệ POV.
 * Chỉ áp cho lệnh mới, nên engine gọi riêng hàm này khi tạo lệnh, còn lệnh đang chạy giữ tham số lúc đặt.
 */
export function validateOrderRules(values: OrderFormValues, rules: OrderRules): OrderFieldError[] {
  const errors: OrderFieldError[] = []
  if (!rules.enabledStrategies.includes(values.strategy_type)) {
    errors.push({
      field: 'strategy_type',
      message: `Loại lệnh ${STRATEGIES[values.strategy_type].label} đang tạm ngừng, chưa đặt mới được`,
    })
  }
  if (values.strategy_type === 'ICEBERG' && typeof values.slice_qty === 'number') {
    if (values.slice_qty < rules.icebergMinSlice) {
      errors.push({ field: 'slice_qty', message: `KL mỗi phần tối thiểu là ${formatNumber(rules.icebergMinSlice)} CP` })
    } else if (values.slice_qty > rules.icebergMaxSlice) {
      errors.push({ field: 'slice_qty', message: `KL mỗi phần tối đa là ${formatNumber(rules.icebergMaxSlice)} CP` })
    }
  }
  if (values.strategy_type === 'POV') {
    const cap = `${rules.povMaxPct}%`
    if (typeof values.participation_pct === 'number' && values.participation_pct > rules.povMaxPct) {
      errors.push({ field: 'participation_pct', message: `Tỷ lệ tham gia không được vượt trần hệ thống ${cap}` })
    }
    if (typeof values.max_pct === 'number' && values.max_pct > rules.povMaxPct) {
      errors.push({ field: 'max_pct', message: `Tỷ lệ tối đa không được vượt trần hệ thống ${cap}` })
    }
  }
  return errors
}

function onlyValidFields(values: OrderFormValues, invalid: Set<keyof OrderFormValues>): OrderFormValues {
  const copy: OrderFormValues = { ...values }
  for (const field of invalid) delete copy[field]
  return copy
}

export function createOrderSchema(getContext: () => OrderValidationContext) {
  return orderFormShape.superRefine((values, refinement) => {
    for (const error of validateOrderValues(values, getContext())) {
      refinement.addIssue({ code: 'custom', path: [error.field], message: error.message })
    }
  })
}

/** Đổi dữ liệu form sang dữ liệu gửi API. Chỉ lấy tham số của loại lệnh đang chọn. */
export function toCreateOrderRequest(
  values: OrderFormValues,
  clientRequestId: string,
  options: { templateId?: string } = {},
): CreateOrderRequest {
  const fields = STRATEGIES[values.strategy_type].fields
  const hasLimitPrice = fields.some((field) => field.name === 'limit_price')
  const parameters: StrategyParameter[] = fields
    .filter((field) => field.name !== 'limit_price')
    // Ô không bắt buộc mà để trống thì không gửi.
    .filter((field) => !(field.optional && isMissing(values[field.name])))
    .map((field) => ({
      parameter_code: field.name,
      parameter_value: String(values[field.name]),
      data_type: field.kind === 'time' ? 'TIME' : 'INTEGER',
    }))

  return {
    client_request_id: clientRequestId,
    account_no: values.account_no,
    symbol: values.symbol,
    side: values.side,
    total_qty: values.total_qty as number,
    limit_price: hasLimitPrice ? (values.limit_price as number) : null,
    strategy_type: values.strategy_type,
    persistence_mode: values.persistence_mode,
    valid_to: values.persistence_mode === 'DAY' ? null : (values.valid_to ?? null),
    parameters,
    ...(options.templateId ? { template_id: options.templateId } : {}),
  }
}

/** Chiều ngược lại, để API giả lập kiểm tra lại bằng đúng luật của form. */
export function fromCreateOrderRequest(request: CreateOrderRequest): OrderFormValues {
  const values: OrderFormValues = {
    account_no: request.account_no,
    symbol: request.symbol,
    side: request.side,
    strategy_type: request.strategy_type,
    total_qty: request.total_qty,
    persistence_mode: request.persistence_mode,
    valid_to: request.valid_to ?? undefined,
    limit_price: request.limit_price ?? undefined,
  }
  for (const parameter of request.parameters) {
    const name = parameter.parameter_code as StrategyFieldName
    if (parameter.data_type === 'TIME') {
      values[name as 'start_time' | 'end_time'] = parameter.parameter_value
    } else {
      values[name as Exclude<StrategyFieldName, 'start_time' | 'end_time'>] = Number(parameter.parameter_value)
    }
  }
  return values
}
