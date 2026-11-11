import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { OrderDetailData, ParentOrder } from '@/types'
import {
  favorableClass,
  formatDiffPct,
  formatFavorableBps,
  formatParticipation,
  formatQualityPrice,
  getExecQuality,
  NO_VALUE,
} from '@/utils/execQuality'

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{children}</dd>
    </div>
  )
}

const withUnit = (text: string) => (text === NO_VALUE ? text : `${text} đ`)

/** Thẻ nhỏ "Hiệu quả": cùng hàm với báo cáo hiệu quả thực hiện, nên số liệu khớp với bảng báo cáo. */
export function ExecQualityCard({ order, detail }: { order: ParentOrder; detail: OrderDetailData }) {
  const quality = getExecQuality(order, detail.children, detail.executions, detail.snapshot, detail.market)
  const hasFills = quality.filledQty > 0

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>Hiệu quả</h2>
        </CardTitle>
        <CardDescription>
          {hasFills
            ? 'So với giá lúc kích hoạt và VWAP toàn thị trường từ lúc kích hoạt tới lúc hoàn tất (hoặc hiện tại).'
            : 'Chưa có khớp.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Giá BQ">{withUnit(formatQualityPrice(quality.avgPrice))}</Stat>
          <Stat label="Arrival">{withUnit(formatQualityPrice(quality.arrivalPrice))}</Stat>
          <Stat label="VWAP">{withUnit(formatQualityPrice(quality.vwap))}</Stat>
          <Stat label="So arrival">
            <span className={favorableClass(quality.arrivalFavorable)}>
              {formatDiffPct(quality.vsArrivalPct)}
              {quality.arrivalBps !== null && <span className="ml-1 text-xs">({formatFavorableBps(quality.arrivalBps)})</span>}
            </span>
          </Stat>
          <Stat label="Tham gia">{formatParticipation(quality.participation)}</Stat>
        </dl>
      </CardContent>
    </Card>
  )
}
