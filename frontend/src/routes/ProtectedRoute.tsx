import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { getProtectedRedirect } from './guards'

/** Chưa đăng nhập thì chuyển về /login. */
export function ProtectedRoute() {
  const redirect = getProtectedRedirect(useAuthStore((state) => state.user))
  return redirect ? <Navigate to={redirect} replace /> : <Outlet />
}
