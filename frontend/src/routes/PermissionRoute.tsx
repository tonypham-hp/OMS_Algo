import { Navigate, Outlet } from 'react-router-dom'
import type { Permission } from '@/config/permissions'
import { usePermission } from '@/hooks/usePermission'

/** Thiếu quyền thì chuyển sang trang 403. */
export function PermissionRoute({ permission }: { permission: Permission }) {
  const hasPermission = usePermission()
  return hasPermission(permission) ? <Outlet /> : <Navigate to="/403" replace />
}
