import { useState } from 'react'
import { ErrorState, LoadingState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  canDecideRequest,
  CHANGE_STATUS_STYLES,
  DATA_TYPE_LABELS,
  formatParameterLimit,
  formatParameterValue,
  getParameterDefinition,
  SCOPE_LABELS,
} from '@/config/systemParams'
import { useSystemParameters } from '@/hooks/useSystemConfig'
import { formatDateTime } from '@/lib/format'
import { useAuthStore } from '@/store/auth.store'
import type { ParameterChangeRequest, SystemParameter } from '@/types'
import { ChangeRequestDialog } from './ChangeRequestDialog'
import { DecisionDialog } from './DecisionDialog'

type Decision = { request: ParameterChangeRequest; decision: 'APPROVE' | 'REJECT' }

export function ParameterTable() {
  const parameters = useSystemParameters()
  const username = useAuthStore((state) => state.user?.username)
  const [editing, setEditing] = useState<SystemParameter | null>(null)
  const [deciding, setDeciding] = useState<Decision | null>(null)

  if (parameters.isPending) return <LoadingState />
  if (parameters.error) {
    return (
      <ErrorState
        message={`Không tải được tham số: ${parameters.error.message}`}
        onRetry={() => void parameters.refetch()}
      />
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tham số</TableHead>
            <TableHead>Kiểu, giới hạn</TableHead>
            <TableHead className="text-right">Giá trị hiện tại</TableHead>
            <TableHead>Sửa gần nhất</TableHead>
            <TableHead>Yêu cầu chờ duyệt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parameters.data.map((parameter) => {
            const pending = parameter.pending_request
            const code = parameter.parameter_code
            return (
              <TableRow key={code} data-parameter={code} className="align-top">
                <TableCell className="max-w-sm whitespace-normal">
                  <p className="font-medium">{parameter.label}</p>
                  <p className="text-muted-foreground font-mono text-xs">{code}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{parameter.description}</p>
                </TableCell>
                <TableCell className="text-xs whitespace-normal">
                  <p>{DATA_TYPE_LABELS[parameter.data_type]}</p>
                  <p className="text-muted-foreground">{formatParameterLimit(getParameterDefinition(code))}</p>
                  <p className="text-muted-foreground">{SCOPE_LABELS[parameter.scope]}</p>
                </TableCell>
                <TableCell className="max-w-48 text-right font-semibold whitespace-normal tabular-nums">
                  {formatParameterValue(code, parameter.value)}
                </TableCell>
                <TableCell className="text-xs whitespace-normal">
                  {parameter.updated_at ? (
                    <>
                      <p>Tạo: {parameter.updated_by}</p>
                      <p>Duyệt: {parameter.approved_by}</p>
                      <p className="text-muted-foreground tabular-nums">{formatDateTime(parameter.updated_at)}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Giá trị mặc định</p>
                  )}
                </TableCell>
                <TableCell className="min-w-56 text-xs whitespace-normal">
                  {pending ? (
                    <div className="flex flex-col gap-1">
                      <Badge className={CHANGE_STATUS_STYLES.PENDING.className}>{CHANGE_STATUS_STYLES.PENDING.label}</Badge>
                      <p>
                        Giá trị mới: <span className="font-semibold">{formatParameterValue(code, pending.new_value)}</span>
                      </p>
                      <p>Người tạo: {pending.maker}</p>
                      <p className="text-muted-foreground">Lý do: {pending.reason}</p>
                      {canDecideRequest(pending, username) ? (
                        <div className="mt-1 flex gap-2">
                          <Button size="sm" onClick={() => setDeciding({ request: pending, decision: 'APPROVE' })}>
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeciding({ request: pending, decision: 'REJECT' })}
                          >
                            Từ chối
                          </Button>
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic">Bạn tạo yêu cầu này, đang chờ người khác duyệt.</p>
                      )}
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditing(parameter)}>
                      Đề xuất thay đổi
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      {editing && (
        <ChangeRequestDialog parameter={editing} parameters={parameters.data} onClose={() => setEditing(null)} />
      )}
      {deciding && (
        <DecisionDialog request={deciding.request} decision={deciding.decision} onClose={() => setDeciding(null)} />
      )}
    </>
  )
}
