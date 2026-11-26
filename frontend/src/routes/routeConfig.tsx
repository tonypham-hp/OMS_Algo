/* eslint-disable react-refresh/only-export-components -- file cấu hình route, không phải module component */
import { lazy, type ComponentType } from 'react'
import type { RouteObject } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { LazyLoader } from './LazyLoader'
import { LoginRoute } from './LoginRoute'
import { PermissionRoute } from './PermissionRoute'
import { ProtectedRoute } from './ProtectedRoute'

const Login = lazy(() => import('@/pages/Login'))
const OrderCenter = lazy(() => import('@/pages/OrderCenter'))
const PlaceOrder = lazy(() => import('@/pages/PlaceOrder'))
const StrategyTemplates = lazy(() => import('@/pages/StrategyTemplates'))
const OrderBook = lazy(() => import('@/pages/OrderBook'))
const OrderDetail = lazy(() => import('@/pages/OrderDetail'))
const ExecutionReport = lazy(() => import('@/pages/ExecutionReport'))
const History = lazy(() => import('@/pages/History'))
const Operations = lazy(() => import('@/pages/Operations'))
const StrategyConfig = lazy(() => import('@/pages/StrategyConfig'))
const RulePacks = lazy(() => import('@/pages/RulePacks'))
const Glossary = lazy(() => import('@/pages/Glossary'))
const Settings = lazy(() => import('@/pages/Settings'))
const Workspace = lazy(() => import('@/pages/Workspace'))
const Forbidden = lazy(() => import('@/pages/Forbidden'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const page = (Page: ComponentType) => (
  <LazyLoader>
    <Page />
  </LazyLoader>
)

export const routes: RouteObject[] = [
  {
    // "/" khi chưa đăng nhập là trang giới thiệu, gộp chung với đăng nhập.
    element: <LoginRoute />,
    children: [
      { path: '/', element: page(Login) },
      { path: '/login', element: page(Login) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/trung-tam', element: page(OrderCenter) },
          { path: '/bao-cao/hieu-qua', element: page(ExecutionReport) },
          { path: '/bao-cao/lich-su', element: page(History) },
          { path: '/thuat-ngu', element: page(Glossary) },
          // Cài đặt giao diện: mọi vai trò.
          { path: '/cai-dat', element: page(Settings) },
          {
            element: <PermissionRoute permission="place_order" />,
            children: [
              { path: '/dat-lenh', element: page(PlaceOrder) },
              // Bàn làm việc (Đợt 10A): mọi vai trò đặt được lệnh; khách hàng mặc định bố cục Cơ bản.
              { path: '/ban-lam-viec', element: page(Workspace) },
              { path: '/mau-chien-luoc', element: page(StrategyTemplates) },
            ],
          },
          {
            element: <PermissionRoute permission="order_book" />,
            children: [
              { path: '/so-lenh', element: page(OrderBook) },
              { path: '/so-lenh/:id', element: page(OrderDetail) },
            ],
          },
          {
            element: <PermissionRoute permission="operations" />,
            children: [{ path: '/van-hanh', element: page(Operations) }],
          },
          {
            element: <PermissionRoute permission="strategy_config" />,
            children: [{ path: '/cau-hinh', element: page(StrategyConfig) }],
          },
          {
            element: <PermissionRoute permission="rule_config" />,
            children: [{ path: '/cau-hinh/luat', element: page(RulePacks) }],
          },
          { path: '/403', element: page(Forbidden) },
          { path: '*', element: page(NotFound) },
        ],
      },
    ],
  },
]
