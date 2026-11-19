import { Input } from '@/components/ui/input'
import { formatNumber } from '@/lib/format'

interface NumberInputProps {
  id: string
  value: number | undefined
  onChange: (value: number | undefined) => void
  onBlur?: () => void
  unit?: string
  invalid?: boolean
  disabled?: boolean
}

/** Ô nhập số nguyên, tự hiển thị dấu chấm ngăn cách kiểu Việt Nam: 1.000.000. */
export function NumberInput({ id, value, onChange, onBlur, unit, invalid, disabled }: NumberInputProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className={unit ? 'pr-12 text-right tabular-nums' : 'text-right tabular-nums'}
        value={value === undefined ? '' : formatNumber(value)}
        aria-invalid={invalid}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '')
          onChange(digits === '' ? undefined : Number(digits))
        }}
      />
      {unit && (
        <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs">
          {unit}
        </span>
      )}
    </div>
  )
}
