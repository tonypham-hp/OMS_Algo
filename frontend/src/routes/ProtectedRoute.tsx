import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

/** Chưa đăng nhập thì chuyển về /login. */
export function ProtectedRoute() {
  const user = useAuthStore((state) => state.user)
  return user ? <Outlet /> : <Navigate to="/login" replace />
}
