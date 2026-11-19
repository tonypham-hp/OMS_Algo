import { Badge } from '@/components/ui/badge'
import { SESSION_LABELS } from '@/config/hose'
import { defaultRules } from '@/rules/registry'
import { useMarketStore } from '@/store/market.store'
import { isModifyCancelAllowed } from '@/utils/hose'

/**
 * Báo đang trong ATO, ATC nên tạm khóa Sửa và Hủy. Ngoài hai phiên này không hiện gì.
 * Quy tắc này chưa kiểm chứng với KRX (cờ AMEND_CANCEL_IN_AUCTION_LOCK của pack) nên có nhãn kèm theo.
 */
export function SessionLockNotice() {
  const session = useMarketStore((state) => state.session)
  if (isModifyCancelAllowed(session)) return null
  const flag = defaultRules().flags.AMEND_CANCEL_IN_AUCTION_LOCK
  return (
    <p role="status" className="flex flex-wrap items-center gap-2 rounded-md bg-amber-500/15 p-2 text-sm text-amber-300">
      Đang trong {SESSION_LABELS[session]}: tạm khóa Sửa và Hủy lệnh theo luật HOSE.
      {flag && !flag.verified && (
        <Badge variant="secondary" title={flag.note}>
          {flag.label}
        </Badge>
      )}
    </p>
  )
}
