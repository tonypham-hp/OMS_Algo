import { z } from 'zod'
import { STRATEGIES } from '@/config/strategies'
import { ruleMessage } from '@/explain/reasons'
import { formatNumber } from '@/lib/format'
import { buildRuleContext } from '@/rules/context'
import { defaultRules } from '@/rules/registry'
import { checkPrice, checkQty } from '@/rules/validate'
import type { ParentOrder, SymbolQuote } from '@/types'

// Ô trống là null, không phải undefined: react-hook-form coi undefined là "lấy lại giá trị mặc định",
// khiến ô đang có sẵn giá trị không xóa trắng được.
const editOrderShape = z.object({
  total_qty: z.number().nullable(),
  limit_price: z.number().nullable(),
})

export type EditOrderValues = z.infer<typeof editOrderShape>

export function hasLimitPrice(order: ParentOrder) {
  return STRATEGIES[order.strategy_type].fields.some((field) => field.name === 'limit_price')
}

/**
 * Kiểm tra ngay trên form bằng bộ kiểm tra theo gói luật của mã (src/rules/validate.ts).
 * API kiểm tra lại đầy đủ, gồm cả KL của lệnh con chưa rõ trạng thái.
 */
export function validateEditOrder(values: EditOrderValues, order: ParentOrder, quote: SymbolQuote | undefined) {
  const errors: Array<{ field: keyof EditOrderValues; message: string }> = []
  const rule = quote ? buildRuleContext(quote) : null
  const lot = order.lot_type ?? 'ROUND'

  if (values.total_qty === null) {
    errors.push({ field: 'total_qty', message: 'Vui lòng nhập khối lượng' })
  } else {
    const qtyError = checkQty(values.total_qty, lot, rule?.rules ?? defaultRules())[0]
    if (qtyError) errors.push({ field: 'total_qty', message: ruleMessage(qtyError) })
    else if (values.total_qty < order.executed_qty) {
      errors.push({
        field: 'total_qty',
        message: `Khối lượng không được nhỏ hơn phần đã khớp ${formatNumber(order.executed_qty)}`,
      })
    }
  }

  if (hasLimitPrice(order)) {
    if (values.limit_price === null) {
      errors.push({ field: 'limit_price', message: 'Vui lòng nhập giá giới hạn' })
    } else if (rule) {
      const priceError = checkPrice(values.limit_price, rule.rules, rule.symbol)[0]
      if (priceError) errors.push({ field: 'limit_price', message: ruleMessage(priceError) })
    }
  }

  return errors
}

export function createEditOrderSchema(order: ParentOrder, getQuote: () => SymbolQuote | undefined) {
  return editOrderShape.superRefine((values, refinement) => {
    for (const error of validateEditOrder(values, order, getQuote())) {
      refinement.addIssue({ code: 'custom', path: [error.field], message: error.message })
    }
  })
}
