import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { getPublicRedirect } from './guards'

/** Đã đăng nhập thì không vào lại trang giới thiệu / đăng nhập. */
export function LoginRoute() {
  const redirect = getPublicRedirect(useAuthStore((state) => state.user))
  return redirect ? <Navigate to={redirect} replace /> : <Outlet />
}
