import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChangeHistory } from './ChangeHistory'
import { ParameterTable } from './ParameterTable'

export default function StrategyConfig() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Cấu hình strategy</h1>
        </CardTitle>
        <CardDescription>
          Tham số hệ thống mà engine đang dùng. Mỗi thay đổi cần một người vận hành khác duyệt mới có hiệu lực, và chỉ áp
          cho quyết định mới: lệnh đã chạy không bị sửa ngược.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="parameters">
          <TabsList>
            <TabsTrigger value="parameters">Tham số</TabsTrigger>
            <TabsTrigger value="history">Lịch sử thay đổi</TabsTrigger>
          </TabsList>
          <TabsContent value="parameters" className="pt-4">
            <ParameterTable />
          </TabsContent>
          <TabsContent value="history" className="pt-4">
            <ChangeHistory />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
