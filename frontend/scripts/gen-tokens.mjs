// Sinh src/styles/tokens.css từ src/config/theme.ts (nguồn duy nhất của giá trị màu). Chạy: npm run tokens
import { writeFileSync } from 'node:fs'
import { renderTokensCss } from '../src/config/theme.ts'

const target = new URL('../src/styles/tokens.css', import.meta.url)
writeFileSync(target, renderTokensCss())
console.log('Đã sinh src/styles/tokens.css')
