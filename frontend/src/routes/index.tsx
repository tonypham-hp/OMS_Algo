import { lazy, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/components/AppLayout'
import { LazyLoader } from './LazyLoader'
import { LoginRoute } from './LoginRoute'
import { PermissionRoute } from './PermissionRoute'
import { ProtectedRoute } from './ProtectedRoute'

const Login = lazy(() => import('@/pages/Login'))
const PlaceOrder = lazy(() => import('@/pages/PlaceOrder'))
const OrderBook = lazy(() => import('@/pages/OrderBook'))
const OrderDetail = lazy(() => import('@/pages/OrderDetail'))
const Operations = lazy(() => import('@/pages/Operations'))
const StrategyConfig = lazy(() => import('@/pages/StrategyConfig'))
const Forbidden = lazy(() => import('@/pages/Forbidden'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const page = (Page: ComponentType) => (
  <LazyLoader>
    <Page />
  </LazyLoader>
)

const router = createBrowserRouter([
  {
    element: <LoginRoute />,
    children: [{ path: '/login', element: page(Login) }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dat-lenh" replace /> },
          {
            element: <PermissionRoute permission="place_order" />,
            children: [{ path: '/dat-lenh', element: page(PlaceOrder) }],
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
          { path: '/403', element: page(Forbidden) },
          { path: '*', element: page(NotFound) },
        ],
      },
    ],
  },
])

export function AppRoutes() {
  return <RouterProvider router={router} />
}
