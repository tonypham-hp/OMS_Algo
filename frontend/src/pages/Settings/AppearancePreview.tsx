import { OrderStatusBadge } from '@/components/OrderStatusBadge'
import { PriceMark } from '@/components/PriceDirection'
import { Sensitive, SensitiveAccount } from '@/components/Sensitive'
import type { ThemeName } from '@/config/theme'
import { PRICE_COLOR, priceChipClass, type PriceLevel } from '@/config/priceColors'
import { formatBps, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Density, PaletteName } from '@/theme/appearance'

/** Một hàng bảng giá mẫu đủ 5 mức (trần, tăng, tham chiếu, giảm, sàn), giá tròn để dễ nhìn. */
const PREVIEW_PRICES: ReadonlyArray<{ level: PriceLevel; price: number; label: string }> = [
  { level: 'ceiling', price: 107_000, label: 'Trần' },
  { level: 'up', price: 101_500, label: 'Tăng' },
  { level: 'ref', price: 100_000, label: 'TC' },
  { level: 'down', price: 98_500, label: 'Giảm' },
  { level: 'floor', price: 93_000, label: 'Sàn' },
]

interface AppearancePreviewProps {
  /** Có thì khung xem trước dùng theme / bảng màu này (biến CSS đặt lại trong khung); không có thì theo giao diện hiện tại. */
  theme?: ThemeName
  palette?: PaletteName
  /** Xem trước cỡ chữ: thu phóng riêng khung này, so với cỡ đang dùng (ví dụ 90/100 = 0,9). */
  zoom?: number
  /** Xem trước mật độ: thêm bảng nhỏ 3 hàng với khoảng cách hàng tương ứng. */
  density?: Density
  /** Hiện thêm bps và số tài khoản (xem trước tùy chọn che số khi trình chiếu). */
  showSensitive?: boolean
  className?: string
}

/**
 * Xem trước: 5 màu giá kèm ký hiệu, nút Mua/Bán, nhãn trạng thái. Chỉ để nhìn, không bấm được
 * (aria-hidden ở nút để trình đọc màn hình không đọc thành nút thật).
 */
export function AppearancePreview({ theme, palette, zoom, density, showSensitive = false, className }: AppearancePreviewProps) {
  return (
    <div
      data-theme={theme}
      data-palette={theme ? palette : undefined}
      data-testid="appearance-preview"
      style={zoom && zoom !== 1 ? { zoom } : undefined}
      className={cn('bg-surface text-text border-border flex flex-col gap-2 rounded-md border p-2 text-xs', className)}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-text font-semibold">FPT</span>
        {PREVIEW_PRICES.map((item) => (
          <span key={item.level} className="flex items-baseline gap-1">
            <span className="text-text-muted">{item.label}</span>
            <span className={cn('rounded px-1 font-semibold tabular-nums', PRICE_COLOR[item.level], priceChipClass(item.level))}>
              {formatNumber(item.price)}
              <PriceMark level={item.level} />
            </span>
          </span>
        ))}
      </div>
      {density && (
        <table className="w-full tabular-nums" data-density-preview={density}>
          <tbody>
            {PREVIEW_PRICES.slice(1, 4).map((item) => (
              <tr key={item.level} className="border-border border-t">
                {/* Khoảng cách hàng giống bảng thật ở mật độ này (index.css, [data-density="compact"]). */}
                <td className={cn('px-2', density === 'compact' ? 'py-0.5' : 'py-2')}>FPT</td>
                <td className={cn('px-2 text-right font-semibold', density === 'compact' ? 'py-0.5' : 'py-2', PRICE_COLOR[item.level])}>
                  {formatNumber(item.price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span aria-hidden className="bg-buy text-buy-fg rounded px-2 py-0.5 font-medium">
          Mua
        </span>
        <span aria-hidden className="bg-sell text-sell-fg rounded px-2 py-0.5 font-medium">
          Bán
        </span>
        <OrderStatusBadge status="ACTIVE" />
        <OrderStatusBadge status="COMPLETED" />
        <OrderStatusBadge status="PAUSED_SYSTEM" />
        {showSensitive && (
          <span className="text-text-muted tabular-nums">
            Slippage <Sensitive>{formatBps(-12.5)}</Sensitive> · TK <SensitiveAccount value="058C123456" />
          </span>
        )}
      </div>
    </div>
  )
}
