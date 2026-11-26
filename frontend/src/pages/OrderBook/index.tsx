import { useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OrderBlotter } from './OrderBlotter'
import { PutThroughTab } from './PutThroughTab'

export default function OrderBook() {
  // Tab đang mở nằm trên URL (?tab=thoa-thuan) để tải lại trang vẫn giữ.
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'thoa-thuan' ? 'thoa-thuan' : 'lenh'
  const changeTab = (next: string) =>
    setSearchParams(
      (params) => {
        if (next === 'lenh') params.delete('tab')
        else params.set('tab', next)
        return params
      },
      { replace: true },
    )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Sổ lệnh nâng cao</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList>
            <TabsTrigger value="lenh">Lệnh</TabsTrigger>
            <TabsTrigger value="thoa-thuan">Thỏa thuận</TabsTrigger>
          </TabsList>
          <TabsContent value="thoa-thuan" className="pt-4">
            <PutThroughTab />
          </TabsContent>
          <TabsContent value="lenh" className="pt-4">
            <OrderBlotter />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
