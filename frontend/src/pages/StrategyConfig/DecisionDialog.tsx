import { useState } from 'react'
import { FieldError } from '@/components/FieldError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatParameterValue, getParameterDefinition } from '@/config/systemParams'
import { useDecideChangeRequest } from '@/hooks/useSystemConfig'
import type { ParameterChangeRequest } from '@/types'

interface DecisionDialogProps {
  request: ParameterChangeRequest
  decision: 'APPROVE' | 'REJECT'
  onClose: () => void
}

/** Người duyệt (khác người tạo) Duyệt hoặc Từ chối. Từ chối bắt buộc ghi chú, Duyệt thì không. */
export function DecisionDialog({ request, decision, onClose }: DecisionDialogProps) {
  const decide = useDecideChangeRequest()
  const [note, setNote] = useState('')
  const [isTouched, setIsTouched] = useState(false)
  const isApprove = decision === 'APPROVE'
  const missingNote = !isApprove && note.trim() === ''
  const code = request.parameter_code

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isApprove ? 'Duyệt' : 'Từ chối'} thay đổi {getParameterDefinition(code).label}?
          </DialogTitle>
          <DialogDescription>
            {formatParameterValue(code, request.old_value)} → {formatParameterValue(code, request.new_value)}. Người tạo{' '}
            {request.maker}, lý do: {request.reason}.
            {isApprove && ' Giá trị mới áp dụng ngay cho các quyết định mới của engine.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="decision_note">Ghi chú{isApprove ? ' (không bắt buộc)' : ''}</Label>
          <Textarea
            id="decision_note"
            rows={3}
            value={note}
            aria-invalid={isTouched && missingNote}
            onBlur={() => setIsTouched(true)}
            onChange={(event) => setNote(event.target.value)}
          />
          <FieldError message={isTouched && missingNote ? 'Vui lòng nhập ghi chú khi từ chối' : undefined} />
        </div>
        {decide.error && (
          <p role="alert" className="text-destructive text-sm">
            {decide.error.message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={decide.isPending} onClick={onClose}>
            Quay lại
          </Button>
          <Button
            variant={isApprove ? 'default' : 'destructive'}
            disabled={missingNote || decide.isPending}
            onClick={() => decide.mutate({ requestId: request.request_id, decision, note }, { onSuccess: onClose })}
          >
            {decide.isPending ? 'Đang xử lý...' : isApprove ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
