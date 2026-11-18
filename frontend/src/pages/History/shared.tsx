import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { FilterSelect } from '@/components/FilterSelect'
import { toOptions } from '@/components/filterOptions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TableHead } from '@/components/ui/table'
import { formatDate, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DATE_RANGE_LABELS, resolveDateRange, type DateRangePreset, type DateRangeValue } from '@/utils/dateRange'
import type { SortDirection } from '@/utils/execQuality'
import type { Page } from '@/utils/history'

const PRESET_OPTIONS = toOptions(DATE_RANGE_LABELS)

/** Khoảng ngày: Hôm nay / 5 phiên / Tùy chọn (hai ô ngày). Dưới ô chọn ghi khoảng thật đang áp dụng. */
export function DateRangeFilter({
  idPrefix,
  value,
  onChange,
  tradingDate,
}: {
  idPrefix: string
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  tradingDate: string
}) {
  const range = resolveDateRange(value, tradingDate)
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FilterSelect
        id={`${idPrefix}-range`}
        label="Khoảng ngày"
        value={value.preset}
        options={PRESET_OPTIONS}
        withAll={false}
        onChange={(preset) =>
          onChange(
            preset === 'CUSTOM'
              ? { preset, from: value.from || range.from, to: value.to || range.to }
              : { ...value, preset: preset as DateRangePreset },
          )
        }
      />
      {value.preset === 'CUSTOM' ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-from`}>Từ ngày</Label>
            <Input id={`${idPrefix}-from`} type="date" className="w-40" value={value.from} max={tradingDate} onChange={(event) => onChange({ ...value, from: event.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-to`}>Đến ngày</Label>
            <Input id={`${idPrefix}-to`} type="date" className="w-40" value={value.to} max={tradingDate} onChange={(event) => onChange({ ...value, to: event.target.value })} />
          </div>
        </>
      ) : (
        <p className="text-muted-foreground pb-2 text-xs tabular-nums">
          {range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`}
        </p>
      )}
    </div>
  )
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  if (!active) return <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />
  return direction === 'asc' ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />
}

/** Tiêu đề cột bấm được để sắp xếp, có aria-sort. */
export function SortableHead({
  label,
  active,
  direction,
  numeric,
  onSort,
  children,
}: {
  label: string
  active: boolean
  direction: SortDirection
  numeric?: boolean
  onSort: () => void
  /** Bọc nút (vd Term) nếu cần. */
  children?: (button: ReactNode) => ReactNode
}) {
  const button = (
    <button
      type="button"
      onClick={onSort}
      className={cn('hover:text-foreground inline-flex items-center gap-1', numeric && 'flex-row-reverse', active && 'text-foreground')}
    >
      {label}
      <SortIcon active={active} direction={direction} />
    </button>
  )
  return (
    <TableHead aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn(numeric && 'text-right')}>
      {children ? children(button) : button}
    </TableHead>
  )
}

/** Phân trang: "Dòng 1–50 / 120", nút trang trước, trang sau. Một trang thì chỉ ghi số dòng. */
export function Pagination<T>({ page, onPage, label }: { page: Page<T>; onPage: (page: number) => void; label: string }) {
  const start = (page.page - 1) * page.size + 1
  const end = start + page.rows.length - 1
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-muted-foreground tabular-nums">
        {page.total === 0 ? 'Không có dòng nào' : `Dòng ${formatNumber(start)}–${formatNumber(end)} / ${formatNumber(page.total)}`}
      </p>
      {page.pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page.page <= 1} onClick={() => onPage(page.page - 1)} aria-label="Trang trước">
            <ChevronLeft aria-hidden />
          </Button>
          <span className="tabular-nums">
            Trang {page.page}/{page.pageCount}
          </span>
          <Button variant="outline" size="sm" disabled={page.page >= page.pageCount} onClick={() => onPage(page.page + 1)} aria-label="Trang sau">
            <ChevronRight aria-hidden />
          </Button>
        </div>
      )}
    </nav>
  )
}


/** Mã lệnh con trong bảng đã có cột lệnh cha: chỉ hiện phần đuôi (CH003), mã đầy đủ ở tooltip và cho trình đọc màn hình. */
export function ChildId({ id }: { id: string | null }) {
  if (!id) return <span aria-label="Không có lệnh con">—</span>
  const suffix = id.split('-').at(-1) ?? id
  return (
    <span title={id} aria-label={id} className="tabular-nums">
      {suffix}
    </span>
  )
}
