import type { ReactNode } from 'react'
import { useHideSensitive } from '@/store/appearance.store'
import { MASK, maskAccount } from '@/utils/sensitive'

const HIDDEN_TITLE = 'Đã ẩn khi trình chiếu (Cài đặt › Giao diện)'

/**
 * Số tiền, bps / slippage so với arrival hoặc VWAP: khi bật ẩn thì hiện "•••" (trình đọc màn hình đọc "đã ẩn").
 * Chỉ đổi phần hiển thị, không đổi dữ liệu hay phép tính.
 */
export function Sensitive({ children }: { children: ReactNode }) {
  const hidden = useHideSensitive()
  if (!hidden) return children
  return (
    <span data-sensitive="hidden" title={HIDDEN_TITLE}>
      <span aria-hidden>{MASK}</span>
      <span className="sr-only">đã ẩn</span>
    </span>
  )
}

/** Số tài khoản: khi bật ẩn thì che giữa, ví dụ 058C•••456. */
export function SensitiveAccount({ value }: { value: string }) {
  const hidden = useHideSensitive()
  if (!hidden) return value
  return (
    <span data-sensitive="hidden" title={HIDDEN_TITLE}>
      {maskAccount(value)}
    </span>
  )
}
