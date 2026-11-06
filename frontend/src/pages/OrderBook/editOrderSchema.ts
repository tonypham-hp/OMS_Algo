import { z } from 'zod'
import { STRATEGIES } from '@/config/strategies'
import { formatNumber } from '@/lib/format'
import type { ParentOrder } from '@/types'
import { validatePrice, validateQuantity } from '@/utils/hose'

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

/** Kiểm tra ngay trên form. API kiểm tra lại đầy đủ, gồm cả KL của lệnh con chưa rõ trạng thái. */
export function validateEditOrder(values: EditOrderValues, order: ParentOrder, refPrice: number | undefined) {
  const errors: Array<{ field: keyof EditOrderValues; message: string }> = []

  if (values.total_qty === null) {
    errors.push({ field: 'total_qty', message: 'Vui lòng nhập khối lượng' })
  } else {
    const qtyError = validateQuantity(values.total_qty)
    if (qtyError) errors.push({ field: 'total_qty', message: qtyError })
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
    } else if (refPrice !== undefined) {
      const priceError = validatePrice(values.limit_price, refPrice)
      if (priceError) errors.push({ field: 'limit_price', message: priceError })
    }
  }

  return errors
}

export function createEditOrderSchema(order: ParentOrder, getRefPrice: () => number | undefined) {
  return editOrderShape.superRefine((values, refinement) => {
    for (const error of validateEditOrder(values, order, getRefPrice())) {
      refinement.addIssue({ code: 'custom', path: [error.field], message: error.message })
    }
  })
}
