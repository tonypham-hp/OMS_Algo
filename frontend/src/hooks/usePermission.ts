import { ROLE_PERMISSIONS, type Permission } from '@/config/permissions'
import { useAuthStore } from '@/store/auth.store'

export function usePermission() {
  const role = useAuthStore((state) => state.user?.role)

  return (permission: Permission) => (role ? ROLE_PERMISSIONS[role].includes(permission) : false)
}
