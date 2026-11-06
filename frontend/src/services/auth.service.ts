import type { DemoUser } from '@/types'
import { http } from './http'

export const authService = {
  getDemoUsers: () => http.get<DemoUser[]>('/api/auth/demo-users'),
  login: (username: string) => http.post<DemoUser>('/api/auth/login', { username }),
}
