import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PARENT_STATUS_STYLES } from '@/config/orderStatus'
import { SIDE_LABELS, STRATEGIES, STRATEGY_TYPES } from '@/config/strategies'
import type { ParentOrderStatus, Side } from '@/types'
import { ALL, EMPTY_FILTERS, type OrderFilterValues } from './filterOrders'

interface OrderFiltersProps {
  filters: OrderFilterValues
  onChange: (filters: OrderFilterValues) => void
  symbols: string[]
  /** Danh sách tài khoản. Rỗng thì ẩn ô lọc này (khách hàng chỉ có một tài khoản). */
  accounts: string[]
}

const STATUS_OPTIONS = (Object.keys(PARENT_STATUS_STYLES) as ParentOrderStatus[]).map((status) => ({
  value: status as string,
  label: PARENT_STATUS_STYLES[status].label,
}))
const SIDE_OPTIONS = (Object.keys(SIDE_LABELS) as Side[]).map((side) => ({
  value: side as string,
  label: SIDE_LABELS[side],
}))
const STRATEGY_OPTIONS = STRATEGY_TYPES.map((type) => ({
  value: type as string,
  label: STRATEGIES[type].label,
}))

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tất cả</SelectItem>
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

export function OrderFilters({ filters, onChange, symbols, accounts }: OrderFiltersProps) {
  const set = (key: keyof OrderFilterValues) => (value: string) => onChange({ ...filters, [key]: value })
  const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }))

  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect id="filter-status" label="Trạng thái" value={filters.status} options={STATUS_OPTIONS} onChange={set('status')} />
      <FilterSelect id="filter-symbol" label="Mã" value={filters.symbol} options={toOptions(symbols)} onChange={set('symbol')} />
      <FilterSelect id="filter-side" label="Chiều" value={filters.side} options={SIDE_OPTIONS} onChange={set('side')} />
      <FilterSelect id="filter-strategy" label="Loại lệnh" value={filters.strategy_type} options={STRATEGY_OPTIONS} onChange={set('strategy_type')} />
      {accounts.length > 0 && (
        <FilterSelect id="filter-account" label="Tài khoản" value={filters.account_no} options={toOptions(accounts)} onChange={set('account_no')} />
      )}
      <Button variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
        Xóa lọc
      </Button>
    </div>
  )
}
