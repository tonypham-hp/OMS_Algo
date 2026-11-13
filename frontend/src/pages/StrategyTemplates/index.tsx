import { ArrowRight, LayoutTemplate } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { SIDE_LABELS, STRATEGIES } from '@/config/strategies'
import { useOrderRules } from '@/hooks/useSystemConfig'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { useMarketStore } from '@/store/market.store'
import { useUiStore } from '@/store/ui.store'
import { describeTemplateParams, getVisibleTemplates } from '@/utils/strategyTemplates'

/** Trang Mẫu chiến lược: lưới thẻ mẫu, "Dùng mẫu này" mở màn Đặt lệnh đã điền sẵn (qua ?mau=<id>). */
export default function StrategyTemplates() {
  const navigate = useNavigate()
  const role = useAuthStore((state) => state.user?.role)
  const enabled = useOrderRules().data?.enabledStrategies
  const selectedSymbol = useUiStore((state) => state.selectedSymbol)
  const quote = useMarketStore((state) => state.quotes.find((item) => item.symbol === selectedSymbol))
  const nowSeconds = useMarketStore((state) => state.sim_seconds)
  const templates = getVisibleTemplates(role, enabled)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Mẫu chiến lược</h1>
        <p className="text-muted-foreground text-sm">
          Chọn một mẫu để mở màn Đặt lệnh đã điền sẵn loại lệnh và tham số. Bạn vẫn sửa được mọi ô và lệnh chỉ được gửi khi bấm
          Đặt lệnh.{quote && ` Giá minh họa theo mã ${quote.symbol} đang chọn.`}
        </p>
      </div>
      {templates.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="Không có mẫu nào cho vai trò hoặc loại lệnh đang bật" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-demo-id="template-grid">
          {templates.map((template) => {
            const params = describeTemplateParams(template, quote, nowSeconds)
            return (
              <Card key={template.id} data-demo-id={`template-card-${template.id}`}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <span>{template.name}</span>
                    <Badge variant="secondary">{STRATEGIES[template.strategy_type].label}</Badge>
                    {template.side && (
                      <Badge className={cn(template.side === 'BUY' ? 'bg-price-up/15 text-price-up' : 'bg-price-down/15 text-price-down')}>
                        {SIDE_LABELS[template.side]}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {template.total_qty !== undefined && (
                      <>
                        <dt className="text-muted-foreground">Khối lượng</dt>
                        <dd className="text-right tabular-nums">{formatNumber(template.total_qty)} CP</dd>
                      </>
                    )}
                    {params.map((row) => (
                      <div key={row.label} className="contents">
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className="text-right tabular-nums">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p>
                    <span className="font-medium">Phù hợp khi: </span>
                    {template.suitableWhen}
                  </p>
                  {template.hint && <p className="text-muted-foreground text-xs">Lưu ý: {template.hint}</p>}
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={() => navigate(`/dat-lenh?mau=${template.id}`)}>
                    Dùng mẫu này
                    <ArrowRight aria-hidden />
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
