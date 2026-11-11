import { formatNumber } from '@/lib/format'
import { formatParticipation, NO_VALUE, type ReportKpis as ReportKpiValues } from '@/utils/execQuality'

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-card flex flex-col gap-1 rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-xs">{note}</p>
    </div>
  )
}

export function ReportKpis({ kpis }: { kpis: ReportKpiValues }) {
  const ratio = kpis.measuredVsArrival > 0 ? `${kpis.betterThanArrival} / ${kpis.measuredVsArrival}` : NO_VALUE
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Lệnh đã hoàn tất" value={formatNumber(kpis.completed)} note="Trong khoảng thời gian và bộ lọc đang chọn" />
      <Kpi label="Tổng KL khớp" value={formatNumber(kpis.totalFilled)} note="Cổ phiếu, chỉ tính lệnh vào" />
      <Kpi
        label="Lệnh tốt hơn arrival"
        value={ratio}
        note="Mua thấp hơn hoặc bán cao hơn giá lúc kích hoạt, trên số lệnh đã có khớp"
      />
      <Kpi
        label="Tỷ lệ tham gia TB"
        value={formatParticipation(kpis.avgParticipation)}
        note="Trung bình KL lệnh / KL toàn thị trường cùng khoảng"
      />
    </div>
  )
}
