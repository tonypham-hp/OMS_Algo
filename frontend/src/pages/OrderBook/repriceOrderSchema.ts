import { z } from 'zod'
import type { OrderPriceField } from '@/types'
import { validatePrice } from '@/utils/hose'

// Ô trống là null, không phải undefined, cùng lý do với form Sửa thường.
export type RepriceOrderValues = Record<string, number | null>

/** Kiểm tra biên độ và bước giá ngay trên form. Quan hệ giữa các giá do API kiểm tra. */
export function validateReprice(
  values: RepriceOrderValues,
  fields: OrderPriceField[],
  refPrice: number | undefined,
) {
  const errors: Array<{ field: string; message: string }> = []
  for (const { name } of fields) {
    const value = values[name] ?? null
    if (value === null) {
      errors.push({ field: name, message: 'Vui lòng nhập giá' })
    } else if (refPrice !== undefined) {
      const message = validatePrice(value, refPrice)
      if (message) errors.push({ field: name, message })
    }
  }
  return errors
}

export function createRepriceSchema(fields: OrderPriceField[], getRefPrice: () => number | undefined) {
  return z.record(z.string(), z.number().nullable()).superRefine((values, refinement) => {
    for (const error of validateReprice(values, fields, getRefPrice())) {
      refinement.addIssue({ code: 'custom', path: [error.field], message: error.message })
    }
  })
}
