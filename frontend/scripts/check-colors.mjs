// Chặn mã màu viết cứng ở những chỗ ESLint không quét (Đợt 9), chạy trong `npm run lint`:
// 1. src/styles/tokens.css phải đúng bằng renderTokensCss() của src/config/theme.ts (ai sửa tay hoặc quên `npm run tokens` thì fail).
// 2. File .css (trừ tokens.css), components/ui (code shadcn, ESLint bỏ qua) và index.html không có hex, rgb()/hsl(),
//    lớp màu bảng Tailwind (bg-red-500…) hay bg-black/text-white.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderTokensCss } from '../src/config/theme.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const TOKENS = 'src/styles/tokens.css'

const RULES = [
  [/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{1,5})?\b/, 'mã màu hex'],
  [/\b(?:rgba?|hsla?|oklch|oklab)\(/, 'rgb()/hsl()/oklch()'],
  [
    /\b(?:bg|text|border(?:-[trblxy])?|ring|fill|stroke|from|to|via|outline|divide|decoration|shadow|accent|caret|placeholder)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b/,
    'lớp màu bảng Tailwind',
  ],
  [/\b(?:bg|text|border)-(?:black|white)\b/, 'bg-black/text-white'],
]

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const normalize = (text) => text.replace(/\r\n/g, '\n')
const problems = []

if (normalize(readFileSync(join(root, TOKENS), 'utf8')) !== normalize(renderTokensCss())) {
  problems.push(`${TOKENS}: không khớp src/config/theme.ts. Chạy "npm run tokens" (không sửa tay file này).`)
}

const files = [
  ...walk(join(root, 'src')).filter((file) => file.endsWith('.css')),
  ...walk(join(root, 'src/components/ui')).filter((file) => /\.tsx?$/.test(file)),
  join(root, 'index.html'),
]
  .map((file) => relative(root, file).replace(/\\/g, '/'))
  .filter((file) => file !== TOKENS)

for (const file of files) {
  const lines = readFileSync(join(root, file), 'utf8').split(/\r?\n/)
  lines.forEach((line, index) => {
    // Bỏ qua dòng chú thích thuần (CSS/JS) để ghi chú có thể nhắc tên lớp cũ.
    if (/^\s*(\/\*|\*|\/\/)/.test(line)) return
    for (const [pattern, what] of RULES) {
      if (pattern.test(line)) problems.push(`${file}:${index + 1}: ${what} viết cứng → dùng token trong src/config/theme.ts`)
    }
  })
}

if (problems.length > 0) {
  console.error(`Màu viết cứng (${problems.length}):\n${problems.map((problem) => `  ${problem}`).join('\n')}`)
  process.exit(1)
}
console.log(`check-colors: ${files.length} file sạch, tokens.css khớp theme.ts.`)
