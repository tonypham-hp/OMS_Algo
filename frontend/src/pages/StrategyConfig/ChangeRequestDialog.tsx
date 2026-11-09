import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { FieldError } from '@/components/FieldError'
import { NumberInput } from '@/components/NumberInput'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { STRATEGIES, STRATEGY_TYPES } from '@/config/strategies'
import {
  formatParameterLimit,
  formatParameterValue,
  getParameterDefinition,
  isSameValue,
  validateParameterValue,
} from '@/config/systemParams'
import { useCreateChangeRequest } from '@/hooks/useSystemConfig'
import type { StrategyType, SystemParameter, SystemParameterValue, SystemParameterValues } from '@/types'

const formShape = z.object({
  value: z.number().optional(),
  strategies: z.array(z.string()),
  reason: z.string(),
})

type FormValues = z.infer<typeof formShape>

interface ChangeRequestDialogProps {
  parameter: SystemParameter
  /** Mọi tham số, để kiểm tra ràng buộc chéo (KL mỗi phần tối thiểu ≤ tối đa) theo giá trị đang áp dụng. */
  parameters: SystemParameter[]
  onClose: () => void
}

function toCurrentValues(parameters: SystemParameter[]): SystemParameterValues {
  return Object.fromEntries(parameters.map((item) => [item.parameter_code, item.value])) as unknown as SystemParameterValues
}

/** Người tạo nhập giá trị mới và lý do. Yêu cầu chỉ có hiệu lực khi một người vận hành khác duyệt. */
export function ChangeRequestDialog({ parameter, parameters, onClose }: ChangeRequestDialogProps) {
  const create = useCreateChangeRequest()
  const code = parameter.parameter_code
  const isList = parameter.data_type === 'STRATEGY_LIST'
  const definition = getParameterDefinition(code)

  const [schema] = useState(() => {
    const current = toCurrentValues(parameters)
    return formShape.superRefine((values, context) => {
      const newValue: SystemParameterValue | undefined = isList ? (values.strategies as StrategyType[]) : values.value
      const path = [isList ? 'strategies' : 'value']
      if (newValue === undefined) {
        context.addIssue({ code: 'custom', path, message: 'Vui lòng nhập giá trị mới' })
      } else {
        const error = validateParameterValue(code, newValue, current)
        if (error) context.addIssue({ code: 'custom', path, message: error })
        else if (isSameValue(newValue, parameter.value)) {
          context.addIssue({ code: 'custom', path, message: 'Giá trị mới trùng giá trị đang áp dụng' })
        }
      }
      if (values.reason.trim() === '') context.addIssue({ code: 'custom', path: ['reason'], message: 'Vui lòng nhập lý do' })
    })
  })

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      value: isList ? undefined : (parameter.value as number),
      strategies: isList ? [...(parameter.value as StrategyType[])] : [],
      reason: '',
    },
  })

  function submit(values: FormValues) {
    create.mutate(
      {
        parameter_code: code,
        new_value: isList ? (values.strategies as StrategyType[]) : (values.value as number),
        reason: values.reason.trim(),
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đề xuất thay đổi: {parameter.label}</DialogTitle>
          <DialogDescription>
            Đang áp dụng: {formatParameterValue(code, parameter.value)}. Giới hạn: {formatParameterLimit(definition)}.
            Yêu cầu chờ một người vận hành khác duyệt.
          </DialogDescription>
        </DialogHeader>
        <form noValidate className="flex flex-col gap-4" onSubmit={handleSubmit(submit)}>
          {isList ? (
            <Controller
              control={control}
              name="strategies"
              render={({ field, fieldState }) => (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">Loại lệnh được bật</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {STRATEGY_TYPES.map((type) => {
                      const id = `strategy_${type}`
                      const checked = field.value.includes(type)
                      return (
                        <div key={type} className="flex items-center gap-2">
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(next) =>
                              field.onChange(
                                next === true ? [...field.value, type] : field.value.filter((item) => item !== type),
                              )
                            }
                            onBlur={field.onBlur}
                          />
                          <Label htmlFor={id} className="font-normal">
                            {STRATEGIES[type].label}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                  <FieldError message={fieldState.error?.message} />
                </fieldset>
              )}
            />
          ) : (
            <Controller
              control={control}
              name="value"
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="param_value">Giá trị mới</Label>
                  <NumberInput
                    id="param_value"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    unit={definition.unit ?? undefined}
                    invalid={fieldState.invalid}
                  />
                  <FieldError message={fieldState.error?.message} />
                </div>
              )}
            />
          )}
          <Controller
            control={control}
            name="reason"
            render={({ field, fieldState }) => (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="param_reason">Lý do thay đổi</Label>
                <Textarea id="param_reason" rows={3} aria-invalid={fieldState.invalid} {...field} />
                <FieldError message={fieldState.error?.message} />
              </div>
            )}
          />
          {create.error && (
            <p role="alert" className="text-destructive text-sm">
              {create.error.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={create.isPending} onClick={onClose}>
              Quay lại
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Đang gửi...' : 'Gửi yêu cầu duyệt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
