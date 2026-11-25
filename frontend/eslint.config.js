import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default defineConfig([
  // components/ui là code do shadcn sinh ra, mockServiceWorker.js do MSW sinh ra: không sửa tay.
  globalIgnores(['dist', 'src/components/ui', 'public/mockServiceWorker.js']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
  },
  {
    // Đợt 9: cấm mã màu viết cứng. Màu chỉ khai báo ở src/config/theme.ts (sinh src/styles/tokens.css);
    // component dùng lớp token (text-price-up, bg-surface, bg-status-danger-bg…) hoặc var(--token).
    // scripts/check-colors.mjs kiểm phần còn lại (file .css, components/ui) và tokens.css khớp theme.ts.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/config/theme.ts', 'src/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...colorRestrictions()],
    },
  },
])

function colorRestrictions() {
  const patterns = [
    [String.raw`#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{1,5})?\b`, 'Mã màu hex viết cứng'],
    [String.raw`\b(?:rgba?|hsla?|oklch|oklab)\(`, 'Màu rgb()/hsl()/oklch() viết cứng'],
    [
      String.raw`\b(?:bg|text|border(?:-[trblxy])?|ring|fill|stroke|from|to|via|outline|divide|decoration|shadow|accent|caret|placeholder)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b`,
      'Lớp màu bảng Tailwind (bg-red-500…)',
    ],
    [String.raw`\b(?:bg|text|border)-(?:black|white)\b`, 'Lớp màu bg-black / text-white'],
  ]
  return patterns.flatMap(([pattern, what]) => {
    const message = `${what}: dùng token theme (src/config/theme.ts, lớp như text-price-up / bg-surface / bg-status-danger-bg, hoặc var(--token)).`
    return [
      { selector: `Literal[value=/${pattern}/]`, message },
      { selector: `TemplateElement[value.raw=/${pattern}/]`, message },
    ]
  })
}
