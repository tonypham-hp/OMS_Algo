import { MARKET_CLOSE_SECONDS, MARKET_OPEN_SECONDS } from '@/config/hose'
import { STRATEGIES, formatStrategyFieldValue, type StrategyFieldName } from '@/config/strategies'
import { STRATEGY_TEMPLATES, type StrategyTemplate, type TemplateValue } from '@/config/strategyTemplates'
import { formatClock } from '@/lib/format'
import type { Role, StrategyType, SymbolQuote } from '@/types'
import { getTickSize, stepPrice } from './hose'

const hhmm = (hour: number, minute: number) => hour * 3600 + minute * 60
/** Giờ bắt đầu sớm nhất của mẫu có lịch: đầu phiên liên tục. */
const CONTINUOUS_START = hhmm(9, 15)

/** Mẫu một vai trò được thấy, chỉ gồm loại lệnh đang bật (hàm thuần). */
export function getVisibleTemplates(
  role: Role | undefined,
  enabledStrategies?: readonly StrategyType[],
  templates: readonly StrategyTemplate[] = STRATEGY_TEMPLATES,
): StrategyTemplate[] {
  return templates.filter(
    (template) =>
      (!template.roles || (role !== undefined && template.roles.includes(role))) &&
      (!enabledStrategies || enabledStrategies.includes(template.strategy_type)),
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/** Giờ dạng HH:mm, kẹp trong giờ giao dịch 09:00–14:45. */
function toTime(seconds: number) {
  return formatClock(clamp(seconds, MARKET_OPEN_SECONDS, MARKET_CLOSE_SECONDS)).slice(0, 5)
}

/**
 * Khung giờ cho mẫu có lịch (TWAP): bắt đầu từ `start` (không sớm hơn 09:15), kéo dài `minutes` phút.
 * Không đủ chỗ trước 14:45 thì lùi giờ bắt đầu; đã quá muộn trong ngày thì dùng khung đầu phiên.
 */
function resolveWindow(nowSeconds: number, startOffsetMin: number, endOffsetMin: number) {
  const length = (endOffsetMin - startOffsetMin) * 60
  let start = Math.ceil((Math.max(nowSeconds, CONTINUOUS_START) + startOffsetMin * 60) / 60) * 60
  if (start + length > MARKET_CLOSE_SECONDS) start = MARKET_CLOSE_SECONDS - length
  if (start < CONTINUOUS_START || nowSeconds >= MARKET_CLOSE_SECONDS) start = CONTINUOUS_START
  return { start, end: Math.min(start + length, MARKET_CLOSE_SECONDS) }
}

function resolvePrice(base: number, ticks: number, quote: SymbolQuote) {
  return clamp(stepPrice(base, ticks), quote.floor_price, quote.ceiling_price)
}

/** Giá trị form điền sẵn từ một mẫu. Chỉ là giá trị một phần: tài khoản, mã vẫn giữ như đang chọn. */
export interface TemplateFormValues {
  strategy_type: StrategyType
  side?: 'BUY' | 'SELL'
  total_qty?: number
  values: Partial<Record<StrategyFieldName, number | string>>
}

/**
 * Điền mẫu theo thị trường lúc chọn (hàm thuần): giá tính tương đối theo giá khớp, mua 1, bán 1 và làm tròn đúng bước giá,
 * kẹp trong trần – sàn; giờ tính theo đồng hồ giả lập. Chỉ điền các ô thuộc loại lệnh của mẫu.
 */
export function applyTemplate(template: StrategyTemplate, quote: SymbolQuote, nowSeconds: number): TemplateFormValues {
  const fields = STRATEGIES[template.strategy_type].fields
  const startParam = template.params.start_time
  const endParam = template.params.end_time
  const window =
    typeof startParam === 'object' && 'time' in startParam && typeof endParam === 'object' && 'time' in endParam
      ? resolveWindow(nowSeconds, startParam.addMinutes, endParam.addMinutes)
      : null

  const resolve = (name: StrategyFieldName, value: TemplateValue): number | string => {
    if (typeof value === 'number' || typeof value === 'string') return value
    if ('price' in value) {
      const base = value.price === 'bid' ? quote.bid_price : value.price === 'ask' ? quote.ask_price : quote.last_price
      return resolvePrice(base, value.ticks, quote)
    }
    if ('money' in value) return getTickSize(quote.ref_price) * value.money
    if (window) return toTime(name === 'end_time' ? window.end : window.start)
    return toTime(nowSeconds + value.addMinutes * 60)
  }

  const values: TemplateFormValues['values'] = {}
  for (const field of fields) {
    const value = template.params[field.name]
    if (value !== undefined) values[field.name] = resolve(field.name, value)
  }
  return { strategy_type: template.strategy_type, side: template.side, total_qty: template.total_qty, values }
}

/** Các dòng "tham số mặc định" của mẫu để hiển thị, giá tính theo quote nếu có, không có thì mô tả tương đối. */
export function describeTemplateParams(template: StrategyTemplate, quote?: SymbolQuote, nowSeconds?: number) {
  const fields = STRATEGIES[template.strategy_type].fields
  const applied = quote && nowSeconds !== undefined ? applyTemplate(template, quote, nowSeconds).values : null
  return fields
    .filter((field) => template.params[field.name] !== undefined)
    .map((field) => {
      const raw = template.params[field.name] as TemplateValue
      if (applied) return { label: field.label, value: formatStrategyFieldValue(field, applied[field.name]) }
      if (typeof raw === 'number' || typeof raw === 'string') return { label: field.label, value: formatStrategyFieldValue(field, raw) }
      if ('price' in raw) {
        const base = raw.price === 'bid' ? 'giá mua 1' : raw.price === 'ask' ? 'giá bán 1' : 'giá khớp'
        const shift = raw.ticks === 0 ? '' : ` ${raw.ticks > 0 ? '+' : '−'} ${Math.abs(raw.ticks)} bước giá`
        return { label: field.label, value: `${base}${shift}` }
      }
      if ('money' in raw) return { label: field.label, value: `${raw.money} bước giá` }
      return { label: field.label, value: `sau ${raw.addMinutes} phút` }
    })
}
