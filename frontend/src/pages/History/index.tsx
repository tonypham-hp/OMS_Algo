import { useSearchParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '@/components/states'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useHistory } from '@/hooks/useHistory'
import { usePermission } from '@/hooks/usePermission'
import { AuditTab } from './AuditTab'
import { HistoryTab } from './HistoryTab'
import { ReconTab } from './ReconTab'
import { HISTORY_TABS, resolveTab } from './tabs'

function HistoryData({ children }: { children: (data: NonNullable<ReturnType<typeof useHistory>['data']>) => React.ReactNode }) {
  const history = useHistory()
  if (history.isPending) return <LoadingState label="Đang tải lịch sử..." />
  if (history.isError) return <ErrorState message={`Không tải được lịch sử: ${history.error.message}`} onRetry={() => void history.refetch()} />
  return <>{children(history.data)}</>
}

/** Lịch sử và đối soát: lịch sử lệnh nhiều phiên, nhật ký kiểm toán, đối soát OMS với Core (DEALER, OPS). Tab đang mở nhớ trên URL (?tab=). */
export default function History() {
  const [params, setParams] = useSearchParams()
  const canReconcile = usePermission()('reconciliation')
  const tab = resolveTab(params.get('tab'), canReconcile)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Lịch sử và đối soát</h1>
        <p className="text-muted-foreground text-sm">Lệnh của 5 phiên gần nhất, kể cả lệnh chạy nhiều phiên.</p>
      </div>
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList>
          <TabsTrigger value={HISTORY_TABS.history}>Lịch sử lệnh</TabsTrigger>
          <TabsTrigger value={HISTORY_TABS.audit}>Nhật ký kiểm toán</TabsTrigger>
          {canReconcile && <TabsTrigger value={HISTORY_TABS.recon}>Đối soát</TabsTrigger>}
        </TabsList>
        <TabsContent value={HISTORY_TABS.history} className="pt-2">
          <HistoryData>{(data) => <HistoryTab data={data} />}</HistoryData>
        </TabsContent>
        <TabsContent value={HISTORY_TABS.audit} className="pt-2">
          <HistoryData>{(data) => <AuditTab data={data} />}</HistoryData>
        </TabsContent>
        {canReconcile && (
          <TabsContent value={HISTORY_TABS.recon} className="pt-2">
            <HistoryData>{(data) => <ReconTab tradingDate={data.trading_date} />}</HistoryData>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
