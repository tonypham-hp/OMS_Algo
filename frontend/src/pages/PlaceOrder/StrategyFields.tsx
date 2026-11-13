import { Controller, type Control } from 'react-hook-form'
import { FieldError } from '@/components/FieldError'
import { NumberInput } from '@/components/NumberInput'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { StrategyField } from '@/config/strategies'
import type { OrderFormValues } from './orderSchema'

/** Giá trị "chưa chọn" của ô chọn không bắt buộc (Select không nhận chuỗi rỗng). */
const NONE = '__none__'

interface StrategyFieldsProps {
  control: Control<OrderFormValues>
  fields: StrategyField[]
}

/** Vẽ các ô tham số theo khai báo trong config/strategies.ts. */
export function StrategyFields({ control, fields }: StrategyFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((item) => (
        <Controller
          key={item.name}
          control={control}
          name={item.name}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={item.name}>
                {item.label}
                {item.optional && <span className="text-muted-foreground font-normal"> (không bắt buộc)</span>}
              </Label>
              {item.kind === 'select' ? (
                <Select
                  value={field.value === undefined ? NONE : String(field.value)}
                  onValueChange={(value) => field.onChange(value === NONE ? undefined : Number(value))}
                >
                  <SelectTrigger id={item.name} className="w-full" aria-invalid={fieldState.invalid}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {item.optional && <SelectItem value={NONE}>Mặc định</SelectItem>}
                    {item.options?.map((option) => (
                      <SelectItem key={option.value} value={String(option.value)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : item.kind === 'time' ? (
                <Input
                  id={item.name}
                  type="time"
                  value={(field.value as string | undefined) ?? ''}
                  aria-invalid={fieldState.invalid}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
              ) : (
                <NumberInput
                  id={item.name}
                  value={field.value as number | undefined}
                  unit={item.unit}
                  invalid={fieldState.invalid}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                />
              )}
              {item.hint && !fieldState.error && <p className="text-muted-foreground text-xs">{item.hint}</p>}
              <FieldError message={fieldState.error?.message} />
            </div>
          )}
        />
      ))}
    </div>
  )
}
