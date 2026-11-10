import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboard } from '@/hooks/useDashboard'
import { usePermission } from '@/hooks/usePermission'
import { formatDate } from '@/lib/format'
import type { DashboardData } from '@/types'
import {
  getAttention,
  getAverageSlippageBps,
  getFilledToday,
  getRecentActivity,
  getRunningStats,
} from '@/utils/dashboard'
import { AttentionTable } from './AttentionTable'
import { KpiCards } from './KpiCards'
import { RecentActivity } from './RecentActivity'

function DashboardBody({ data }: { data: DashboardData }) {
  const attention = getAttention(data.orders, data.children)
  const activity = getRecentActivity(data.events, 10)
  return (
    <>
      <KpiCards
        running={getRunningStats(data.orders)}
        filled={getFilledToday(data)}
        attention={attention}
        slippageBps={getAverageSlippageBps(data)}
      />
      <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2>Lệnh cần chú ý</h2>
            </CardTitle>
            <CardDescription>Lệnh con chưa rõ hoặc bị từ chối, lệnh bị hệ thống tạm dừng.</CardDescription>
          </CardHeader>
          <CardContent>
            {attention.items.length > 0 ? (
              <AttentionTable items={attention.items} />
            ) : (
              <p className="text-muted-foreground py-6 text-center text-sm">Không có lệnh nào cần chú ý.</p>
            )}
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              <h2>Hoạt động gần nhất</h2>
            </CardTitle>
            <CardDescription>10 sự kiện mới nhất trong nhật ký lệnh.</CardDescription>
          </CardHeader>
          <CardContent>
            {activity.length > 0 ? (
              <RecentActivity items={activity} />
            ) : (
              <p className="text-muted-foreground py-6 text-center text-sm">Chưa có hoạt động nào.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

/** Trang mặc định sau đăng nhập: KPI, lệnh cần chú ý, hoạt động gần nhất. */
export default function OrderCenter() {
  const dashboard = useDashboard()
  const hasPermission = usePermission()
  const data = dashboard.data

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Trung tâm lệnh</h1>
          <p className="text-muted-foreground text-sm">
            {data?.trading_date ? `Ngày giao dịch ${formatDate(data.trading_date)}` : 'Tổng quan lệnh của bạn'}
          </p>
        </div>
        {hasPermission('place_order') && (
          <Button asChild>
            <Link to="/dat-lenh">
              <Plus aria-hidden /> Đặt lệnh mới
            </Link>
          </Button>
        )}
      </div>

      {dashboard.isPending && <p className="text-muted-foreground text-sm">Đang tải...</p>}
      {dashboard.error && !data && (
        <p role="alert" className="text-destructive text-sm">
          Không tải được dữ liệu: {dashboard.error.message}
        </p>
      )}
      {data && <DashboardBody data={data} />}
    </div>
  )
}
