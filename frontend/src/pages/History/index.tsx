import { useSearchParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '@/components/states'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useHistory } from '@/hooks/useHistory'
import { HistoryTab } from './HistoryTab'
import { HISTORY_TABS, resolveTab } from './tabs'

function HistoryData({ children }: { children: (data: NonNullable<ReturnType<typeof useHistory>['data']>) => React.ReactNode }) {
  const history = useHistory()
  if (history.isPending) return <LoadingState label="Đang tải lịch sử..." />
  if (history.isError) return <ErrorState message={`Không tải được lịch sử: ${history.error.message}`} onRetry={() => void history.refetch()} />
  return <>{children(history.data)}</>
}

/** Lịch sử và đối soát: lịch sử lệnh nhiều phiên. Tab đang mở nhớ trên URL (?tab=). */
export default function History() {
  const [params, setParams] = useSearchParams()
  const tab = resolveTab(params.get('tab'), false)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Lịch sử và đối soát</h1>
        <p className="text-muted-foreground text-sm">Lệnh của 5 phiên gần nhất, kể cả lệnh chạy nhiều phiên.</p>
      </div>
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value }, { replace: true })}>
        <TabsList>
          <TabsTrigger value={HISTORY_TABS.history}>Lịch sử lệnh</TabsTrigger>
        </TabsList>
        <TabsContent value={HISTORY_TABS.history} className="pt-2">
          <HistoryData>{(data) => <HistoryTab data={data} />}</HistoryData>
        </TabsContent>
      </Tabs>
    </div>
  )
}
