import { useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CHANGE_STATUS_STYLES, formatParameterValue, getParameterDefinition, SYSTEM_PARAMETERS } from '@/config/systemParams'
import { useChangeRequests } from '@/hooks/useSystemConfig'
import { formatDateTime } from '@/lib/format'
import type { ChangeRequestFilter, ChangeRequestStatus, SystemParameterCode } from '@/types'

/** Radix Select không nhận giá trị rỗng, nên "Tất cả" dùng một giá trị riêng. */
const ALL = 'ALL'
const STATUSES = Object.keys(CHANGE_STATUS_STYLES) as ChangeRequestStatus[]

interface FilterSelectProps {
  id: string
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

function FilterSelect({ id, label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="flex min-w-48 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
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

export function ChangeHistory() {
  const [parameter, setParameter] = useState(ALL)
  const [user, setUser] = useState(ALL)
  const [status, setStatus] = useState(ALL)
  const filter: ChangeRequestFilter = {
    parameter_code: parameter === ALL ? undefined : (parameter as SystemParameterCode),
    user: user === ALL ? undefined : user,
    status: status === ALL ? undefined : (status as ChangeRequestStatus),
  }
  const requests = useChangeRequests(filter)
  // Danh sách người để lọc lấy từ toàn bộ lịch sử, không phụ thuộc bộ lọc đang chọn.
  const everything = useChangeRequests({})
  const users = [
    ...new Set((everything.data ?? []).flatMap((item) => [item.maker, item.checker]).filter((name) => name !== null)),
  ].sort()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <FilterSelect
          id="history_parameter"
          label="Tham số"
          value={parameter}
          onChange={setParameter}
          options={SYSTEM_PARAMETERS.map((item) => ({ value: item.code, label: item.label }))}
        />
        <FilterSelect
          id="history_user"
          label="Người tạo hoặc duyệt"
          value={user}
          onChange={setUser}
          options={users.map((name) => ({ value: name, label: name }))}
        />
        <FilterSelect
          id="history_status"
          label="Trạng thái"
          value={status}
          onChange={setStatus}
          options={STATUSES.map((item) => ({ value: item, label: CHANGE_STATUS_STYLES[item].label }))}
        />
      </div>

      {requests.isPending && <LoadingState />}
      {requests.error && <ErrorState message={`Không tải được lịch sử: ${requests.error.message}`} />}
      {requests.data?.length === 0 && <EmptyState title="Chưa có thay đổi nào khớp bộ lọc." />}
      {requests.data && requests.data.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã</TableHead>
              <TableHead>Tham số</TableHead>
              <TableHead>Giá trị cũ → mới</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Người tạo, lý do</TableHead>
              <TableHead>Người duyệt, ghi chú</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.data.map((item) => {
              const code = item.parameter_code
              const style = CHANGE_STATUS_STYLES[item.status]
              return (
                <TableRow key={item.request_id} data-request={item.request_id} className="align-top">
                  <TableCell className="font-mono text-xs">{item.request_id}</TableCell>
                  <TableCell className="whitespace-normal">{getParameterDefinition(code).label}</TableCell>
                  <TableCell className="max-w-64 whitespace-normal tabular-nums">
                    {formatParameterValue(code, item.old_value)} → {formatParameterValue(code, item.new_value)}
                  </TableCell>
                  <TableCell>
                    <Badge className={style.className}>{style.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs whitespace-normal">
                    <p>{item.maker}</p>
                    <p className="text-muted-foreground tabular-nums">{formatDateTime(item.created_at)}</p>
                    <p className="mt-1">{item.reason}</p>
                  </TableCell>
                  <TableCell className="text-xs whitespace-normal">
                    {item.checker ? (
                      <>
                        <p>{item.checker}</p>
                        {item.decided_at && (
                          <p className="text-muted-foreground tabular-nums">{formatDateTime(item.decided_at)}</p>
                        )}
                        {item.note && <p className="mt-1">{item.note}</p>}
                      </>
                    ) : (
                      <p className="text-muted-foreground">Chưa duyệt</p>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
