import { SESSION_LABELS } from '@/config/hose'
import { useMarketStore } from '@/store/market.store'
import { isModifyCancelAllowed } from '@/utils/hose'

/** Báo đang trong ATO, ATC nên tạm khóa Sửa và Hủy. Ngoài hai phiên này không hiện gì. */
export function SessionLockNotice() {
  const session = useMarketStore((state) => state.session)
  if (isModifyCancelAllowed(session)) return null
  return (
    <p role="status" className="rounded-md bg-amber-500/15 p-2 text-sm text-amber-300">
      Đang trong {SESSION_LABELS[session]}: tạm khóa Sửa và Hủy lệnh theo luật HOSE.
    </p>
  )
}
