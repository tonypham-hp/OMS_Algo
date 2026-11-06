import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DemoUser } from '@/types'

interface AuthState {
  user: DemoUser | null
  setUser: (user: DemoUser) => void
  logout: () => void
}

// persist lưu vào localStorage để tải lại trang không bị đăng xuất.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: 'oms-auth' },
  ),
)
