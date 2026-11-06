import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

/** Đã đăng nhập thì không vào lại trang đăng nhập. */
export function LoginRoute() {
  const user = useAuthStore((state) => state.user)
  return user ? <Navigate to="/dat-lenh" replace /> : <Outlet />
}
