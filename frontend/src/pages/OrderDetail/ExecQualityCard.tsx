import type { ReactNode } from 'react'
import { Sensitive } from '@/components/Sensitive'
import { Term } from '@/components/Term'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { OrderDetailData, ParentOrder } from '@/types'
import {
  favorableClass,
  formatDiffPct,
  formatParticipation,
  formatQualityPrice,
  getExecQuality,
  NO_VALUE,
} from '@/utils/execQuality'

function Stat({ label, children }: { label: ReactNode; children: ReactNode }) {
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
    <Card className="min-w-0" data-demo-id="exec-quality">
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
          <Stat label={<Term id="arrival">Arrival</Term>}>{withUnit(formatQualityPrice(quality.arrivalPrice))}</Stat>
          <Stat label={<Term id="vwap">VWAP</Term>}>{withUnit(formatQualityPrice(quality.vwap))}</Stat>
          <Stat label={<>So <Term id="arrival">arrival</Term></>}>
            <span className={favorableClass(quality.arrivalFavorable)}>
              <Sensitive>{formatDiffPct(quality.vsArrivalPct)}</Sensitive>
              {/* Ghi chữ thay vì bps: phần tóm tắt phía trên đã ghi bps theo quy ước cũ (dương là giá cao hơn arrival). */}
              {quality.arrivalFavorable !== null && (
                <span className="ml-1 text-xs">{quality.arrivalFavorable ? 'có lợi' : 'bất lợi'}</span>
              )}
            </span>
          </Stat>
          <Stat label={<Term id="participation">Tham gia</Term>}>{formatParticipation(quality.participation)}</Stat>
        </dl>
      </CardContent>
    </Card>
  )
}
