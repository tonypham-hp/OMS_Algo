import { useState } from 'react'
import { FieldError } from '@/components/FieldError'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RECON_TYPE_LABELS } from '@/config/reconcile'
import { useReconDecision } from '@/hooks/useHistory'
import type { ReconRow } from '@/types'
import type { DateRange } from '@/utils/dateRange'
import type { ReconStep } from '@/utils/reconcile'

const COPY: Record<ReconStep, { title: string; action: string; pending: string; noteLabel: string; required: boolean; hint: string }> = {
  RESOLVE_REQUESTED: {
    title: 'Đánh dấu đã xử lý',
    action: 'Lưu, chờ duyệt',
    pending: 'Đang lưu...',
    noteLabel: 'Ghi chú xử lý (bắt buộc)',
    required: true,
    hint: 'Một người vận hành khác phải duyệt thì dòng này mới chuyển Đã xử lý (maker-checker).',
  },
  RESOLVED: {
    title: 'Duyệt đã xử lý',
    action: 'Duyệt',
    pending: 'Đang duyệt...',
    noteLabel: 'Ghi chú (không bắt buộc)',
    required: false,
    hint: 'Dòng chuyển Đã xử lý, quyết định được ghi vào nhật ký kiểm toán.',
  },
  RESOLVE_REJECTED: {
    title: 'Từ chối',
    action: 'Từ chối',
    pending: 'Đang từ chối...',
    noteLabel: 'Lý do từ chối (bắt buộc)',
    required: true,
    hint: 'Dòng quay về Mở để xử lý lại.',
  },
}

interface ReconDecisionDialogProps {
  row: ReconRow
  step: ReconStep
  range: DateRange
  onClose: () => void
}

/** Ghi một bước xử lý chênh lệch. Ô ghi chú bắt buộc thì nút lưu bị khóa khi còn trống. */
export function ReconDecisionDialog({ row, step, range, onClose }: ReconDecisionDialogProps) {
  const decide = useReconDecision()
  const [note, setNote] = useState('')
  const [isTouched, setIsTouched] = useState(false)
  const copy = COPY[step]
  const isMissing = copy.required && note.trim() === ''

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {RECON_TYPE_LABELS[row.type]} · {row.child_order_id ?? row.parent_order_id}. OMS: {row.oms_value}; Core: {row.core_value}.
          </DialogDescription>
        </DialogHeader>
        {step !== 'RESOLVE_REQUESTED' && row.note && (
          <p className="bg-muted rounded-md p-2 text-sm">
            Ghi chú của {row.requested_by}: {row.note}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recon-note">{copy.noteLabel}</Label>
          <Textarea
            id="recon-note"
            rows={3}
            value={note}
            aria-invalid={isTouched && isMissing}
            onBlur={() => setIsTouched(true)}
            onChange={(event) => setNote(event.target.value)}
          />
          <FieldError message={isTouched && isMissing ? 'Vui lòng nhập ghi chú' : undefined} />
          <p className="text-muted-foreground text-xs">{copy.hint}</p>
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
            variant={step === 'RESOLVE_REJECTED' ? 'destructive' : 'default'}
            disabled={isMissing || decide.isPending}
            onClick={() => decide.mutate({ ...range, row_id: row.id, step, note }, { onSuccess: onClose })}
          >
            {decide.isPending ? copy.pending : copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
