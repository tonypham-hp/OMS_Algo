import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ALL } from '@/utils/execQuality'
import type { FilterOption } from './filterOptions'

/** Ô chọn lọc có nhãn, dùng ở Báo cáo hiệu quả và Lịch sử và đối soát. */
export function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  withAll = true,
  className,
}: {
  id: string
  label: string
  value: string
  options: FilterOption[]
  onChange: (value: string) => void
  /** Có mục "Tất cả" ở đầu danh sách. */
  withAll?: boolean
  className?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className={cn('w-40', className)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {withAll && <SelectItem value={ALL}>Tất cả</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
