import { STRATEGIES, formatStrategyFieldValue, type StrategyFieldName } from '@/config/strategies'
import { STRATEGY_TEMPLATES, type StrategyTemplate, type TemplateValue } from '@/config/strategyTemplates'
import { formatClock } from '@/lib/format'
import type { Role, StrategyType, SymbolQuote } from '@/types'
import { expirySeconds, marketOpenSeconds, sessionSpans } from '@/rules/session'
import type { RulePack, SecType } from '@/rules/types'
import { getTickSize, rulesForQuote, stepPrice } from './hose'

/** Giờ của pack mà mẫu cần: mở cửa, đầu phiên liên tục (giờ bắt đầu sớm nhất của mẫu có lịch), hết khớp lệnh. */
function hoursOf(rules: RulePack) {
  const continuous = sessionSpans(rules).find((item) => item.code === 'CONTINUOUS')
  return { open: marketOpenSeconds(rules), continuousStart: continuous?.start ?? marketOpenSeconds(rules), close: expirySeconds(rules) }
}

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

/** Giờ dạng HH:mm, kẹp trong giờ giao dịch của pack (HOSE: 09:00–14:45). */
function toTime(seconds: number, hours: ReturnType<typeof hoursOf>) {
  return formatClock(clamp(seconds, hours.open, hours.close)).slice(0, 5)
}

/**
 * Khung giờ cho mẫu có lịch (TWAP): bắt đầu từ `start` (không sớm hơn đầu phiên liên tục), kéo dài `minutes` phút.
 * Không đủ chỗ trước giờ hết khớp lệnh thì lùi giờ bắt đầu; đã quá muộn trong ngày thì dùng khung đầu phiên.
 */
function resolveWindow(nowSeconds: number, startOffsetMin: number, endOffsetMin: number, hours: ReturnType<typeof hoursOf>) {
  const { continuousStart, close } = hours
  const length = (endOffsetMin - startOffsetMin) * 60
  let start = Math.ceil((Math.max(nowSeconds, continuousStart) + startOffsetMin * 60) / 60) * 60
  if (start + length > close) start = close - length
  if (start < continuousStart || nowSeconds >= close) start = continuousStart
  return { start, end: Math.min(start + length, close) }
}

function resolvePrice(base: number, ticks: number, quote: SymbolQuote, secType: SecType, rules: RulePack) {
  return clamp(stepPrice(base, ticks, secType, rules), quote.floor_price, quote.ceiling_price)
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
export function applyTemplate(
  template: StrategyTemplate,
  quote: SymbolQuote,
  nowSeconds: number,
  date?: string,
): TemplateFormValues {
  const { rules, secType } = rulesForQuote(quote, date)
  const hours = hoursOf(rules)
  const fields = STRATEGIES[template.strategy_type].fields
  const startParam = template.params.start_time
  const endParam = template.params.end_time
  const window =
    typeof startParam === 'object' && 'time' in startParam && typeof endParam === 'object' && 'time' in endParam
      ? resolveWindow(nowSeconds, startParam.addMinutes, endParam.addMinutes, hours)
      : null

  const resolve = (name: StrategyFieldName, value: TemplateValue): number | string => {
    if (typeof value === 'number' || typeof value === 'string') return value
    if ('price' in value) {
      const base = value.price === 'bid' ? quote.bid_price : value.price === 'ask' ? quote.ask_price : quote.last_price
      return resolvePrice(base, value.ticks, quote, secType, rules)
    }
    if ('money' in value) return getTickSize(quote.ref_price, secType, rules) * value.money
    if (window) return toTime(name === 'end_time' ? window.end : window.start, hours)
    return toTime(nowSeconds + value.addMinutes * 60, hours)
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
