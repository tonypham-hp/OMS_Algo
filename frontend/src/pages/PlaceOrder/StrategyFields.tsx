import { Controller, type Control } from 'react-hook-form'
import { FieldError } from '@/components/FieldError'
import { NumberInput } from '@/components/NumberInput'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { StrategyField } from '@/config/strategies'
import type { OrderFormValues } from './orderSchema'

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
              <Label htmlFor={item.name}>{item.label}</Label>
              {item.kind === 'time' ? (
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
              <FieldError message={fieldState.error?.message} />
            </div>
          )}
        />
      ))}
    </div>
  )
}
