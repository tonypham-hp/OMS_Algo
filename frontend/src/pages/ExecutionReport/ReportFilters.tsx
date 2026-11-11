import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import type { Side, StrategyType } from '@/types'
import {
  ALL,
  DEFAULT_REPORT_FILTERS,
  REPORT_PERIOD_LABELS,
  REPORT_STATUS_LABELS,
  type ReportFilters as ReportFilterValues,
} from '@/utils/execQuality'

interface Option {
  value: string
  label: string
}

const toOptions = <T extends string>(labels: Record<T, string>): Option[] =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))

const PERIOD_OPTIONS = toOptions(REPORT_PERIOD_LABELS)
const STATUS_OPTIONS = toOptions(REPORT_STATUS_LABELS)
const SIDE_OPTIONS = (Object.keys(SIDE_LABELS) as Side[]).map((side) => ({ value: side as string, label: SIDE_LABELS[side] }))

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  withAll = true,
}: {
  id: string
  label: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  /** Có mục "Tất cả" ở đầu danh sách. */
  withAll?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-40">
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

interface ReportFiltersProps {
  filters: ReportFilterValues
  onChange: (filters: ReportFilterValues) => void
  symbols: string[]
  strategies: StrategyType[]
  /** Rỗng thì ẩn ô lọc tài khoản (khách hàng chỉ có một tài khoản). */
  accounts: string[]
}

export function ReportFilters({ filters, onChange, symbols, strategies, accounts }: ReportFiltersProps) {
  const set = (key: keyof ReportFilterValues) => (value: string) => onChange({ ...filters, [key]: value })
  const plain = (values: string[]) => values.map((value) => ({ value, label: value }))
  const strategyOptions = strategies.map((type) => ({ value: type as string, label: STRATEGIES[type].label }))

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect id="report-period" label="Khoảng thời gian" value={filters.period} options={PERIOD_OPTIONS} onChange={set('period')} withAll={false} />
      <FilterSelect id="report-status" label="Trạng thái" value={filters.status} options={STATUS_OPTIONS} onChange={set('status')} withAll={false} />
      <FilterSelect id="report-strategy" label="Chiến lược" value={filters.strategy_type} options={strategyOptions} onChange={set('strategy_type')} />
      <FilterSelect id="report-side" label="Chiều" value={filters.side} options={SIDE_OPTIONS} onChange={set('side')} />
      <FilterSelect id="report-symbol" label="Mã CK" value={filters.symbol} options={plain(symbols)} onChange={set('symbol')} />
      {accounts.length > 0 && (
        <FilterSelect id="report-account" label="Tài khoản" value={filters.account_no} options={plain(accounts)} onChange={set('account_no')} />
      )}
      <Button variant="ghost" onClick={() => onChange(DEFAULT_REPORT_FILTERS)}>
        Bỏ lọc
      </Button>
    </div>
  )
}
