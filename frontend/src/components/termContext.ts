import { createContext } from 'react'
import type { GlossaryContext } from '@/config/glossary'

/** Số của lệnh đang xem, để ví dụ trong tooltip thuật ngữ dùng đúng số thật. Mặc định rỗng. */
export const TermExampleContext = createContext<GlossaryContext>({})
