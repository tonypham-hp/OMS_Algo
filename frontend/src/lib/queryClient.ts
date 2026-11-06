import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
    // Không tự gửi lại lệnh khi lỗi: đặt trùng lệnh nguy hiểm hơn là báo lỗi.
    mutations: { retry: false },
  },
})
