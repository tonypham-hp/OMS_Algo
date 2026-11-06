import { useAuthStore } from '@/store/auth.store'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const username = useAuthStore.getState().user?.username
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(username ? { 'X-User-Id': username } : {}),
      ...init?.headers,
    },
  })
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    const message = (body as { message?: string } | null)?.message
    throw new ApiError(message ?? `Lỗi máy chủ (${response.status})`, response.status)
  }
  return body as T
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
}
