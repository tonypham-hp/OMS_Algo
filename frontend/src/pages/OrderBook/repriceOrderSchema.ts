import { z } from 'zod'
import { ruleMessage } from '@/explain/reasons'
import { buildRuleContext } from '@/rules/context'
import { checkPrice } from '@/rules/validate'
import type { OrderPriceField, SymbolQuote } from '@/types'

// Ô trống là null, không phải undefined, cùng lý do với form Sửa thường.
export type RepriceOrderValues = Record<string, number | null>

/** Kiểm tra biên độ và bước giá ngay trên form, theo gói luật của mã. Quan hệ giữa các giá do API kiểm tra. */
export function validateReprice(values: RepriceOrderValues, fields: OrderPriceField[], quote: SymbolQuote | undefined) {
  const errors: Array<{ field: string; message: string }> = []
  const rule = quote ? buildRuleContext(quote) : null
  for (const { name } of fields) {
    const value = values[name] ?? null
    if (value === null) {
      errors.push({ field: name, message: 'Vui lòng nhập giá' })
    } else if (rule) {
      const violation = checkPrice(value, rule.rules, rule.symbol)[0]
      if (violation) errors.push({ field: name, message: ruleMessage(violation) })
    }
  }
  return errors
}

export function createRepriceSchema(fields: OrderPriceField[], getQuote: () => SymbolQuote | undefined) {
  return z.record(z.string(), z.number().nullable()).superRefine((values, refinement) => {
    for (const error of validateReprice(values, fields, getQuote())) {
      refinement.addIssue({ code: 'custom', path: [error.field], message: error.message })
    }
  })
}
